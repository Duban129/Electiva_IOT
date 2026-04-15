const { Schema, model } = require('mongoose');

const RegistroSchema = Schema({
    dispositivo: {
        type: Schema.Types.ObjectId,
        ref: 'Dispositivo',
        required: true
    },
    topic: {
        type: String,
        required: true
    },
    valor: {
        type: Schema.Types.Mixed,
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    }
});

// Sobreescribir el método toJSON para limpiar la respuesta
RegistroSchema.methods.toJSON = function() {
    const { __v, _id, ...registro } = this.toObject();
    registro.uid = _id;
    return registro;
}

module.exports = model( 'Registro', RegistroSchema );
