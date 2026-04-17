const { Schema, model } = require('mongoose');

const EventoSchema = Schema({
    mensaje: {
        type: String,
        required: [true, 'El mensaje del evento es obligatorio']
    },
    severidad: {
        type: String,
        required: true,
        enum: ['INFO', 'WARNING', 'DANGER', 'SUCCESS'],
        default: 'INFO'
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    usuarioAsociado: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: false
    }
});

EventoSchema.methods.toJSON = function() {
    const { __v, ...evento } = this.toObject();
    return evento;
}

module.exports = model( 'Evento', EventoSchema );
