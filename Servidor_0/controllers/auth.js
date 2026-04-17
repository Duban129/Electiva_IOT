const { response } = require('express');
const bcryptjs = require('bcryptjs');
const Usuario = require('../models/usuario');
const { generarJWT } = require('../helpers/generar-jwt');

const login = async(req, res = response) => {
    const { username, password } = req.body;

    try {
        // Verificar si el usuario existe
        const usuario = await Usuario.findOne({ username });
        if ( !usuario ) {
            return res.status(400).json({
                msg: 'Usuario o contraseña no son correctos - correo'
            });
        }

        // Verificar si el usuario está activo
        if ( !usuario.estado ) {
            return res.status(400).json({
                msg: 'Usuario o contraseña no son correctos - estado: false'
            });
        }

        // Verificar la contraseña
        const validPassword = bcryptjs.compareSync( password, usuario.password );
        if ( !validPassword ) {
            return res.status(400).json({
                msg: 'Usuario o contraseña no son correctos - password'
            });
        }

        // Generar el JWT
        const token = await generarJWT( usuario.id );

        res.json({
            usuario,
            token
        })

    } catch (error) {
        console.log(error)
        res.status(500).json({
            msg: 'Hable con el administrador'
        });
    }
}

const updatePassword = async(req, res = response) => {
    const id = req.usuario.id;
    const { currentPassword, newPassword } = req.body;

    try {
        const usuario = await Usuario.findById(id);

        // Verificar password actual
        const validPassword = bcryptjs.compareSync( currentPassword, usuario.password );
        if ( !validPassword ) {
            return res.status(400).json({
                msg: 'La contraseña actual no es correcta'
            });
        }

        // Encriptar nueva contraseña
        const salt = bcryptjs.genSaltSync();
        usuario.password = bcryptjs.hashSync( newPassword, salt );

        await usuario.save();

        res.json({
            msg: 'Contraseña actualizada exitosamente',
            usuario
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: 'Hable con el administrador'
        });
    }
}

const revalidarToken = async(req, res = response ) => {
    const usuario = req.usuario;
    const token = await generarJWT( usuario.id );

    res.json({
        usuario,
        token
    })
}

module.exports = {
    login,
    updatePassword,
    revalidarToken
}
