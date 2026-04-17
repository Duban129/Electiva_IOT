const { response, request } = require('express');
const bcryptjs = require('bcryptjs');
const Usuario = require('../models/usuario');
const { registrarEventoInterno } = require('./eventos');

/**
 * Endpoint para cambiar el modo (Auto / Manual)
 * Requiere la contraseña del usuario actual para validar.
 */
const cambiarModo = async (req = request, res = response) => {
    const userId = req.usuario.id;
    const { password, modo } = req.body;

    if (!password || !modo) {
        return res.status(400).json({ msg: 'Falta password o modo' });
    }

    try {
        const usuario = await Usuario.findById(userId);

        // Verificar la contraseña
        const validPassword = bcryptjs.compareSync( password, usuario.password );
        if ( !validPassword ) {
            return res.status(401).json({
                msg: 'Contraseña de autorización incorrecta'
            });
        }

        // Si la clave es correcta, publicar el comando por MQTT
        const mqttClient = req.app.get('mqttClient');
        const exito = mqttClient.publicarComando('tanques/control', { modo: modo });

        if (exito) {
            registrarEventoInterno(`Modo de operación cambiado a: ${modo.toUpperCase()}`, 'WARNING', userId);
            res.json({ msg: `Modo cambiado exitosamente a ${modo}` });
        } else {
            res.status(500).json({ msg: 'No se pudo contactar al broker MQTT' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Hable con el administrador' });
    }
}

/**
 * Endpoint para encender o apagar la bomba.
 */
const controlarBomba = async (req = request, res = response) => {
    const { estado } = req.body; // "on" o "off"

    if (!estado) {
        return res.status(400).json({ msg: 'Estado de bomba no proporcionado' });
    }

    try {
        const mqttClient = req.app.get('mqttClient');
        const comando = estado === 'on' ? 'on' : 'off';
        const exito = mqttClient.publicarComando('tanques/control', { bomba: comando });

        if (exito) {
            const idUsuario = req.usuario ? req.usuario.id : null;
            registrarEventoInterno(`Bomba de agua accionada manualmente: ${comando.toUpperCase()}`, comando === 'on' ? 'DANGER' : 'INFO', idUsuario);
            res.json({ msg: `Comando Bomba ${comando.toUpperCase()} enviado.` });
        } else {
            res.status(500).json({ msg: 'Error de red MQTT' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error interno Servidor' });
    }
}

/**
 * Endpoint para configurar setpoints dinámicos
 */
const configurarLimites = async (req = request, res = response) => {
    const { password, limiteBajo, limiteAlto } = req.body;
    const userId = req.usuario.id;

    if (!password || limiteBajo === undefined || limiteAlto === undefined) {
        return res.status(400).json({ msg: 'Faltan parámetros de límites' });
    }

    try {
        const usuario = await Usuario.findById(userId);
        const validPassword = bcryptjs.compareSync( password, usuario.password );
        if ( !validPassword ) {
            registrarEventoInterno(`Intento fallido de cambiar límites (Clave incorrecta)`, 'WARNING', userId);
            return res.status(401).json({ msg: 'Contraseña incorrecta' });
        }

        const mqttClient = req.app.get('mqttClient');
        const exito = mqttClient.publicarComando('tanques/control', { 
            setpoint_bajo: Number(limiteBajo),
            setpoint_alto: Number(limiteAlto)
        });

        if (exito) {
            registrarEventoInterno(`Límites reconfigurados: Bajo ${limiteBajo}mm, Alto ${limiteAlto}mm`, 'SUCCESS', userId);
            res.json({ msg: 'Límites enviados con éxito a la ESP32' });
        } else {
            res.status(500).json({ msg: 'Error de red MQTT' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error interno Servidor' });
    }
}

module.exports = {
    cambiarModo,
    controlarBomba,
    configurarLimites
}
