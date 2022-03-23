const logger = require('./logger').logger;
var mongoose = require('mongoose');
const schemas = require('./schemas');
const utils = require('./utils');

class SyncDataException extends Error {};


/**
 * Loop principal de sincronizacion. Infinitamente:
 * 1. Buscamos una nueva fichada en SQLServer
 * 2. Copiamos la nueva fichada a MongoDB (+ actualizacion E/S)
 * 3. Eliminamos la fichada leida desde SQLServer
 * @param  sqlPool 
 */
async function syncFichadas(sqlPool){
    logger.debug("Inicio sincronizador.")
    let fichada;
    let agente;
    while (true){ // Infinite loop
        try {
            fichada = await nextFichadaFromSQLServer(sqlPool);
            if (fichada){
                agente = await findAgenteFichada(sqlPool, fichada);
                await saveFichadaToMongo(fichada, agente);
                await removeFichadaFromSQLServer(sqlPool, fichada.id)
            }
            await utils.timeout(3000);
        } catch (err) {
            if (err instanceof SyncDataException){
                logger.error(err);
                try {
                    await markFichadaAsFailedInSQLServer(sqlPool, fichada.id, err.message);
                }
                catch( err2){
                    logger.error(err2);
                }
            }
            else{
                logger.error('Se encontró un error en el loop principal de sincronizacion.');
                logger.error(err);
                logger.error('Reintentando operacion en 60s');
                await utils.timeout(60000); // Esperamos 1 min antes de reiniciar
            }
        }
    }
}


async function nextFichadaFromSQLServer(mssqlPool){
    const request = mssqlPool.request();
    const result = await request.query`
        UPDATE TOP (1) Personal_FichadasSync
        SET syncTries = syncTries + 1
        OUTPUT  inserted.id,
                inserted.idAgente,
                inserted.fecha,
                inserted.esEntrada,
                inserted.reloj
        WHERE syncTries <3`;
    if (result.recordset && result.recordset.length){
        let fichada = result.recordset[0];
        logger.debug("Fichada from SQLServer:" + JSON.stringify(fichada));
        return fichada;
    }
}


async function removeFichadaFromSQLServer(mssqlPool, fichadaID){
    const request = mssqlPool.request();
    const resultado = await request.query`
        DELETE TOP(1) FROM Personal_FichadasSync
        WHERE id = ${fichadaID}`;
    logger.debug("Fichada eliminada de SQLServer:" + JSON.stringify(resultado));
    return;
}


async function fichadaAlreadyExists(fichada, agente) {
  return await schemas.Fichada.exists({"agente._id": agente._id, fecha: fichada.fecha, esEntrada: fichada.esEntrada, reloj: fichada.reloj})
}

async function saveFichadaToMongo(fichada, agente){
    if (!agente) throw new SyncDataException(`La fichada posee un ID de Agente no valido en MongoDB. FichadaID=${fichada.id}`);

    if (fichadaAlreadyExists(fichada, agente)) {
      logger.debug('Fichada already exists in Mongo: ' + JSON.stringify(fichada))
      return
    }
    
    // El agente existe. Creamos la fichada con sus respectivos 
    // datos y guardamos en la base.
    let fichadaToSync = new schemas.Fichada(
        {
            agente: {
                _id: agente._id,
                nombre: agente.nombre,
                apellido: agente.apellido
            },
            fecha: fichada.fecha,
            esEntrada: fichada.esEntrada,
            reloj: fichada.reloj
        });
    const nuevaFichada = await fichadaToSync.save();
    logger.debug('Fichada saved in Mongo OK:' +  JSON.stringify(nuevaFichada));
    // Finalmente actualizamos la fichadacache (entrada y salida)
    await actualizaFichadaIO(nuevaFichada);
}


async function findAgenteFichada(mssqlPool, fichada){
    let agente;
    if (!fichada.idAgente) throw new SyncDataException(`La fichada no presenta ID de Agente. FichadaID=${fichada.id}`);
        
    agente = await schemas.Agente.findOne(
        { idLegacy: fichada.idAgente },
        { _id: 1, nombre: 1, apellido: 1}).lean();
        
    if (!agente){
        // Si el idAgente no es un id valido para mongo, entonces puede 
        // tratarse de un dato con el id de agente del viejo sistema.
        // Esta condicion es solo temporal hasta que se decida la baja
        // del viejo sistema 
        agente = await findAgenteFromSQLServer(mssqlPool, fichada);
        if (!agente || !agente.Numero) throw new SyncDataException(`La fichada no presenta un ID ni Nro de Agente válido. FichadaID=${fichada.id}`);        
        // En este caso intentamos una busqueda por el numero de agente
        agente = await schemas.Agente.findOne(
            { numero: agente.Numero },
            { _id: 1, nombre: 1, apellido: 1}).lean();   
    }
    
    logger.debug("Agente que ficho:" + JSON.stringify(agente));
    return agente;
}


