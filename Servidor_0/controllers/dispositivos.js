const { response, request } = require('express');
const Dispositivo = require('../models/dispositivo');

/**
 * Maneja las peticiones GET para obtener dispositivos.
 */
const dispositivosGet = async (req = request, res = response) => {
    const { limite = 5, desde = 0 } = req.query;
    const query = { estado: true };

    const [ total, dispositivos ] = await Promise.all([
        Dispositivo.countDocuments(query),
        Dispositivo.find(query)
            .skip( Number( desde ) )
            .limit( Number( limite ) )
    ]);

    res.json({
        total,
        dispositivos
    });
}

/**
 * Maneja las peticiones POST para registrar un nuevo dispositivo.
 */
const dispositivosPost = async (req, res = response) => {
    const { nombre, ubicacion, topic, valor } = req.body;
    const dispositivo = new Dispositivo({ nombre, ubicacion, topic, valor });

    // Guardar en BD
    await dispositivo.save();

    res.json({
        dispositivo
    });
}

/**
 * Maneja las peticiones PUT para actualizar un dispositivo por su ID.
 */
const dispositivosPut = async (req, res = response) => {
    const { id } = req.params;
    const { _id, estado, ...resto } = req.body;

    // TODO validar contra base de datos
    const dispositivo = await Dispositivo.findByIdAndUpdate( id, resto, { new: true } );

    res.json({
        dispositivo
    });
}

/**
 * Maneja las peticiones PATCH para actualizaciones parciales de dispositivos.
 */
const dispositivosPatch = async (req, res = response) => {
    const { id } = req.query; // Puede venir por query o params, lo normal es params pero el router para patch está '/'
    const { _id, ...resto } = req.body;

    if (!id) {
        return res.status(400).json({ msg: 'Falta id en query' });
    }

    try {
        const dispositivo = await Dispositivo.findByIdAndUpdate(id, resto, { new: true });
        res.json({
            dispositivo
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar', error });
    }
}

/**
 * Maneja las peticiones DELETE para eliminar un dispositivo (borrado lógico).
 */
const dispositivosDelete = async (req, res = response) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ msg: 'Falta id en params' });
    }

    const dispositivo = await Dispositivo.findByIdAndUpdate( id, { estado: false }, { new: true } );

    res.json({
        dispositivo
    });
}

module.exports = {
    dispositivosGet,
    dispositivosPost,
    dispositivosPut,
    dispositivosPatch,
    dispositivosDelete,
}
