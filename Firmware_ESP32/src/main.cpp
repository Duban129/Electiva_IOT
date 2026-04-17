/**
 * ============================================================
 * SISTEMA DE MONITOREO DE NIVEL DE TANQUE
 * ============================================================
 * Proyecto  : Electiva - Monitoreo IoT
 * Archivo   : src/main.cpp  (PlatformIO)
 * Placa     : ESP32-S3 DevKitC-1
 *
 * Hardware:
 *   - Sensor    : GL-A02 (ultrasónico RS485 Modbus RTU)
 *   - Módem     : A7672S (CAT-1, MQTT vía comandos AT)
 *
 * Flujo de datos:
 *   GL-A02 ─[RS485/Modbus]─> ESP32-S3 ─[UART/AT]─> A7672S ─[4G]─> Broker MQTT
 *                                                                        │
 *                                                                  Servidor Linux
 *                                                                   Node.js + MongoDB
 *
 * Mapa de pines:
 *   ┌──────────────┬────────┐
 *   │ RS485 TX     │ GPIO 7 │
 *   │ RS485 RX     │ GPIO 8 │
 *   │ RS485 RE/DE  │ GPIO 21│  HIGH = transmitir, LOW = recibir
 *   │ Módem TX     │ GPIO 17│  (conectar al RX del A7672S)
 *   │ Módem RX     │ GPIO 18│  (conectar al TX del A7672S)
 *   │ Módem KEY    │ GPIO 4 │  pulso 2s para encender
 *   └──────────────┴────────┘
 * ============================================================
 */

#include <Arduino.h>   // ← OBLIGATORIO en PlatformIO
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>


// ─── Pines ────────────────────────────────────────────────────
#define RS485_TX    7
#define RS485_RX    8
#define RS485_EN    21   // RE/DE - control de dirección del bus RS485
#define CAT_TX      17   // Conectar a RXD del A7672S
#define CAT_RX      18   // Conectar a TXD del A7672S
#define CAT_KEY     4    // Pin de encendido del A7672S
#define PIN_BOMBA   12   // Pin para accionar el Relé de la Bomba

// ─── Puertos Series ───────────────────────────────────────────
// Serial1 → Sensor GL-A02 (RS485)
// Serial2 → Módem A7672S
HardwareSerial RS485Serial(1);
HardwareSerial ModemSerial(2);

// ─── Configuración MQTT ───────────────────────────────────────
// ⚠️  Si tu servidor Linux tiene IP pública, cámbiala aquí.
//     Para pruebas, "test.mosquitto.org" sirve sin autenticación.
const char* BROKER_IP   = "test.mosquitto.org";
const int   BROKER_PORT = 1883;
const char* MQTT_TOPIC  = "tanques/nivel/01";
const char* CLIENT_ID   = "ESP32_Tanque_01";
const char* APN         = "internet.comcel.com.co"; // Cambia esto según tu país/operador

// ─── Configuración Wi-Fi ──────────────────────────────────────
const char* WIFI_SSID     = "CAREPIK";      // PON AQUÍ TU RED WI-FI
const char* WIFI_PASSWORD = "1065096235";  // PON AQUÍ TU CONTRASEÑA

WiFiClient espClient;
PubSubClient mqttWiFiClient(espClient);

// ─── Trama Modbus RTU del GL-A02 ─────────────────────────────
// Lee el registro 0x0101 (distancia en mm)
// [ID][FC][Reg_Hi][Reg_Lo][Cant_Hi][Cant_Lo][CRC_Lo][CRC_Hi]
const byte MODBUS_REQUEST[] = {0x01, 0x03, 0x01, 0x01, 0x00, 0x01, 0xD4, 0x36};
const int  MODBUS_RESP_LEN  = 7;

// ─── Variables globales ────────────────────────────────────────
bool modemListo = false;
unsigned long ultimaPublicacion = 0;
const unsigned long INTERVALO_MS = 3000; // Publicar cada 3 segundos

bool esModoAutomatico = false; // Arranca en modo manual por defecto
bool estadoBomba = false; // Falso = apagada, Verdadero = encendida

int limiteBajo = 500;
int limiteAlto = 2900;

