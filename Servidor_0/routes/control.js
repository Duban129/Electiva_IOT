const { Router } = require('express');
const { cambiarModo, controlarBomba, configurarLimites } = require('../controllers/control');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();

// Todas las rutas de control requieren estar autenticado
router.use( validarJWT );

// Endpoint para autorizar el cambio auto/manual
router.post('/modo', cambiarModo );

// Endpoint para encender o apagar la bomba
router.post('/bomba', controlarBomba );

// Endpoint para parametrizar el llenado (setpoints)
router.post('/limites', configurarLimites );

module.exports = router;
