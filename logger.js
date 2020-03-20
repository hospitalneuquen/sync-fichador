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
 * Final Logger Configuration
 * - Write all logs ONLY with level `info` to console
 * - Write all logs with level `error` and below to `error.log`
 * - Write all logs with level `debug` and below to `combined.log`
 */
const logger = createLogger({
    format: customFormat,
    exitOnError: false,
    transports: [
        new CustomInfoTransport({
            levelOnly: true,
        }),
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log', level: 'debug' }) 
    ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(new winston.transports.Console({
//     format: winston.format.simple()
//   }));
// }

module.exports = {
    logger : logger,
    printFormat: printFormat
}