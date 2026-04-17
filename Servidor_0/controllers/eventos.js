const { request, response } = require('express');
const Evento = require('../models/evento');

const obtenerEventos = async (req = request, res = response) => {
    const { limite = 50, desde = 0 } = req.query;

    try {
        const [total, eventos] = await Promise.all([
            Evento.countDocuments(),
            Evento.find()
                .sort({ fecha: -1 })
                .skip(Number(desde))
                .limit(Number(limite))
                .populate('usuarioAsociado', 'nombre username')
        ]);

        res.json({
            total,
            eventos
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error interno al consultar eventos' });
    }
}

/**
 * Función interna utilitaria para que otros controladores la usen
 * No es un middleware de ruta
 */
const registrarEventoInterno = async (mensaje, severidad = 'INFO', usuarioId = null) => {
    try {
        const nuevoEvento = new Evento({
            mensaje,
            severidad,
            usuarioAsociado: usuarioId
        });
        await nuevoEvento.save();
    } catch (error) {
        console.error('No se pudo guardar el evento interno en DB:', error);
    }
}

module.exports = {
    obtenerEventos,
    registrarEventoInterno
}
