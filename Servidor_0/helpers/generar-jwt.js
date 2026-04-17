const jwt = require('jsonwebtoken');

const generarJWT = ( uid = '' ) => {
    return new Promise( (resolve, reject) => {
        const payload = { uid };
        const secret = process.env.SECRETORPRIVATEKEY || 'MiSecretoSuperSeguro123_ESP32';

        jwt.sign( payload, secret, {
            expiresIn: '4h'
        }, ( err, token ) => {
            if ( err ) {
                console.log(err);
                reject('No se pudo generar el token');
            } else {
                resolve( token );
            }
        });
    });
}

module.exports = {
    generarJWT
}
