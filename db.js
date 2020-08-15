const config = require('./config');
const logger = require('./logger').logger;
const sqlClient = require('mssql');
const mongoose = require('mongoose');

mongoose.isValidObjectId = function(str){
  if (typeof str !== 'string') return false;
  return str.match(/^[a-f\d]{24}$/i)? true: false;
}

// SQLServer Config
const sqlConfig = {
    user: config.db.sqlserver.user,
    password: config.db.sqlserver.password,
    server: config.db.sqlserver.server,
    database: config.db.sqlserver.database,
    parseJSON: true,
    requestTimeout:60000,
    connectionTimeout:60000,
    encrypt: false,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
}

const sqlServerPool = new sqlClient.ConnectionPool(sqlConfig);

sqlServerPool.on('error', err => {
    logger.error('SQLServer Error' + err);
})


async function connectSQLServerDB(){
    await sqlServerPool.connect();
    logger.debug('SQLServer Connection Established')
    return sqlServerPool;
}

//MongoDB Config
const mongoConfig = {
    url: config.db.mongo.url,
    database: config.db.mongo.database
}

mongoose.Promise = Promise

mongoose.connection.on('connected', () => {
  logger.debug('MongoDB Connection Established');
})

mongoose.connection.on('reconnected', () => {
  logger.debug('MongoDB Connection Reestablished')
})

mongoose.connection.on('disconnected', () => {
  logger.error('MongoDB Connection Disconnected')
})

mongoose.connection.on('close', () => {
  logger.debug('MongoDB Connection Closed')
})

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB ERROR: ' + error)
})

async function connectMongoDB(){
  await mongoose.connect(mongoConfig.url, {
    useNewUrlParser: true,
    autoReconnect: true,
    reconnectTries: 1000000,
    reconnectInterval: 3000
  })
}

module.exports = {
    // sqlServer : sqlServerPool,
    connectMongoDB: connectMongoDB,
    connectSQLServerDB: connectSQLServerDB
}