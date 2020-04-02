const logger = require('./logger').logger;
const db = require('./db');
const poll = require('./poll');

async function main(){
    try {
        // Establecemos las conexiones a mongo y sqlserver
        const mongoDB = await db.connectMongoDB();
        const sqlPool = await db.connectSQLServerDB();
        // Sincronizamos
        poll.syncFichadas(sqlPool);
    
    } catch (err) {
        logger.error(err);
    }
}

main();