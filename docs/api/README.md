# Mi Cancha API — guía de uso

API REST que respalda la app Flutter de negocios, el panel de super admin (`/admin`) y la web de reservas para jugadores (`/reservar`).

| Archivo | Qué es |
|---|---|
| [`ENDPOINTS.md`](ENDPOINTS.md) | Referencia de los endpoints: parámetros, bodies con sus validaciones, ejemplos y modelos de respuesta. |
| [`openapi.json`](openapi.json) | Especificación OpenAPI 3 (para Swagger UI, generadores de clientes, Insomnia…). |
| [`mi-cancha.postman_collection.json`](mi-cancha.postman_collection.json) | Colección de Postman lista para importar. |

Los tres se **generan del código** (decoradores de Swagger y DTOs) con:

```bash
npm run docs:api      # nest build + scripts/api-docs.mjs
```

Córrelo cada vez que agregues o cambies un endpoint o un DTO. No los edites a mano; esta guía sí se mantiene a mano.

## Entornos

| Entorno | Base URL | Swagger UI |
|---|---|---|
| Local | `http://localhost:3000/api/v1` | `http://localhost:3000/docs` |
| Producción | `https://app.micanchaapp.com/api/v1` | desactivado |

Todas las rutas llevan el prefijo `/api/v1`. Los cuerpos van en JSON (`Content-Type: application/json`) salvo la subida de imágenes, que es `multipart/form-data`.

## Autenticación

La API emite su propio JWT (por defecto dura 7 días, `JWT_EXPIRES_IN`). Envíalo en cada petición protegida:

```http
Authorization: Bearer <accessToken>
```

Todo endpoint exige token salvo los marcados como públicos (`/health`, logins y registros, `/public/*` e imágenes).

| Rol | Quién es | Cómo obtiene el token | Rutas |
|---|---|---|---|
| `ADMIN_NEGOCIO` | Dueño o administrador de una sede | `POST /auth/business/login` (o `register`) | `/business/*`, `/catalogs` |
| `JUGADOR` | Persona que reserva desde la web | `POST /public/auth/login` (celular o cédula) o `register`; en la app, `POST /auth/google` / `POST /auth/apple` | `/player/*` |
| `SUPER_ADMIN` | Equipo de Mi Cancha | `POST /auth/business/login` con su email | `/admin/*` |

`GET /auth/me` devuelve el usuario del token con cualquier rol.

```bash
curl -X POST http://localhost:3000/api/v1/auth/business/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@micancha.co","password":"<tu contraseña>"}'
# → { "accessToken": "eyJ…", "user": { "id": "…", "displayName": "…", "role": "ADMIN_NEGOCIO" } }
```

Los usuarios de demo existen solo con el seed completo en local (ver el README del repo). En producción no hay datos demo.

### Plan del negocio

Un `ADMIN_NEGOCIO` cuyo plan está suspendido (o sin plan) **solo puede leer**: cualquier `POST`, `PUT`, `PATCH` o `DELETE` responde `403` con `code: "SUBSCRIPTION_INACTIVE"`. El plan también limita cuántas canchas activas puede tener (`PLAN_LIMIT_REACHED`).

## Convenciones

- **Ids:** UUID. Un id mal formado en la ruta responde `400`.
- **Fechas y horas:** la API trabaja en la hora del negocio (`APP_UTC_OFFSET`, `-05:00` para Colombia).
  - Días: `YYYY-MM-DD` (p. ej. `date=2026-10-20`).
  - Instantes: ISO 8601 con desfase, p. ej. `2026-10-20T19:00:00-05:00`. Para reservar, `start` debe ser exactamente el inicio de un turno que devolvió la disponibilidad.
  - Horarios de cancha: `HH:mm` en hora local; si `closeTime` es menor que `openTime`, cierra al día siguiente.
- **Dinero:** números (pesos colombianos por defecto, `currency: "COP"`), hasta 2 decimales.
- **Catálogos:** servicios, métodos de pago y superficies se envían por su `code` (consúltalos en `GET /catalogs`). Los enums fijos (`Sport`, `DayOfWeek`, estados…) están en `GET /admin/enums` y en `ENDPOINTS.md`.
- **Paginación:** los listados paginados reciben `page` (desde 1) y `pageSize` (máx. 100, por defecto 20), y responden:

  ```json
  { "items": [ … ], "total": 57, "page": 1, "pageSize": 20 }
  ```

  Algunos endpoints cambian de forma según los parámetros: `GET /business/reservations` con `date` devuelve la agenda del día como lista, y sin `date` devuelve la página; `GET /business/customers` con `page` devuelve la cartera paginada con métricas, y sin `page` una búsqueda rápida (máx. 20).
- **Validación estricta:** los campos que no existen en el DTO se rechazan con `400`, no se ignoran.
- **Imágenes:** JPG o PNG de hasta 4 MB en el campo `image`. Las respuestas traen la URL pública (`/images/...`), que no caduca: cada foto nueva tiene un id nuevo.

## Errores

