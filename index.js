const logger = require('./logger').logger;
const db = require('./db');
const poll = require('./poll');
const sim = require('./sim'); // Modulo temporal para simular fichadas. Remover en prod

async function main(){
    try {
        // Establecemos las conexiones a mongo y sqlserver
        const mongoDB = await db.connectMongoDB();
        const sqlPool = await db.connectSQLServerDB();
        // Simulamos las fichadas. Solo para testing del script
        // sim.simulateFichadas(sqlPool);
        // Sincronizamos
        poll.syncFichadas(sqlPool);
    
    } catch (err) {
        logger.error(err);
    }
}


main();