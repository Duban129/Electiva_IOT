const { Router } = require('express');

// Importación de los controladores para las rutas de dispositivos
const { dispositivosGet,
        dispositivosPut,
        dispositivosPost,
        dispositivosDelete,
        dispositivosPatch } = require('../controllers/dispositivos');

const router = Router();

/**
 * @route GET /
 * Obtiene el listado de dispositivos.
 */
router.get('/', dispositivosGet );

/**
 * @route PUT /:id
 * Actualiza un dispositivo por su ID.
 */
router.put('/:id', dispositivosPut );

/**
 * @route POST /
 * Crea un nuevo dispositivo.
 */
router.post('/', dispositivosPost );

/**
 * @route DELETE /:id
 * Elimina un dispositivo.
 */
router.delete('/:id', dispositivosDelete );

/**
 * @route PATCH /
 * Realiza una actualización parcial de un dispositivo.
 */
router.patch('/', dispositivosPatch );

module.exports = router;
