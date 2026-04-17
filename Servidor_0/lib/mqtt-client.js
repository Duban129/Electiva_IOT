const mqtt = require('mqtt');
const Dispositivo = require('../models/dispositivo');

class MqttClient {

    constructor() {
        this.brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org';
        this.client = null;
        this.connect();
    }

    connect() {
        console.log(`Intentando conectar a broker MQTT: ${this.brokerUrl}...`);
        
        this.client = mqtt.connect(this.brokerUrl);

        this.client.on('connect', () => {
            console.log('Cliente MQTT conectado exitosamente');
            // Suscribirse a todos los sub-topics de tanques: tanques/nivel/01, tanques/nivel/02, etc.
            // También mantenemos dispositivos/+ por compatibilidad
            const topics = ['tanques/#', 'dispositivos/+'];
            this.client.subscribe(topics, (err) => {
                if (!err) {
                    console.log('Suscrito exitosamente a:', topics.join(', '));
                } else {
                    console.error('Error al suscribir:', err);
                }
            });
        });

        this.client.on('message', async (topic, message) => {
            // El mensaje Buffer se convierte a string
            let payload = message.toString();
            console.log(`Mensaje recibido en topic [${topic}]: ${payload}`);

            // Intentar parsear el mensaje como JSON por si es complejo
            let valorAGuardar = payload;
            let esEscaneoWifi = false;
            let redesEscaneadas = [];
            try {
                const jsonObj = JSON.parse(payload);
                if (jsonObj.scan_redes) {
                    esEscaneoWifi = true;
                    redesEscaneadas = jsonObj.scan_redes;
                } else {
                    // Si envía json {"valor": 45}, tomamos eso, sino guardamos todo el json
                    valorAGuardar = jsonObj.valor !== undefined ? jsonObj.valor : jsonObj;
                }
            } catch (error) {
                // Si no es JSON válido, usamos el string plano
            }

            try {
                if (esEscaneoWifi) {
                    await Dispositivo.findOneAndUpdate(
                        { topic: topic },
                        { redesWiFi: redesEscaneadas },
                        { upsert: true }
                    );
                    console.log(`[MQTT] Escaneo de redes Wi-Fi guardado en dispositivo [${topic}]`);
                    return; // No guardar un registro de esto
                }

                // Preparamos los datos a actualizar/insertar
                let datosActualizar = { valor: valorAGuardar };
                
                // Si el JSON trae el nombre, lo usamos, si no, uno genérico al insertar
                if (valorAGuardar && valorAGuardar.nombre) {
                    datosActualizar.nombre = valorAGuardar.nombre;
                } else {
                    datosActualizar.$setOnInsert = { nombre: 'Dispositivo Autocreado' };
                }

                // Actualiza el dispositivo, y si no existe (porque se borró), lo crea (upsert: true)
                const dispositivoActualizado = await Dispositivo.findOneAndUpdate(
                    { topic: topic },
                    datosActualizar,
                    { new: true, upsert: true }
                );

                if (dispositivoActualizado) {
                    // Guardar en el historial (Registro)
                    const Registro = require('../models/registro');
                    const nuevoRegistro = new Registro({
                        dispositivo: dispositivoActualizado._id,
                        topic: topic,
                        valor: valorAGuardar
                    });
                    await nuevoRegistro.save();

                    // Aprovechamos y arreglamos el log para que no salga [object Object]
                    console.log(`Dispositivo [${dispositivoActualizado.nombre}] actualizado. Se agregó un nuevo Registro.`);
                } 
            } catch(dbError) {
                console.error('Error al actualizar en BD:', dbError);
            }
        });

        this.client.on('error', (err) => {
            console.error('Error en el cliente MQTT:', err.message);
            // No terminar el proceso, el cliente reintentará automáticamente
        });

        this.client.on('reconnect', () => {
            console.log('[MQTT] Reconectando al broker...');
        });

        this.client.on('offline', () => {
            console.warn('[MQTT] Sin conexión al broker. Esperando red...');
        });
    }

    publicarComando(topic, mensajeObj) {
        if (this.client && this.client.connected) {
            const msjStr = JSON.stringify(mensajeObj);
            this.client.publish(topic, msjStr, (err) => {
                if (err) {
                    console.error('Error publicando MQTT:', err);
                } else {
                    console.log(`MQTT Publicado [${topic}]: ${msjStr}`);
                }
            });
            return true;
        }
        console.warn('MQTT Cliente desconectado. No se puede publicar.');
        return false;
    }

}

module.exports = MqttClient;
