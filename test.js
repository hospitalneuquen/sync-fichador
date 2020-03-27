const logger = require('./logger').logger;
const mongoose = require('mongoose');
const db = require('./db');
const schemas = require('./schemas');
const poll = require('./poll');

const FichadaCacheTest = mongoose.model('FichadaCacheTest', schemas.FichadaCacheSchema, 'fichadascachetest');
const FichadaTest = mongoose.model('FichadaTest', schemas.FichadaSchema, 'fichadastest');

async function test(){
    try {
        let fichadasCache = await schemas.FichadaCache
            .find({"agente._id": mongoose.Types.ObjectId("5e5402e4d40607323cb85225")})
            .sort({ fecha: 1,entrada:1, salida:1});
        let fichadasCacheTest = await FichadaCacheTest.find({}).sort({ fecha: 1,entrada:1, salida:1})
        fichadasCache.forEach((fichada, i) => {
            const fichadaTest = fichadasCacheTest[i];
            if (((fichada.entrada && !fichadaTest.entrada) || (!fichada.entrada && fichadaTest.entrada)) ||
                ((fichada.salida && !fichadaTest.salida) || (!fichada.salida && fichadaTest.salida)) ||
                (fichada.entrada && fichadaTest.entrada && fichada.entrada.getTime() !== fichadaTest.entrada.getTime()) ||
                (fichada.salida && fichadaTest.salida && fichada.salida.getTime() !== fichadaTest.salida.getTime())
            ){
                logger.info(`############################ Nro: ${i}  ##########################`);
                logger.info("Fichada: " +  fichada);
                logger.info("Fichada Test: " + fichadaTest);
                
                // throw "Fichadas diferentes";
            }
        });
    }
    catch (err) {
        logger.error(err);
    }
}

async function fillFichadaCache(){
    let fichadas = await schemas.Fichada.find({ "agente._id": mongoose.Types.ObjectId("5e5402e4d40607323cb85225") }).sort( { fecha: 1});
    for (const fichada of fichadas) {
        await poll.actualizaFichadaIO(fichada);    
    }
}


async function main(){
    try {
        await db.connectMongoDB();
        // fillFichadaCache();
        test();
    } catch (err) {
        logger.error(err);
    }
}


main();