async function findAgenteFromSQLServer(mssqlPool, fichada){
    if (!fichada.idAgente) throw new SyncDataException(`La fichada no presenta ID de Agente. FichadaID=${fichada.id}`);
    const request = mssqlPool.request();
    const result = await request.query`
        SELECT TOP (1) * FROM Personal_Agentes
        WHERE ID = ${fichada.idAgente}`;
    if (result.recordset && result.recordset.length){
        return result.recordset[0];
    }
}

async function actualizaFichadaIO(nuevaFichada) {
    let fichadaIO; 
    const fechaFichada = utils.parseDate(nuevaFichada.fecha);
    if (nuevaFichada.esEntrada){
        // Obs: Existen casos limites en los cuales por error (generalmente)
        // el agente ficha en el mismo dia el ingreso y egreso como entrada
        // Tambien se puede presentar el caso inverso de dos fichadas en el 
        // mismo dia como salida.
        // Estos casos se deberan corregir manualmente. Se podria habilitar
        // esta opcion de correccion manual quizas en los partes cuando los
        // jefes de servicio pueden visualizar estas inconsistencias.     
        fichadaIO = new schemas.FichadaCache({  
            agente: nuevaFichada.agente,
            fecha: fechaFichada,
            entrada: nuevaFichada.fecha,
            salida: null
        })       
    }
    else{
        let correspondeNuevaFichadaIO = true;
        // Busco fichadas cache del dia y el dia anterior
        fichadaIO = await findFichadaEntradaPrevia(nuevaFichada.agente._id, nuevaFichada.fecha);
        if (fichadaIO){
            if (utils.diffHours(nuevaFichada.fecha, fichadaIO.fecha) <= 24) {
                // Si pasaron menos de 24hs respecto a la fichada de entrada
                // actualizamos con la salida indicada.
                fichadaIO.salida = nuevaFichada.fecha;
                correspondeNuevaFichadaIO = false;
            }
        }
        if (correspondeNuevaFichadaIO){
            fichadaIO = new schemas.FichadaCache({  
                agente: nuevaFichada.agente,
                fecha: fechaFichada,
                entrada: null,
                salida: nuevaFichada.fecha
            })  
        }
    }
    let fichadaIOResult = await fichadaIO.save();
    logger.debug('FichadaIO(Cache) updated OK:' +  JSON.stringify(fichadaIOResult));
}


/**
 * Dado el ID de un agente y una fichada de salida, intentamos recuperar
 * la mejor fichada de entrada que se ajuste a la fichada de salida. Esto
 * permitira posteriormente determinar la cantidad de horas trabajadas.
 * La fichada de entrada se busca solo un dia hacia atras respecto a la
 * fichada de salida.
 */
async function findFichadaEntradaPrevia(agenteID, fichadaSalida){
    let fechaDesde = utils.substractOneDay(fichadaSalida);
    let fechaHasta = fichadaSalida;
    let fichadaIO = await schemas.FichadaCache
        .findOne({ 
            'agente._id': mongoose.Types.ObjectId(agenteID),
            'entrada': { $ne: null },
            'salida':  null ,
            $expr : { $and:
                [   // Busqueda solo por fecha, sin importar la hora o tz
                    { $lte: [
                        { $dateToString: { date: "$fecha", format:"%Y-%m-%d"}} ,
                        { $dateToString: { date: fechaHasta, format:"%Y-%m-%d"}}
                        ]
                    },
                    { $gte: [
                        { $dateToString: { date: "$fecha", format:"%Y-%m-%d"}} ,
                        { $dateToString: { date: fechaDesde, format:"%Y-%m-%d"}}
                    ]}
                ]}
        })
        .sort({ fecha: -1 });
        logger.debug('FichadaIO(Cache) previa:' +  JSON.stringify(fichadaIO));
    return fichadaIO;
}


async function markFichadaAsFailedInSQLServer(mssqlPool, fichadaID, errMsj){
    try {
        const request = mssqlPool.request();
        await request.query`
            UPDATE Personal_FichadasSync SET syncError = ${errMsj}
            WHERE id = ${fichadaID}`;
        logger.debug(`Fichada identificada con problemas en SQLServer: ID=${fichadaID}. Error=${errMsj}`);      
    } catch (err) {
        logger.debug(`Ocurrió un error al intentar marcar como fallida la fichada con ID: ${fichadaID}`)
        logger.error(err);
    }
}


module.exports = {
    nextFichadaFromSQLServer: nextFichadaFromSQLServer,
    saveFichadaToMongo: saveFichadaToMongo,
    actualizaFichadaIO: actualizaFichadaIO,
    removeFichadaFromSQLServer: removeFichadaFromSQLServer,
    syncFichadas: syncFichadas
}



