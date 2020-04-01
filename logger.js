const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const { combine, timestamp, printf } = format;


// Custom Output Format 
const printFormat = printf(({ level, message, timestamp}) => {
      return `${timestamp} [${level}]: ${message}`;
});

const customFormat = combine(
    timestamp(),
    printFormat
);


// Custom Transport. Logs only info level to console
class CustomInfoTransport extends Transport {
    constructor(options) {
        super(options);
        this.name = 'customLogger';
        this.level = options && options.level || 'info';
        this.levelOnly = options && options.levelOnly;
        this.levels = options && options.levels || [];
    }

    log(info, callback) {
        try{

            if (this.levelOnly && info.level == this.level ) {
                console.log(`${info.timestamp} [${info.level}]: ${info.message}`);
            }
            this.emit('logged');
            callback();
        }
        catch (err){
            console.log(err);
        } 
    }
}


/**
 * Verifica si el script se ejecuto con el parametro debug
 * Ej. node index.js debug         -> return true
 *     node index.js debug verbose -> return true
 *     node index.js verbose debug -> return true
 *     node index.js --debug       -> return false
 *     node index.js               -> return false
 */
function debugEnabled(){
    let debug = false
    for (const arg of process.argv.slice(2)) {
        if ( arg === 'debug') {
            debug = true;
            break;
        }
    }
    return debug;
}

/**
 * Si se paremetriza la llamada al script principal con la opcion
 * debug entonces se habiltan todos los logs. Los resultados se
 * pueden chequear en el archivo de salida combined.log
 * Sino se ejecuta el script con la opcion debug, solo los errores
 * son registrados (mas alguna salida por console con nivel info)
 */
function getLoggerTransports(){
    let transportes = [
        new CustomInfoTransport({
            levelOnly: true,
        }),
        new transports.File({ filename: 'error.log', level: 'error' })
    ]
    if ((debugEnabled())) transportes.push(new transports.File({ filename: 'combined.log', level: 'debug' })); 
    return transportes;
}

/**
 * Final Logger Configuration
 * - Write all logs ONLY with level `info` to console
 * - Write all logs with level `error` and below to `error.log`
 * - Write all logs with level `debug` and below to `combined.log`
 */
const logger = createLogger({
    format: customFormat,
    exitOnError: false,
    transports: getLoggerTransports()
});


module.exports = {
    logger : logger,
    printFormat: printFormat
}