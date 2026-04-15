const { Schema, model } = require('mongoose');

const DispositivoSchema = Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio']
    },
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
    }
});

// Sobreescribir el método toJSON para no retornar _id con _ y __v
DispositivoSchema.methods.toJSON = function() {
    const { __v, _id, ...dispositivo } = this.toObject();
    dispositivo.uid = _id;
    return dispositivo;
}

module.exports = model( 'Dispositivo', DispositivoSchema );
