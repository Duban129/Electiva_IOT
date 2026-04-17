const { Router } = require('express');
const { obtenerEventos } = require('../controllers/eventos');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();

// Todas las rutas de historial están protegidas con el jwt del administrador
router.use( validarJWT );

// Obtener el historial paginado de eventos
router.get('/', obtenerEventos );

module.exports = router;
