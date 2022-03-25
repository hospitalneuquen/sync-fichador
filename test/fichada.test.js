const db = require('./db')
const schemas = require('../schemas');
const poll = require('../poll')
var mongoose = require("mongoose");
const utils = require('../utils');

describe('Fichadas', () => {

  const fichada = {
    id: 123,
    fecha: new Date(),
    esEntrada: true,
    reloj: "1"
  };
  const agente = {
    _id: mongoose.Types.ObjectId(),
    nombre: "ag name",
    apellido: "ag lastname",
  }

  beforeAll(async () => await db.connect())

  afterEach(async () => await db.clearDatabase())

  afterAll(async () => await db.closeDatabase())

  it('Should fail if not agent is provided', async () => {
    await expect(poll.saveFichadaToMongo(fichada)).rejects.toThrow()
  })

  it('Should insert new entries', async () => {
    await poll.saveFichadaToMongo(fichada, agente)
    const fichadas = await schemas.Fichada.find()
    expect(fichadas.length).toEqual(1)
    const fichadasCache = await schemas.FichadaCache.find()
    expect(fichadasCache.length).toEqual(1)
  })

  it('Should not insert duplicated entries', async () => {
    await poll.saveFichadaToMongo(fichada, agente)
    await poll.saveFichadaToMongo(fichada, agente)
    const fichadas = await schemas.Fichada.find()
    expect(fichadas.length).toEqual(1)
    const fichadasCache = await schemas.FichadaCache.find()
    expect(fichadasCache.length).toEqual(1)
  })

  it('Should insert entries with different entrada/salida parameter', async () => {
    await poll.saveFichadaToMongo(fichada, agente)
    const changedFichada = { ...fichada, esEntrada: !fichada.esEntrada }
    await poll.saveFichadaToMongo(changedFichada, agente)
    const fichadas = await schemas.Fichada.find()
    expect(fichadas.length).toEqual(2)
    const fichadasCache = await schemas.FichadaCache.find()
    expect(fichadasCache.length).toEqual(1)
    const fechaFichada = utils.parseDate(fichada.fecha);
    expect(fichadasCache[0].fecha).toEqual(fechaFichada)
    expect(fichadasCache[0].entrada).toEqual(fichada.fecha)
    expect(fichadasCache[0].salida).toEqual(fichada.fecha)
    // expect(fichadasCache[0].salida).toEqual(fichada.fecha)
  })

  it('Should resolve different days', async () => {
    const prevDayFichada = { ...fichada, esEntrada: true, fecha: utils.substractOneDay(fichada.fecha) }
    await poll.saveFichadaToMongo(prevDayFichada, agente)

    const todayFichada = { ...fichada, esEntrada: false, fecha: fichada.fecha }
    await poll.saveFichadaToMongo(todayFichada, agente)

    const fichadas = await schemas.Fichada.find()
    expect(fichadas.length).toEqual(2)

    const fichadasCache = await schemas.FichadaCache.find()
    console.log(fichadasCache)
    expect(fichadasCache.length).toEqual(1)
    const fechaFichada = utils.parseDate(prevDayFichada.fecha);
    expect(fichadasCache[0].fecha).toEqual(fechaFichada)
    expect(fichadasCache[0].entrada).toEqual(prevDayFichada.fecha)
    expect(fichadasCache[0].salida).toEqual(fichada.fecha)
    // expect(fichadasCache[0].salida).toEqual(fichada.fecha)
  })
})