// ─── Prototipos de funciones ───────────────────────────────────
void encenderModem();
bool inicializarModem();
bool configurarAPN();
bool diagnosticarModem();
int  leerSensorRS485();
void publicarMQTT(int nivel); // Módem
void setupWiFi();
bool reconnectMQTTWiFi();
void publicarMQTTWiFi(int nivel);
void mqttDisconnect();
void mqttRelease();
void mqttStop();
bool enviarComandoAT(const char* cmd, const char* respEsperada, int timeoutMs);
String enviarComandoATRespuesta(const char* cmd, int timeoutMs);
void mqttCallback(char* topic, byte* payload, unsigned int length);

// ══════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    while (!Serial) {
        delay(10); // Espera a que el puerto USB se abra
    }
    Serial.println("¡Monitor conectado con éxito!");
    delay(1000);
    Serial.println("=== Sistema de Nivel de Tanque - Iniciando ===");

    // ── 1. RS485 ────────────────────────────────────────────
    pinMode(RS485_EN, OUTPUT);
    digitalWrite(RS485_EN, LOW); // Modo recepción por defecto
    RS485Serial.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
    Serial.println("[RS485] Listo");

    // ── 2. Serial del módem ─────────────────────────────────
    ModemSerial.begin(115200, SERIAL_8N1, CAT_RX, CAT_TX);
    Serial.println("[MODEM] Serial inicializado");

    // ── 2.1 Configuración Pin Bomba ─────────────────────────
    pinMode(PIN_BOMBA, OUTPUT);
    digitalWrite(PIN_BOMBA, LOW); // Bomba apagada inicialmente
    Serial.println("[BOMBA] Pin del Relé configurado");

    // ── 3. Inicializar Wi-Fi ───────────────────────────────────
    setupWiFi();

    // ── 4. Encender y probar el A7672S (DESHABILITADO TEMPORALMENTE) ───
    // encenderModem();
    // diagnosticarModem();
    // modemListo = inicializarModem();
    modemListo = false; // Forzamos apagado para pruebas exclusivas de Wi-Fi

    if (modemListo) {
        Serial.println("[MODEM] ✓ Listo para enviar datos");
    } else {
        Serial.println("[MODEM] Módulo inhabilitado para pruebas Wi-Fi");
    }
}

