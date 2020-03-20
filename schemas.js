var mongoose = require('mongoose');

var FichadaSchema = new mongoose.Schema({
    agente: {
        _id: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        }
    },
    fecha:{
        type: Date,
        required: true,
        index: true
    }, 
    esEntrada: Boolean,
    reloj: Number,
    format: String,
    data1: String,
    data2: String

});


var AgenteSchema = new mongoose.Schema({
    idLegacy: Number,      // ID Sistema anterior.
    numero: String,        // En el alta aun no esta disponible este dato
    tipoDocumento: String, // No deberia utilizarse mas. Solo DU
    documento: {
        type: String,
        required: true,
        es_indexed: true
    },
    nombre: {
        type: String,
        required: true,
        es_indexed: true
    },
    apellido: { 
        type: String,
        required: true,
        es_indexed: true
    },
    activo: Boolean,
    
});


var FichadaCacheSchema = new mongoose.Schema({
    agente: {
        _id: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true,
        },
        nombre: String, 
        apellido: String
    },
    fecha:{
        type: Date,
        required: true,
        index: true
    }, 
    entrada: Date,
    salida: Date,
    horasTrabajadas: String

})

var Fichada = mongoose.model('Fichada', FichadaSchema, 'fichadastest');
var FichadaCache = mongoose.model('FichadaCache', FichadaCacheSchema, 'fichadascachetest');
var Agente = mongoose.model('Agente', AgenteSchema, 'agentes');

module.exports = {
    Fichada: Fichada,
    FichadaCache: FichadaCache,
    Agente: Agente
}