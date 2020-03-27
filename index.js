const logger = require('./logger').logger;
const db = require('./db');
const poll = require('./poll');

async function main(){
    try {
        // Establecemos las conexiones a las db
        const mongoDB = await db.connectMongoDB();
        const sqlPool = await db.connectSQLServerDB();
        // Simulamos las fichadas. Solo para testing del script
        // poll.simulateFichadas(sqlPool);
        // Sincronizamos
        poll.syncFichadas(sqlPool);
    
    } catch (err) {
        logger.error(err);
    }
}


main();