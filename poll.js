const logger = require('./logger').logger;
var mongoose = require('mongoose');
const schemas = require('./schemas');
const utils = require('./utils');

async function nextFichada(mssqlPool){
    try {
        const request = mssqlPool.request();
        const result = await request.query`
            SELECT TOP(1) FROM FichadasQueue
            ORDER BY Id)`;
    if (result.recordset && result.recordset.length){
        const row = result.recordset[0];
        
    }
    return;
    } catch (err) {
        logger.error(err);
    }
}


async function dequeueFichada(mssqlPool){
    try {
        const request = mssqlPool.request();
        await request.query`
            DELETE TOP(1) FROM FichadasQueue
            OUTPUT deleted.Payload
            WHERE Id = (
                SELECT TOP(1) Id
                FROM FichadaQueue WITH (rowlock, updlock, readpast)
                ORDER BY Id)`;
        return;
    } catch (err) {
        logger.error(err);
    }
}

async function postFichada(object){
    try{
        // // Primero necesitamos recuperar el agente en mongodb a partir 
        // // del numero de agente del viejo sistema
        // if (!fichada.agente) return; // TODO Raise Error
        // const agente = await schemas.Agente.findOne({ numero: fichada.agente }, { _id: 1, nombre: 1, apellido: 1}).lean();
        // if (!agente) return; // TODO Raise Error
        // // El agente existe. Creamos la fichada con sus respectivos 
        // // datos y guardamos en la base.
        // let object = new Fichada(
        //     {
        //         agente: {
        //             _id: agente._id,
        //             nombre: agente.nombre,
        //             apellido: agente.apellido
        //         },
        //         fecha: fichada.fecha,
        //         esEntrada: fichada.esEntrada,
        //         reloj: fichada.reloj
        //     });
        let fichada = new schemas.Fichada(object)
        const nuevaFichada = await fichada.save();
        logger.debug('Fichada Sync OK:' +  JSON.stringify(nuevaFichada));
        // Finalmente actualizamos la fichadacache (entrada y salida)
        await actualizaFichadaIO(nuevaFichada);
        // return res.json(nuevaFichada);
        // const result = await Fichada.create(fichada);
        // logger.debug('Se inserto OK:' +  JSON.stringify(result))
    } catch (err) {
        logger.error(err);
    }
}

async function actualizaFichadaIO(nuevaFichada) {
    let fichadaIO; 
    if (nuevaFichada.esEntrada){
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
    logger.debug('FichadaIO(Cache) Updated OK:' +  JSON.stringify(fichadaIOResult));
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
    return fichadaIO;
}



module.exports = {
    postFichada: postFichada
}



