/**
 * @fileoverview Punto de entrada principal de la aplicación.
 * Este archivo carga las variables de entorno e inicializa el servidor.
 */

// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

// Importa la clase Server que contiene la configuración del servidor Express
const Server = require('./lib/server');

/**
 * Instancia del servidor.
 * @type {Server}
 */
const server = new Server();

// Inicia el servidor y lo pone a escuchar peticiones
server.listen();