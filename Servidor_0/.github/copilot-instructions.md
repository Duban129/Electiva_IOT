## Propósito
Este proyecto es una API Express mínima para gestionar "dispositivos". El objetivo de estas instrucciones es dar al agente AI contexto directo y accionable para ser productivo (añadir rutas, controladores, middlewares y editar configuración). Evita suposiciones no verificadas: sigue los patrones y archivos existentes.

## Visión general (big picture)
- Entrada: `app.js` carga variables de entorno y crea/lanza `lib/server.js`.
- Configuración del servidor: `lib/server.js` instancia Express, configura middlewares, rutas y sirve estático desde `public/`.
- Rutas: `routes/dispositivos.js` define los endpoints y delega en `controllers/dispositivos.js`.
- Controladores: `controllers/dispositivos.js` devuelve JSON (datos de ejemplo). Actualmente no hay persistencia (no hay base de datos).

## Comandos y flujo de desarrollo
- Inicio en producción: `npm start` (usa `node app.js`).
- Inicio en desarrollo: `npm run dev` (usa `nodemon app.js`).
- Variables importantes: `PORT` se lee en `lib/server.js` como `process.env.PORT`. Asegúrate de que exista un `.env` con `PORT` o añade un valor por defecto si añades robustez.

## Convenciones del proyecto (observadas)
- Estructura MVC ligera: `routes/*` -> `controllers/*`. No hay `services/` ni `models/` de datos actualmente.
- Controladores exportan funciones nombradas (ej. `dispositivosGet`, `dispositivosPost`) y aceptan `(req, res)` con JSDoc arriba.
- Rutas usan la ruta base `'/api/dispositivos'` registrada en `lib/server.js`.
- Middleware global: en `Server.middlewares()` (añadir logging, autenticación u otras capas aquí).
- Archivos estáticos servidos desde la carpeta `public` con `express.static('public')`.

## Patrones y detalles específicos a respetar
- Cuando añadas nuevas rutas, crea un archivo en `routes/` y registra en `lib/server.js` usando `this.app.use(this.<path>, require('./routes/xxx'))`.
- Los controladores actuales devuelven objetos JSON con claves `msg` y datos de ejemplo; mantén formatos consistentes para evitar romper clientes.
- Notar inconsistencia en rutas: `PUT /:id` espera `:id`, pero `DELETE` y `PATCH` están definidos sin `/:id`. Si introduces endpoints que modifican recursos por id, predomina el patrón RESTful con `/:id` para PUT/DELETE/PATCH.

## Integraciones y dependencias
- Dependencias en `package.json`: `express`, `cors`, `dotenv`.
- No hay integración con base de datos ni servicios externos visibles. Cualquier añadido (p. ej. MongoDB) debería centralizarse en nuevos módulos `models/` o `services/`.

## Ejemplos concretos (útiles para pruebas y para el agente)
- Obtener dispositivos (mock):
  - GET http://localhost:PORT/api/dispositivos
- Crear dispositivo (mock):
  - POST http://localhost:PORT/api/dispositivos  Body JSON: { "nombre": "Sensor1", "tipo": "temperatura" }

## Qué cambiar y dónde (guía rápida para commits)
- Añadir nueva ruta: 1) `routes/miRecurso.js` 2) `controllers/miRecurso.js` 3) registrar en `lib/server.js` en `routes()` 4) actualizar `package.json` o docs si hay scripts nuevos.
- Añadir middleware: modificar `middlewares()` en `lib/server.js`.
- Añadir variable de configuración: usar `dotenv` y validar en `app.js` o `lib/server.js` (agregar fallback si es necesario).

## Reglas para el agente AI al modificar código
1. Mantén el estilo: JSDoc en controladores y comentarios en español como en el repositorio.
2. Evita romper la API pública: respeta las rutas existentes `/api/dispositivos` y la forma de respuesta JSON.
3. Si cambias la forma de respuesta (nombres de campos o estructura), actualiza también ejemplos en controladores y documenta en este archivo.
4. Añade pruebas mínimas o un script de smoke-test si introduces cambios en comportamiento crítico.

## Cosas a preguntar al autor si aparecen en un PR
- ¿Deseas persistencia (DB)? Si sí, ¿qué motor preferido? (Mongo, Postgres...)
- ¿Qué comportamiento quieres para variables de entorno no definidas (p. ej. `PORT`)?

Si algo no está claro o quieres que añada ejemplos curl/PR templates o tests, dime qué prefieres y lo actualizo.