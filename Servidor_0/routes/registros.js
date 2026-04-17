const { Router } = require('express');
const { obtenerRegistros, exportarCSV } = require('../controllers/registros');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();

// Endpoint para traer los registros de historial
router.get('/', validarJWT, obtenerRegistros );

// Endpoint para descargar en CSV
router.get('/exportar', exportarCSV);

module.exports = router;
