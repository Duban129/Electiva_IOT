const { response, request } = require('express');
const { Dispositivo } = require('../models');

/**
 * Obtiene todos los dispositivos de la base de datos.
 */
const dispositivosGet = async (req = request, res = response) => {
    try {
        const { limite = 10, desde = 0 } = req.query;
        
        // Ejecutamos ambas promesas en paralelo para mayor eficiencia
        const [ total, dispositivos ] = await Promise.all([
            Dispositivo.countDocuments(),
            Dispositivo.find()
                .skip(Number(desde))
                .limit(Number(limite))
        ]);

        res.json({
            total,
            dispositivos
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            msg: 'Error al obtener los dispositivos'
        });
    }
}

/**
 * Crea un nuevo dispositivo.
 */
const dispositivosPost = async (req, res = response) => {
    try {
        const { nombre, serie } = req.body;
        const dispositivo = new Dispositivo({ nombre, serie });

        // Guardar en DB
        await dispositivo.save();

        res.status(201).json({
            dispositivo
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            msg: 'Error al crear el dispositivo. Verifique que el UUID sea único.',
            error: error.message
        });
    }
}

/**
 * Actualiza un dispositivo por su ID.
 */
const dispositivosPut = async (req, res = response) => {
    try {
        const { id } = req.params;
        const { _id, uuid, ...resto } = req.body;

        // No permitimos cambiar el UUID en el PUT por seguridad/consistencia, 
        // pero actualizamos el resto de campos.
        const dispositivo = await Dispositivo.findByIdAndUpdate(id, resto, { new: true });

        if (!dispositivo) {
            return res.status(404).json({ msg: 'Dispositivo no encontrado' });
        }

        res.json({
            dispositivo
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            msg: 'Error al actualizar el dispositivo'
        });
    }
}

/**
 * Actualización parcial (PATCH).
 */
const dispositivosPatch = (req, res = response) => {
    res.json({
        msg: 'patch API - dispositivosPatch'
    });
}

/**
 * Elimina un dispositivo.
 */
const dispositivosDelete = async (req, res = response) => {
    try {
        const { id } = req.params;
        
        // Eliminación física
        const dispositivo = await Dispositivo.findByIdAndDelete(id);

        if (!dispositivo) {
            return res.status(404).json({ msg: 'Dispositivo no encontrado' });
        }

        res.json({
            msg: 'Dispositivo eliminado',
            dispositivo
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            msg: 'Error al eliminar el dispositivo'
        });
    }
}

module.exports = {
    dispositivosGet,
    dispositivosPost,
    dispositivosPut,
    dispositivosPatch,
    dispositivosDelete,
}
