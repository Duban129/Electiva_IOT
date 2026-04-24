const express = require('express');
const cors = require('cors');
const { dbConnection } = require('../database/config');
const MqttClient = require('./mqtt-client');
const Usuario = require('../models/usuario');
const bcryptjs = require('bcryptjs');

/**
 * Clase que representa el servidor de la aplicación.
 * Configura los middlewares, las rutas y el puerto de escucha.
 */
class Server {

    constructor() {
        /**
         * Aplicación de Express.
         * @type {express.Application}
         */
        this.app  = express();

    /**
     * Puerto en el que correrá el servidor. Usa fallback 3000 si no está definida.
     * @type {string|number}
     */
    this.port = process.env.PORT || 3000;

    // Conectar a la base de datos (si la hay)
    this.conectarDB();

    // Inicializar cliente MQTT
    this.mqttClient = new MqttClient();
    this.app.set('mqttClient', this.mqttClient); // Permitir usar req.app.get('mqttClient') en los controllers

        /**
         * Ruta base para las APIs relacionadas con dispositivos.
         * @type {string}
         */
        this.dispositivosPath = '/api/dispositivos';
        this.authPath = '/api/auth';
        this.registrosPath = '/api/registros';
        this.datosPath = '/api/datos';
        this.controlPath = '/api/control';
        this.eventosPath = '/api/eventos';

        // Middlewares: Funciones que añaden funcionalidad al web server
        this.middlewares();

        // Rutas de mi aplicación
        this.routes();
    }

    /**
     * Inicializa la conexión a la base de datos.
     */
    async conectarDB() {
        await dbConnection();
        await this.crearAdminPorDefecto();
    }

    async crearAdminPorDefecto() {
        try {
            const adminExiste = await Usuario.findOne({ username: 'admin' });
            if (!adminExiste) {
                const usuario = new Usuario({
                    username: 'admin',
                    password: '123' // Temporal, se reemplaza abajo
                });
                const salt = bcryptjs.genSaltSync();
                usuario.password = bcryptjs.hashSync('admin', salt);
                await usuario.save();
                console.log('Usuario admin por defecto creado');
            }
        } catch (error) {
            console.error('Error creando admin:', error);
        }
    }

    /**
     * Define y configura los middlewares globales de la aplicación.
     */
    middlewares() {

        // CORS: Habilita el Intercambio de Recursos de Origen Cruzado
        this.app.use( cors() );

        // Lectura y parseo del body: Permite leer JSON en las peticiones
        this.app.use( express.json() );

        // Directorio Público: Define la carpeta para archivos estáticos
        this.app.use( express.static('public') );

    }

    /**
     * Define las rutas de la aplicación vinculando los endpoints con sus archivos de rutas.
     */
    routes() {
        this.app.use( this.authPath, require('../routes/auth'));
        this.app.use( this.dispositivosPath, require('../routes/dispositivos'));
        this.app.use( this.registrosPath, require('../routes/datos'));
        this.app.use( this.datosPath, require('../routes/datos'));
        this.app.use( this.controlPath, require('../routes/control'));
        this.app.use( this.eventosPath, require('../routes/eventos'));
    }

    /**
     * Inicia el servidor y lo pone a escuchar en el puerto especificado.
     */
    listen() {
        this.app.listen( this.port, () => {
            console.log('Servidor corriendo en puerto', this.port );
        });
    }

}

module.exports = Server;
