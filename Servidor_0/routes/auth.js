const { Router } = require('express');
const { login, updatePassword, revalidarToken } = require('../controllers/auth');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();

router.post('/login', login );

// Necesita estar autenticado
router.put('/password', validarJWT, updatePassword );

// Revalidar token (para persistir sesión en SPA)
router.get('/renew', validarJWT, revalidarToken );

module.exports = router;