// ══════════════════════════════════════════════════════════════
// LOOP PRINCIPAL
// ══════════════════════════════════════════════════════════════
void loop() {
    if (millis() - ultimaPublicacion >= INTERVALO_MS) {
        ultimaPublicacion = millis();

        Serial.println("\n--- Nuevo ciclo de lectura ---");

        // PASO 1: Leer el sensor ultrasónico por RS485
        int nivelMM = leerSensorRS485();
        if (nivelMM < 0) {
            Serial.println("[SENSOR] Lectura inválida, omitiendo publicación.");
            return;
        }
        Serial.printf("[SENSOR] Nivel leído: %d mm\n", nivelMM);

        // LÓGICA AUTOMÁTICA DE CONTROL DE LA BOMBA
        if (esModoAutomatico) {
            if (nivelMM <= limiteBajo && !estadoBomba) {    // Si el tanque está vacío
                digitalWrite(PIN_BOMBA, HIGH);
                estadoBomba = true;
                Serial.printf("[AUTO] Nivel bajo detectado (%d mm) -> Bomba ENCENDIDA\n", nivelMM);
            } else if (nivelMM >= limiteAlto && estadoBomba) { // Si el tanque se va a desbordar
                digitalWrite(PIN_BOMBA, LOW);
                estadoBomba = false;
                Serial.printf("[AUTO] Tanque lleno (%d mm) -> Bomba APAGADA\n", nivelMM);
            }
        }

        // PASO 2: Verificar conexión y publicar por MQTT (Prioridad Wi-Fi)
        if (WiFi.status() == WL_CONNECTED) {
            if (!mqttWiFiClient.connected()) {
                reconnectMQTTWiFi();
            }
            if (mqttWiFiClient.connected()) {
                publicarMQTTWiFi(nivelMM);
                mqttWiFiClient.loop();
            } else {
                Serial.println("[MQTT-WIFI] Fallo al conectar. Intentando módem celular...");
                goto usar_modem;
            }
        } else {
            Serial.println("[WIFI] Desconectado. Intentando módem celular...");
usar_modem:
            if (modemListo) {
                if (diagnosticarModem()) {
                    publicarMQTT(nivelMM);
                } else {
                    Serial.println("[MQTT-MODEM] Diagnóstico falló, reintentando inicialización...");
                    modemListo = inicializarModem();
                }
            } else {
                Serial.println("[MQTT-MODEM] Módem no listo, reintentando...");
                modemListo = inicializarModem();
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Encender el Módem A7672S
// Emite un pulso de 2 segundos en el pin KEY
// ══════════════════════════════════════════════════════════════
void encenderModem() {
    Serial.println("[MODEM] Encendiendo (pulso 2s en GPIO 4)...");
    pinMode(CAT_KEY, OUTPUT);
    digitalWrite(CAT_KEY, LOW);
    delay(200);
    digitalWrite(CAT_KEY, HIGH);
    delay(2000);   // El A7672S detecta el pulso largo como "encender"
    digitalWrite(CAT_KEY, LOW);
    Serial.println("[MODEM] Esperando arranque (10s)...");
    delay(10000);  // Tiempo para que el módem se registre en la red
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Inicializar el Módem y verificar conexión a internet
// ══════════════════════════════════════════════════════════════
bool inicializarModem() {
    Serial.println("[MODEM] Inicializando...");

    if (!enviarComandoAT("AT", "OK", 3000)) return false;
    enviarComandoAT("ATE0", "OK", 2000);  // Desactivar eco

    if (!configurarAPN()) {
        Serial.println("[MODEM] ✗ No se pudo configurar el APN");
        return false;
    }

    // Esperar registro en la red celular (máx. 60 segundos)
    Serial.println("[MODEM] Esperando cobertura celular...");
    for (int i = 0; i < 12; i++) {
        String resp = enviarComandoATRespuesta("AT+CREG?", 3000);
        Serial.printf("  << AT+CREG? -> %s\n", resp.c_str());
        // +CREG: 0,1 → registrado en red local
        // +CREG: 0,5 → registrado en roaming
        if (resp.indexOf(",1") >= 0 || resp.indexOf(",5") >= 0) {
            Serial.println("[MODEM] ✓ Registrado en red celular");
            break;
        }
        delay(5000);
        if (i == 11) {
            Serial.println("[MODEM] ✗ Sin cobertura. Verifica antena y SIM.");
            String csq = enviarComandoATRespuesta("AT+CSQ", 3000);
            Serial.printf("[MODEM] Señal: %s\n", csq.c_str());
            return false;
        }
    }

    // Verificar o activar contexto de datos (internet)
    if (!enviarComandoAT("AT+CGATT?", "+CGATT: 1", 5000)) {
        if (!enviarComandoAT("AT+CGATT=1", "OK", 10000)) {
            Serial.println("[MODEM] ✗ No se pudo activar la conexión de datos");
            return false;
        }
    }

    if (!enviarComandoAT("AT+CGACT=1,1", "OK", 10000)) {
        Serial.println("[MODEM] ✗ No se pudo activar el contexto PDP");
        return false;
    }

    Serial.println("[MODEM] ✓ Acceso a internet activo");
    return true;
}

bool configurarAPN() {
    String cmd = String("AT+CGDCONT=1,\"IP\",\"") + APN + "\"";
    if (!enviarComandoAT(cmd.c_str(), "OK", 5000)) {
        return false;
    }
    Serial.printf("[MODEM] APN configurado: %s\n", APN);
    return true;
}

bool diagnosticarModem() {
    Serial.println("[DIAG] Iniciando diagnóstico del módem...");

    if (!enviarComandoAT("AT", "OK", 3000)) {
        Serial.println("[DIAG] El módem no responde a AT. Verifica UART y alimentación.");
        return false;
    }

    String resp;
    resp = enviarComandoATRespuesta("AT+CPIN?", 3000);
    Serial.printf("  << AT+CPIN? -> %s\n", resp.c_str());

    resp = enviarComandoATRespuesta("AT+CSQ", 3000);
    Serial.printf("  << AT+CSQ -> %s\n", resp.c_str());

    resp = enviarComandoATRespuesta("AT+COPS?", 3000);
    Serial.printf("  << AT+COPS? -> %s\n", resp.c_str());

    resp = enviarComandoATRespuesta("AT+CPSI?", 3000);
    Serial.printf("  << AT+CPSI? -> %s\n", resp.c_str());

    resp = enviarComandoATRespuesta("AT+CBC", 3000);
    Serial.printf("  << AT+CBC -> %s\n", resp.c_str());

    return true;
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Leer Sensor GL-A02 vía RS485 (Modbus RTU)
//
// Protocolo de la respuesta del sensor (7 bytes):
//   [01]   → Dirección del esclavo
//   [03]   → Código de función
//   [02]   → Bytes de dato que siguen
//   [XX]   → Byte alto de la distancia
//   [XX]   → Byte bajo de la distancia
//   [CRC_L][CRC_H]
// ══════════════════════════════════════════════════════════════
int leerSensorRS485() {
    // Limpiar cualquier basura en el buffer
    while (RS485Serial.available()) RS485Serial.read();

    // Cambiar el transceptor a modo TRANSMISIÓN
    digitalWrite(RS485_EN, HIGH);
    delayMicroseconds(100);

    // Enviar la trama de solicitud Modbus
    RS485Serial.write(MODBUS_REQUEST, sizeof(MODBUS_REQUEST));
    RS485Serial.flush();

    // Volver a modo RECEPCIÓN inmediatamente
    delayMicroseconds(100);
    digitalWrite(RS485_EN, LOW);

    // Esperar los 7 bytes de respuesta (timeout: 200ms)
    unsigned long t = millis();
    while (RS485Serial.available() < MODBUS_RESP_LEN) {
        if (millis() - t > 200) {
            Serial.println("[SENSOR] Timeout: sin respuesta del GL-A02");
            return -1;
        }
    }

    byte resp[MODBUS_RESP_LEN];
    RS485Serial.readBytes(resp, MODBUS_RESP_LEN);

    // Imprimir bytes recibidos para depuración
    Serial.print("[SENSOR] Raw HEX: ");
    for (int i = 0; i < MODBUS_RESP_LEN; i++) {
        Serial.printf("%02X ", resp[i]);
    }
    Serial.println();

    // Validar que la respuesta pertenece al dispositivo correcto
    if (resp[0] != 0x01 || resp[1] != 0x03 || resp[2] != 0x02) {
        Serial.println("[SENSOR] Trama Modbus inválida");
        return -1;
    }

    // Los bytes [3] y [4] contienen la distancia en mm (Big-Endian)
    return (resp[3] << 8) | resp[4];
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Publicar dato de nivel vía MQTT usando comandos AT
//
// Secuencia de comandos AT (A7672S):
//   AT+CMQTTSTART    → Iniciar servicio MQTT del módulo
//   AT+CMQTTACCQ     → Crear una instancia de cliente MQTT
//   AT+CMQTTCONNECT  → Conectar al broker (IP:puerto)
//   AT+CMQTTTOPIC    → Especificar el topic de publicación
//   AT+CMQTTPAYLOAD  → Escribir el mensaje JSON
//   AT+CMQTTPUB      → Publicar (QoS 1 = confirmación del broker)
//   AT+CMQTTDISC     → Desconectar del broker
//   AT+CMQTTREL      → Liberar la instancia del cliente
//   AT+CMQTTSTOP     → Detener el servicio MQTT
// ══════════════════════════════════════════════════════════════
void publicarMQTT(int nivel) {
    // Construir JSON: {"nombre":"Tanque Principal","nivel":1616}
    char payload[80];
    snprintf(payload, sizeof(payload),
             "{\"nombre\":\"Tanque Principal\",\"nivel\":%d}", nivel);
    int payloadLen = strlen(payload);

    Serial.printf("[MQTT] Topic: %s\n", MQTT_TOPIC);
    Serial.printf("[MQTT] Payload: %s\n", payload);

    // 1. Iniciar servicio MQTT
    if (!enviarComandoAT("AT+CMQTTSTART", "+CMQTTSTART: 0", 5000)) {
        Serial.println("[MQTT] Error: no se pudo iniciar el servicio MQTT");
        return;
    }

    // 2. Adquirir cliente con Client ID único
    String cmdAccq = "AT+CMQTTACCQ=0,\"" + String(CLIENT_ID) + "\"";
    if (!enviarComandoAT(cmdAccq.c_str(), "OK", 3000)) {
        Serial.println("[MQTT] Error: no se pudo crear el cliente MQTT");
        mqttStop();
        return;
    }

    // 3. Conectar al broker
    String cmdConn = "AT+CMQTTCONNECT=0,\"tcp://" +
                     String(BROKER_IP) + ":" + String(BROKER_PORT) + "\",60,1";
    if (!enviarComandoAT(cmdConn.c_str(), "+CMQTTCONNECT: 0,0", 15000)) {
        Serial.println("[MQTT] Error: no se pudo conectar al broker. Verifica IP y red.");
        mqttRelease();
        mqttStop();
        return;
    }
    Serial.println("[MQTT] ✓ Conectado al broker");

    // 4. Definir topic (longitud del string del topic)
    String cmdTopic = "AT+CMQTTTOPIC=0," + String(strlen(MQTT_TOPIC));
    if (!enviarComandoAT(cmdTopic.c_str(), ">", 3000)) {
        Serial.println("[MQTT] Error configurando topic");
        mqttDisconnect(); mqttRelease(); mqttStop();
        return;
    }
    ModemSerial.print(MQTT_TOPIC);
    delay(500);

    // 5. Escribir el payload JSON
    String cmdPayload = "AT+CMQTTPAYLOAD=0," + String(payloadLen);
    if (!enviarComandoAT(cmdPayload.c_str(), ">", 3000)) {
        Serial.println("[MQTT] Error configurando payload");
        mqttDisconnect(); mqttRelease(); mqttStop();
        return;
    }
    ModemSerial.print(payload);
    delay(500);

    // 6. Publicar con QoS 1 (el broker confirma recepción)
    //    AT+CMQTTPUB=<índice>,<QoS>,<timeout>,<retain>
    if (!enviarComandoAT("AT+CMQTTPUB=0,1,60,0", "+CMQTTPUB: 0,0", 10000)) {
        Serial.println("[MQTT] ✗ Fallo al publicar");
    } else {
        Serial.printf("[MQTT] ✓ DATO ENVIADO: %d mm → Servidor Linux recibirá el JSON\n", nivel);
        Serial.println("[MQTT]   Node.js procesará el mensaje y actualizará MongoDB.");
    }

    // 7-9. Limpiar sesión
    mqttDisconnect();
    mqttRelease();
    mqttStop();
}

// ─── Funciones auxiliares de limpieza MQTT ─────────────────────
void mqttDisconnect() { enviarComandoAT("AT+CMQTTDISC=0,120", "+CMQTTDISC: 0,0", 5000); }
void mqttRelease()    { enviarComandoAT("AT+CMQTTREL=0", "OK", 3000); }
void mqttStop()       { enviarComandoAT("AT+CMQTTSTOP", "+CMQTTSTOP: 0", 3000); }

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Enviar comando AT y verificar si la respuesta contiene
//          el substring esperado. Retorna true si coincide.
// ══════════════════════════════════════════════════════════════
bool enviarComandoAT(const char* cmd, const char* respEsperada, int timeoutMs) {
    while (ModemSerial.available()) ModemSerial.read(); // Limpiar buffer

    Serial.printf("  >> %s\n", cmd);
    ModemSerial.println(cmd);

    String buffer = "";
    unsigned long inicio = millis();

    while (millis() - inicio < timeoutMs) {
        while (ModemSerial.available()) {
            buffer += (char)ModemSerial.read();
        }
        if (buffer.indexOf(respEsperada) >= 0) {
            Serial.printf("  << ✓ (%s encontrado)\n", respEsperada);
            return true;
        }
        if (buffer.indexOf("ERROR") >= 0) {
            Serial.printf("  << ✗ ERROR: %s\n", buffer.c_str());
            return false;
        }
        delay(10);
    }
    Serial.printf("  << TIMEOUT. Buffer: %s\n", buffer.c_str());
    return false;
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Enviar comando AT y retornar la respuesta completa
//          (usada para comandos de consulta como AT+CREG?)
// ══════════════════════════════════════════════════════════════
String enviarComandoATRespuesta(const char* cmd, int timeoutMs) {
    while (ModemSerial.available()) ModemSerial.read();
    ModemSerial.println(cmd);

    String buffer = "";
    unsigned long inicio = millis();
    while (millis() - inicio < timeoutMs) {
        while (ModemSerial.available()) {
            buffer += (char)ModemSerial.read();
        }
    }
    return buffer;
}

// ══════════════════════════════════════════════════════════════
// FUNCIONES WI-FI & MQTT LOCAL
// ══════════════════════════════════════════════════════════════

void setupWiFi() {
    Serial.println();
    Serial.print("[WIFI] Conectando a ");
    Serial.println(WIFI_SSID);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int intentos = 0;
    while (WiFi.status() != WL_CONNECTED && intentos < 20) {
        delay(500);
        Serial.print(".");
        intentos++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("");
        Serial.println("[WIFI] ✓ Conectado");
        Serial.print("[WIFI] IP local: ");
        Serial.println(WiFi.localIP());
        
        // Configuramos el servidor usando las mismas constantes del módem
        mqttWiFiClient.setServer(BROKER_IP, BROKER_PORT);
        mqttWiFiClient.setCallback(mqttCallback);
    } else {
        Serial.println("");
        Serial.println("[WIFI] ✗ No se pudo conectar (timeout). Se priorizará el módem celular.");
    }
}

bool reconnectMQTTWiFi() {
    Serial.print("[MQTT-WIFI] Conectando al broker...");
    // Intentamos conectar usando nuestro ID
    if (mqttWiFiClient.connect(CLIENT_ID)) {
        Serial.println(" ✓ Conectado");
        mqttWiFiClient.subscribe("tanques/control");
        Serial.println("[MQTT-WIFI] Suscrito a topic: tanques/control");
        return true;
    } else {
        Serial.print(" ✗ Falló, rc=");
        Serial.print(mqttWiFiClient.state());
        Serial.println(" (se reintentará).");
        return false;
    }
}

void publicarMQTTWiFi(int nivel) {
    char payload[100];
    snprintf(payload, sizeof(payload),
             "{\"nombre\":\"Tanque Principal\",\"valor\":%d,\"bomba\":%s,\"modo\":\"%s\"}", 
             nivel, estadoBomba ? "true" : "false", esModoAutomatico ? "automatico" : "manual");

    Serial.printf("[MQTT-WIFI] Topic: %s\n", MQTT_TOPIC);
    Serial.printf("[MQTT-WIFI] Payload: %s\n", payload);

    if (mqttWiFiClient.publish(MQTT_TOPIC, payload)) {
        Serial.printf("[MQTT-WIFI] ✓ DATO ENVIADO POR WI-FI: %d mm\n", nivel);
    } else {
        Serial.println("[MQTT-WIFI] ✗ Error al publicar el mensaje");
    }
}

// ══════════════════════════════════════════════════════════════
// FUNCIÓN: Callback para recibir comandos MQTT
// ══════════════════════════════════════════════════════════════
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    Serial.printf("\n[MQTT] Mensaje recibido en topic [%s]\n", topic);
    
    // Convertir el payload a un String
    String msj = "";
    for (unsigned int i = 0; i < length; i++) {
        msj += (char)payload[i];
    }
    Serial.printf("[MQTT] Contenido: %s\n", msj.c_str());

    // Parsear el JSON recibido usando ArduinoJson
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, msj);

    if (error) {
        Serial.printf("[MQTT] Error al parsear JSON: %s\n", error.c_str());
        return;
    }

    // Comprobar si se envió un comando de cambio de modo
    if (doc.containsKey("modo")) {
        String nuevoModo = doc["modo"].as<String>();
        if (nuevoModo == "automatico") {
            esModoAutomatico = true;
            Serial.println(">>> ACTIVADO MODO: AUTOMÁTICO <<<");
        } else if (nuevoModo == "manual") {
            esModoAutomatico = false;
            Serial.println(">>> ACTIVADO MODO: MANUAL <<<");
        }
    }

    // Comprobar si se envió una orden directa a la bomba (sólo funciona si en manual, o si es apagado de emergencia)
    if (doc.containsKey("bomba")) {
        String ordenBomba = doc["bomba"].as<String>();
        
        // El servidor apagará forzosamente la bomba si hay desbordamiento en manual.
        // O si el usuario pulsó los botones manuales.
        if (ordenBomba == "on") {
            if (!esModoAutomatico) {
                digitalWrite(PIN_BOMBA, HIGH);
                estadoBomba = true;
                Serial.println(">>> BOMBA ENCENDIDA (MANUAL) <<<");
            } else {
                Serial.println("[MQTT] Comando 'on' ignorado (estamos en Auto)");
            }
        } else if (ordenBomba == "off") {
            digitalWrite(PIN_BOMBA, LOW);
            estadoBomba = false;
            if (!esModoAutomatico) {
                Serial.println(">>> BOMBA APAGADA (MANUAL) <<<");
            } else {
                Serial.println(">>> BOMBA APAGADA (FORZADA/EMERGENCIA) <<<");
            }
        }
    }

    // Comprobar si recibimos configuración de setpoints
    if (doc.containsKey("setpoint_bajo") && doc.containsKey("setpoint_alto")) {
        limiteBajo = doc["setpoint_bajo"].as<int>();
        limiteAlto = doc["setpoint_alto"].as<int>();
        Serial.printf(">>> LÍMITES RECONFIGURADOS -> Bajo: %d mm | Alto: %d mm <<<\n", limiteBajo, limiteAlto);
    }
}

