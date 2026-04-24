const { Schema, model } = require('mongoose');

/**
 * Modelo de Dato (Historial)
 * Sigue la estructura de escritorio pero incluye campos originales para no dañar la lógica.
 */
const DatoSchema = Schema({
    dispositivo_uuid: {
        type: String,
        required: [true, 'El UUID del dispositivo es obligatorio'],
        ref: 'Dispositivo'
    },
    topic: {
        type: String,
        required: false
    },
    valor: {
        type: Schema.Types.Mixed, // Cambiado de Number a Mixed para soportar objetos
        required: [true, 'El valor del sensor es obligatorio']
    },
    fecha_insercion: {
        type: Date,
        default: Date.now
    }
});

// Limpiar la respuesta JSON
DatoSchema.methods.toJSON = function() {
    const { __v, _id, ...dato } = this.toObject();
    return dato;
}

module.exports = model('Dato', DatoSchema);
