/**
 * Script de prueba para simular un sensor IoT enviando datos.
 * Uso: node scratch/test_mqtt.js <topic> <valor>
 * Ejemplo: node scratch/test_mqtt.js dispositivos/sensor1 25.5
 */
const mqtt = require('mqtt');
require('dotenv').config({ path: './.env' });

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org';
const topic = process.argv[2] || 'dispositivos/sensor1';
const value = process.argv[3] || Math.floor(Math.random() * 100);

console.log(`Conectando a ${brokerUrl}...`);
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
    console.log(`Publicando en ${topic}: ${value}`);
    client.publish(topic, value.toString(), { qos: 1 }, () => {
        console.log('Mensaje enviado!');
        client.end();
    });
});

client.on('error', (err) => {
    console.error('Error:', err);
    process.exit(1);
});