Todos los errores tienen la forma de Nest:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["slots must not be greater than 5"] }
```

`message` es un texto o, en errores de validación, una lista. Los errores de negocio que la app debe distinguir traen además un `code`:

```json
{ "statusCode": 409, "error": "Conflict", "code": "SLOT_HELD", "message": "Otra persona acaba de tomar ese turno. Elige otro horario." }
```

| Estado | Cuándo |
|---|---|
| `400` | Validación del body o de los parámetros; reglas de negocio (turno pasado, horarios inválidos…). |
| `401` | Falta el token, o es inválido o expiró. |
| `403` | El rol no tiene acceso al recurso, o lo impide el plan (ver códigos). |
| `404` | El registro no existe o no pertenece a tu negocio. |
| `409` | Conflicto: turno ya reservado, slug en uso, registro duplicado o dos operaciones que chocaron (reintenta). |
| `413` | Imagen de más de 4 MB. |
| `503` | `GET /health`: la base de datos no responde. |

| `code` | Estado | Significado |
|---|---|---|
| `SUBSCRIPTION_INACTIVE` | 403 | El plan del negocio no está activo: solo lectura. |
| `PLAN_INACTIVE` | 403 / 409 | Sin plan activo no se pueden habilitar canchas; en la web, la sede no recibe reservas. |
| `PLAN_LIMIT_REACHED` | 403 | El plan no permite más canchas activas. |
| `SLOT_HELD` | 409 | Otra persona apartó o tomó el turno. |
| `DISABLED` | 409 | El link de reservas en línea del negocio está desactivado. |
| `NO_COURTS` | 409 | El negocio no tiene canchas que se puedan reservar en línea. |

## Flujos principales

### Negocio: de cero a la primera reserva

1. `POST /auth/business/register` → token.
2. `PUT /business/profile` con los datos de la sede; `PUT /business/profile/image` para la portada.
3. `GET /catalogs` para los códigos de servicios, métodos de pago y superficies.
4. `POST /business/courts` con los 7 días en `schedules` y, si quieres, `rates` por franja. Luego sube las fotos con `PUT /business/courts/{id}/photos/{slot}` (`MAIN`, `SURFACE` y `LIGHTING` son obligatorias para que la cancha reciba reservas).
5. `GET /business/courts/{id}/availability?date=…` (o `GET /business/availability?sport=…&date=…` para todas las canchas de un deporte) → turnos `AVAILABLE`, `BOOKED` o `PAST` con su precio.
6. `POST /business/reservations` con `courtId` (o `sport`), `start`, `slots` (máx. 5 seguidos), el cliente (`customerId` o `customer` nuevo) y, opcional, `discount` y `payment`.
7. Después: `PATCH /business/reservations/{id}/status` (`COMPLETED`, `NO_SHOW`), `POST /business/reservations/{id}/cancel` con `reason` (libera el turno y devuelve los pagos, que aparecen en `GET /business/refunds`), y `POST /business/payments` para abonar saldos.

### Jugador: reservar desde el link público

1. `GET /public/businesses/{slug}` → datos de la sede (el slug lo da `GET /business/online-booking`).
2. `GET /public/businesses/{slug}/availability?sport=…&date=…` → turnos; `HELD` significa que otro jugador los está apartando.
3. `POST /public/auth/register` o `POST /public/auth/login` → token de jugador.
4. `PUT /player/businesses/{slug}/hold` aparta hasta 3 turnos por 3 minutos mientras confirma (reemplaza el apartado anterior; `DELETE` lo suelta).
5. `POST /player/businesses/{slug}/reservations` → reserva confirmada, se paga en efectivo en la sede.
6. `GET /player/businesses/{slug}/reservations` → sus reservas en esa sede.

### Super admin

`/admin/*` gestiona la plataforma: dashboard general, clientes (alta con usuario + negocio + plan, cambio de plan y suspensión), usuarios, planes y catálogos. Bajo `/admin/clients/{id}/…` puede ver y operar lo mismo que el negocio (canchas, disponibilidad, reservas, clientes, devoluciones, dashboard y link de reservas).

## Colección de Postman

1. En Postman: **Import** → `docs/api/mi-cancha.postman_collection.json`.
2. Revisa las variables de la colección: `baseUrl` (local por defecto; para producción `https://app.micanchaapp.com/api/v1`) y las credenciales `businessEmail` / `businessPassword` y `adminEmail` / `adminPassword`.
3. Corre los logins de **Salud y autenticación**: guardan `businessToken` y `adminToken`. El login o registro de jugador (en **Reservas en línea: público**) guarda `playerToken`. Cada carpeta usa el token de su rol.
4. Las variables de ids se llenan solas: los `POST` de creación guardan el id creado (`courtId`, `customerId`, `reservationId`, `clientId`, `planId`…), los listados guardan el primero si la variable está vacía, y `GET /business/online-booking` guarda el `slug`. `date` vale mañana si la dejas vacía.
5. Los parámetros de consulta opcionales vienen desactivados: actívalos en la pestaña **Params**. Para subir imágenes, elige el archivo en el campo `image` del body.

Las peticiones de escritura modifican datos reales: en producción úsalas con cuidado.
