const { Router } = require('express');
const { datosGet, datosPost } = require('../controllers/datos');

const router = Router();

/**
 * @route GET /api/datos
 * Obtiene el historial de datos de los sensores.
 */
router.get('/', datosGet );

/**
 * @route POST /api/datos
 * Registra un nuevo dato de un sensor.
 */
router.post('/', datosPost );

module.exports = router;
