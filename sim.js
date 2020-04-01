const logger = require('./logger').logger;
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
                    INSERT INTO Personal_FichadasTemp 
                    VALUES (${row.idAgente}, ${row.fecha}, ${row.esEntrada},
                        ${row.reloj}, ${row.format}, ${row.data1}, ${row.data2});`
                await utils.timeout(1000)
            }
        }
        return;
    } catch (err) {
        logger.error(err);
    }
}


module.exports = {
    simulateFichadas: simulateFichadas
}