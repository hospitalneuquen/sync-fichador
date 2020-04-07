const logger = require('./logger').logger;
const db = require('./db');
const utils = require('./utils');

async function simulateFichadas(mssqlPool){
    try {
        const request = mssqlPool.request();
        const result = await request.query`
            SELECT
                id,
                idAgente,
                fecha,
                esEntrada,
                reloj
            FROM Personal_Fichadas fichada
            WHERE idAgente = 363
            ORDER BY fecha ASC`;
        if (result.recordset && result.recordset.length){
            for (const row of result.recordset) {
                const reqInsert = mssqlPool.request();
                await reqInsert.query`
                    INSERT INTO Personal_FichadasTemp (idAgente, fecha, esEntrada, reloj)
                    VALUES (${row.idAgente}, ${row.fecha}, ${row.esEntrada},${row.reloj});`
                await utils.timeout(500)
            }
        }
        return;
    } catch (err) {
        logger.error(err);
    }
}

async function main(){
    try {
        const sqlPool = await db.connectSQLServerDB();
        // Simulamos
        simulateFichadas(sqlPool);
    
    } catch (err) {
        logger.error(err);
    }
}

main();
