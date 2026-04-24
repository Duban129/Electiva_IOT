const { response, request } = require('express');
const { Dato, Dispositivo } = require('../models');

/**
 * Obtiene todas las lecturas de los sensores.
 */
const datosGet = async (req = request, res = response) => {
    try {
        const { limite = 50, desde = 0, uuid } = req.query;

        const query = uuid ? { dispositivo_uuid: uuid } : {};

        const [total, datos] = await Promise.all([
            Dato.countDocuments(query),
            Dato.find(query)
                .skip(Number(desde))
                .limit(Number(limite))
                .sort({ fecha_insercion: -1 }) // Mostrar los más recientes primero
        ]);

        res.json({
            total,
            datos
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            msg: 'Error al obtener los datos'
        });
    }
}

/**
 * Registra una nueva lectura de sensor.
 */
const datosPost = async (req, res = response) => {
    try {
        const { dispositivo_uuid, valor, topic } = req.body;

        // Opcional: Verificar que el dispositivo exista
        const existeDispositivo = await Dispositivo.findOne({ uuid: dispositivo_uuid });
        if (!existeDispositivo) {
            return res.status(404).json({
                msg: `El dispositivo con UUID ${dispositivo_uuid} no está registrado`
            });
        }

        const dato = new Dato({ dispositivo_uuid, valor, topic });

        // Guardar en DB
        await dato.save();

        res.status(201).json({
            dato
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            msg: 'Error al registrar el dato del sensor',
            error: error.message
        });
    }
}

module.exports = {
    datosGet,
    datosPost
}
