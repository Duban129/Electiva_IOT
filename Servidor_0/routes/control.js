const { Router } = require('express');
const { cambiarModo, controlarBomba, configurarLimites, solicitarScanWifi, configurarWifi } = require('../controllers/control');
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

// Endpoint para escanear wifi
router.post('/wifi-scan', solicitarScanWifi );

// Endpoint para configurar wifi de respaldo
router.post('/wifi-config', configurarWifi );

module.exports = router;
