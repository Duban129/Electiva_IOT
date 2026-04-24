const { Schema, model } = require('mongoose');
const crypto = require('crypto');

/**
 * Modelo de Dispositivo
 * Fusiona la estructura de escritorio (uuid, serie) con la original (ubicacion, topic, wifi).
 */
const DispositivoSchema = Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio']
    },
    // --- Campos de estructura de Escritorio ---
    serie: {
        type: String,
        required: [true, 'La serie/MAC es obligatoria'],
        unique: true
    },
    uuid: {
        type: String,
        required: [true, 'El UUID es obligatorio'],
        unique: true,
        default: () => crypto.randomUUID()
    },
    // --- Tus campos originales (Restaurados) ---
    estado: {
        type: Boolean,
        default: true
    },
    ubicacion: {
        type: String,
        default: 'No asignada'
    },
    valor: {
        type: Schema.Types.Mixed,
        default: null
    },
    topic: {
        type: String,
        default: ''
    },
    redesWiFi: [{
        type: String
    }],
    wifiConfig: {
        ssid: { type: String, default: '' },
        enabled: { type: Boolean, default: false }
    },
    fecha_agregacion: {
        type: Date,
        default: Date.now
    }
});

// Limpiar la respuesta JSON
DispositivoSchema.methods.toJSON = function() {
    const { __v, _id, ...dispositivo } = this.toObject();
    dispositivo.uid = _id; // Mantener uid por compatibilidad
    return dispositivo;
}

module.exports = model('Dispositivo', DispositivoSchema);
