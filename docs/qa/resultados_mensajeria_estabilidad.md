# Resultados de Pruebas – Mensajería (HB-09) y Estabilidad del Servidor (D-14)

**Proyecto:** Haitani + Sanzu
**Responsable de las pruebas:** Alberto Jiménez Olvera
**Fechas de ejecución:** 3 y 5 de noviembre de 2026
**Rama base:** `dev` (commit `0a79842`)
**Ambiente:** Desarrollo (Node.js 22 + PostgreSQL local) y app móvil contra una copia local de `main`

---

## 1. Resumen

| Conjunto | Archivo | Casos | Aprobados | Defectos encontrados |
|---|---|:---:|:---:|---|
| HB-09.1 Mensajes individuales y de grupo | `test/chat_mensajes.test.js` | 12 | 12 | OBS-08, OBS-09 |
| HB-09.2 Archivos en el chat | `test/chat_archivos.test.js` | 7 | 7 | — |
| D-14 Estabilidad, sesión y panel | `test/estabilidad_servidor.test.js` | 7 | 7 | OBS-10 |
| **Suite completa** (`npm test`) | `test/*.test.js` | **248** | **248** | 0 fallidas |

App móvil (repositorio MHS): 117 de 117 pruebas aprobadas en la versión 1.0.4.

---

## 2. HB-09.1 · Mensajes individuales y de grupo

| Caso | Resultado esperado | Resultado |
|---|---|:---:|
| Ana le escribe a Beto | Beto ve el mensaje una sola vez | Aprobado |
| Caro intenta ver la conversación de Ana y Beto | No la ve | Aprobado |
| Mensaje vacío o a uno mismo | Responde 400 | Aprobado |
| Grupo con Ana y Beto | Ambos ven los mensajes del grupo | Aprobado |
| Quien no es miembro del grupo lee o escribe | Responde 403 | Aprobado |
| Escribir a alguien de otra organización | Responde 404 | Aprobado |
| Otra organización abre la conversación o el grupo | No tiene acceso | Aprobado |
| Crear grupo con un usuario de otra organización | No queda como miembro (OBS-08) | Aprobado tras corrección |
| Agregar a un grupo a alguien de otra organización | Responde 404 | Aprobado |
| Mismo mensaje enviado tres veces al mismo tiempo | Se guarda una vez (OBS-09) | Aprobado tras corrección |
| Lo mismo en un grupo | Se guarda una vez | Aprobado |
| Los mensajes traen la foto del remitente | `sender_photo` presente | Aprobado |

## 3. HB-09.2 · Archivos en el chat

| Caso | Resultado esperado | Resultado |
|---|---|:---:|
| Enviar una imagen | El archivo se guarda y aparece una sola vez | Aprobado |
| Enviar un documento y descargarlo | El contenido es igual al que se subió | Aprobado |
| Mismo adjunto enviado dos veces al mismo tiempo | Un solo mensaje y un solo archivo | Aprobado |
| Imagen en un grupo | Los miembros la ven | Aprobado |
| Archivo `.exe` | Se rechaza y no se guarda nada | Aprobado |
| Archivo de más de 10 MB | Se rechaza | Aprobado |
| Otra organización descarga el adjunto | Responde 404 | Aprobado |

## 4. D-14 · Estabilidad del servidor, sesión y panel

| Caso | Resultado esperado | Resultado |
|---|---|:---:|
| Error dentro de una ruta `async` | Responde 500 y el servidor sigue atendiendo | Aprobado |
| `GET /api/organizations/usage` sin plan asignado | Responde 200 sin límites y `/api/health` sigue en 200 | Aprobado |
| Inicio de sesión | La cookie de sesión dura 30 días | Aprobado |
| Peticiones siguientes | La sesión se renueva (rolling) | Aprobado |
| Panel de un integrante con todo completado | 0 vencidas, sin tareas de otros | Aprobado |
| Panel de un integrante con tareas atrasadas | Solo sus propias vencidas | Aprobado |
| Panel del administrador | Vencidas de toda la organización | Aprobado |

### Reproducción de OBS-10 antes de la corrección

Sobre una copia local de `main` (`8d2da87`) con una organización sin plan:

```
GET /api/organizations/usage  -> sin respuesta (000)
GET /api/health               -> sin respuesta (000)
TypeError: Cannot read properties of undefined (reading 'subscription_status')
    at usage (server/controllers/organizationController.js:221)
```

Con la corrección, la misma secuencia responde `200` en ambas rutas.

### Recorrido de la app móvil 1.0.4

Se recorrieron con Playwright (versión web de la app) Inicio, Panel de administración, Chat (directo y grupo), Tareas, Archivos y Más, como administrador y como integrante:

- El Panel de administración ya no provoca la caída del servidor.
- Una imagen cuyo archivo ya no existe muestra "Imagen no disponible" en lugar de quedarse cargando.
- Un mensaje enviado con varios toques seguidos aparece una sola vez.
- El integrante ve "Mi avance" con sus propias tareas.

---

## 5. Cómo volver a ejecutar

```
npm test
node --test test/chat_mensajes.test.js test/chat_archivos.test.js test/estabilidad_servidor.test.js
```
