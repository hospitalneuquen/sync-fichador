const logger = require('./logger').logger;
var mongoose = require('mongoose');
const schemas = require('./schemas');
const utils = require('./utils');

const timeout = ms => new Promise(res => setTimeout(res, ms))

async function simulateFichadas(mssqlPool){
    try {
        const request = mssqlPool.request();
        const result = await request.query`
            SELECT
                id,
                idAgente,
                fecha,
                esEntrada,
                reloj,
                format,
                data1,
                data2
            FROM Personal_Fichadas fichada
            WHERE idAgente = 363
            ORDER BY fecha ASC`;
        if (result.recordset && result.recordset.length){
            for (const row of result.recordset) {
                const reqInsert = mssqlPool.request();
                await reqInsert.query`
                    INSERT INTO Personal_FichadasSync 
                    VALUES (${row.idAgente}, ${row.fecha}, ${row.esEntrada},
                        ${row.reloj}, ${row.format}, ${row.data1}, ${row.data2});`
                // logger.info('Antes del timeout');
                await timeout(3000)
                // logger.info('Despues del timeout');
            }
        }
        return;
    } catch (err) {
        logger.error(err);
    }
}


async function syncFichadas(sqlPool){
    while (true){
        let fichada = await nextFichadaFromSQLServer(sqlPool);
        if (fichada){
            await saveFichadaToMongo(fichada);
            await removeFichadaFromSQLServer(sqlPool, fichada.id)
        }
        await timeout(1000);
    }
}

async function nextFichadaFromSQLServer(mssqlPool){
    try {
        const request = mssqlPool.request();
        const result = await request.query`
            SELECT TOP (1)
                fichada.id id,
                idAgente,
                agente.Numero numeroAgente,
                fecha,
                esEntrada,
                reloj,
                format,
                data1,
                data2
            FROM Personal_FichadasSync fichada
            LEFT JOIN Personal_Agentes agente ON (fichada.idAgente = agente.ID)
            WHERE idAgente = 363
            ORDER BY fecha ASC`;
        if (result.recordset && result.recordset.length){
            const fichada = result.recordset[0];
            logger.debug("Fichada from SQLServer:" + JSON.stringify(fichada));
            return fichada;
        }
        return;
    } catch (err) {
        logger.error(err);
    }
}



async function removeFichadaFromSQLServer(mssqlPool, fichadaID){
    try {
        const request = mssqlPool.request();
        const resultado = await request.query`
            DELETE TOP(1) FROM Personal_FichadasSync
            WHERE id = ${fichadaID}`;
        logger.debug("Fichada eliminada de SQLServer:" + JSON.stringify(resultado));
        return;
    } catch (err) {
        logger.error(err);
    }
}

async function saveFichadaToMongo(object){
    try{
        // Primero necesitamos recuperar el agente en mongodb a partir 
        // del numero de agente del viejo sistema
        let agente;
        if (!object.idAgente) throw "La fichada no presenta ID de Agente";
        if (!mongoose.Types.ObjectId.isValid(object.idAgente)){
            agente = await schemas.Agente.findOne(
                { _id: mongoose.Types.ObjectId(object.idAgente)},
                { _id: 1, nombre: 1, apellido: 1}).lean();    
        }
        else{
            agente = await schemas.Agente.findOne(
                { numero: object.numeroAgente},
                { _id: 1, nombre: 1, apellido: 1}).lean();   
        }
        
        if (!agente) throw "La fichada posee un ID de Agente no valido.";
        
        // El agente existe. Creamos la fichada con sus respectivos 
        // datos y guardamos en la base.
        let fichada = new schemas.Fichada(
            {
                agente: {
                    _id: agente._id,
                    nombre: agente.nombre,
                    apellido: agente.apellido
                },
                fecha: object.fecha,
                esEntrada: object.esEntrada,
                reloj: object.reloj,
                format: object.format,
                data1: object.data1,
                data2: object.data2
            });
        const nuevaFichada = await fichada.save();
        logger.debug('Fichada saved in Mongo OK:' +  JSON.stringify(nuevaFichada));
        // Finalmente actualizamos la fichadacache (entrada y salida)
        await actualizaFichadaIO(nuevaFichada);
    } catch (err) {
        logger.error(err);
    }
}

async function actualizaFichadaIO(nuevaFichada) {
    let fichadaIO; 
    if (nuevaFichada.esEntrada){
        // Obs: Existen casos limites en los cuales por error (generalmente)
        // el agente ficha en el mismo dia el ingreso y egreso como entrada.
        // Estos casos se deberan corregir manualmente. Se podria habilitar
        // esta opcion de correccion manual quizas en los partes cuando los
        // jefes de servicio pueden visualizar estas inconsistencias. 
        // Tambien se puede presentar el caso inverso de dos fichadas en el 
        // mismo dia como salida.
        fichadaIO = new schemas.FichadaCache({  
            agente: nuevaFichada.agente,
            fecha: utils.parseDate(nuevaFichada.fecha),
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
                fecha: utils.parseDate(nuevaFichada.fecha),
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



module.exports = {
    nextFichadaFromSQLServer: nextFichadaFromSQLServer,
    saveFichadaToMongo: saveFichadaToMongo,
    actualizaFichadaIO: actualizaFichadaIO,
    removeFichadaFromSQLServer: removeFichadaFromSQLServer,
    simulateFichadas: simulateFichadas,
    syncFichadas: syncFichadas
}



