# Mi Cancha API — referencia de endpoints

> Generado por `npm run docs:api` a partir del código (decoradores de Swagger y DTOs). No lo edites a mano.
> Guía de uso (autenticación, errores, flujos): [README.md](README.md).

Base URL: `http://localhost:3000/api/v1` (local) · `https://mi-cancha-api.vercel.app/api/v1` (producción). 88 endpoints.

- [Salud y autenticación](#salud-y-autenticación) (6)
- [Negocio (app y panel)](#negocio-app-y-panel) (32)
- [Reservas en línea: público](#reservas-en-línea-público) (4)
- [Reservas en línea: jugador](#reservas-en-línea-jugador) (6)
- [Super admin](#super-admin) (38)
- [Imágenes](#imágenes) (2)
- [Modelos de respuesta](#modelos-de-respuesta) (74)

## Salud y autenticación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API y de la base de datos |
| POST | `/auth/business/register` | Registrar un administrador de negocio |
| POST | `/auth/business/login` | Iniciar sesión como negocio (email y contraseña) |
| POST | `/auth/google` | Iniciar sesión como jugador con Google |
| POST | `/auth/apple` | Iniciar sesión como jugador con Apple |
| GET | `/auth/me` | Usuario autenticado |

### health

#### `GET /health`

Estado de la API y de la base de datos

- **Acceso:** público
- **Respuesta:** `200` · [HealthDto](#healthdto)

### auth

#### `POST /auth/business/register`

Registrar un administrador de negocio

- **Acceso:** público
- **Respuesta:** `201` · [AuthResponseDto](#authresponsedto)

**Body** `application/json`

**`RegisterBusinessAdminDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `email` | string (email) | sí |  Ej.: `"admin@golazo.co"` |
| `password` | string | sí | Mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres Ej.: `"MiCancha2026!"` |
| `phone` | string | no | hasta 20 caracteres Ej.: `"+57 300 123 4567"` |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "email": "admin@golazo.co",
  "password": "MiCancha2026!",
  "phone": "+57 300 123 4567"
}
```

</details>

#### `POST /auth/business/login`

Iniciar sesión como negocio (email y contraseña)

- **Acceso:** público
- **Respuesta:** `200` · [AuthResponseDto](#authresponsedto)

**Body** `application/json`

**`LoginDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `email` | string (email) | sí |  Ej.: `"admin@micancha.co"` |
| `password` | string | sí |  Ej.: `"MiCancha2026!"` |

<details><summary>Ejemplo</summary>

```json
{
  "email": "admin@micancha.co",
  "password": "MiCancha2026!"
}
```

</details>

#### `POST /auth/google`

Iniciar sesión como jugador con Google

- **Acceso:** público
- **Respuesta:** `200` · [AuthResponseDto](#authresponsedto)

**Body** `application/json`

**`GoogleSignInDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `idToken` | string | sí | ID token devuelto por Google Sign-In en la app. |

<details><summary>Ejemplo</summary>

```json
{
  "idToken": "<idToken>"
}
```

</details>

#### `POST /auth/apple`

Iniciar sesión como jugador con Apple

- **Acceso:** público
- **Respuesta:** `200` · [AuthResponseDto](#authresponsedto)

**Body** `application/json`

**`AppleSignInDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `identityToken` | string | sí | identityToken devuelto por Sign in with Apple. |
| `fullName` | string | no | Apple solo envía el nombre en el primer inicio de sesión. · hasta 100 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "identityToken": "<identityToken>"
}
```

</details>

#### `GET /auth/me`

Usuario autenticado

- **Acceso:** Bearer token · rol `cualquier usuario autenticado`
- **Respuesta:** `200` · [AuthUserDto](#authuserdto)

## Negocio (app y panel)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/business/profile` | Perfil del negocio (404 si aún no existe) |
| PUT | `/business/profile` | Crear o actualizar el perfil del negocio |
| PUT | `/business/profile/image` | Subir o reemplazar la foto de portada (JPG o PNG, máx. 4 MB) |
| DELETE | `/business/profile/image` | Quitar la foto de portada |
| GET | `/catalogs` | Servicios, métodos de pago y superficies de cancha activos (para la app) |
| GET | `/business/courts` | Listar las canchas del negocio |
| POST | `/business/courts` | Crear una cancha con horarios y tarifas (respeta el límite del plan; las fotos se suben después) |
| GET | `/business/reservations` | Reservas del negocio: con date, la agenda de ese día (lista); sin date, todas paginadas (más recientes primero) |
| POST | `/business/reservations` | Reservar turnos seguidos con cliente (existente o nuevo), descuento y pago opcional |
| GET | `/business/availability` | Turnos de un día de todas las canchas reservables de un deporte (una tarjeta por cancha) |
| GET | `/business/customers` | Clientes: con page, la cartera paginada con métricas, resumen, filtros (segment) y orden (sort); sin page, búsqueda rápida (máx. 20) |
| POST | `/business/customers` | Registrar un cliente sin reserva |
| GET | `/business/refunds` | Devoluciones del negocio (más recientes primero) |
| GET | `/business/dashboard` | Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes |
| GET | `/business/online-booking` | Link público de reservas y si está activo |
| PATCH | `/business/online-booking` | Activar o desactivar el link, o cambiar su slug |
| GET | `/business/payments` | Listar pagos (filtrables por estado) |
| POST | `/business/payments` | Registrar un pago recibido por el negocio |
| GET | `/business/account` | Perfil del administrador y suscripción |
| GET | `/business/courts/{id}` | Detalle de una cancha |
| PATCH | `/business/courts/{id}` | Actualizar, activar o desactivar una cancha (schedules y rates reemplazan la lista completa) |
| DELETE | `/business/courts/{id}` | Desactivar una cancha |
| GET | `/business/reservations/{id}` | Detalle de una reserva |
| POST | `/business/reservations/{id}/cancel` | Cancelar una reserva confirmada con su motivo (libera el turno y devuelve los pagos) |
| PATCH | `/business/reservations/{id}/status` | Marcar como confirmada, jugada (COMPLETED) o no asistió (NO_SHOW) |
| GET | `/business/courts/{id}/availability` | Turnos de un día con su estado (AVAILABLE, BOOKED, PAST) y precio |
| GET | `/business/customers/{customerId}` | Ficha del cliente con sus reservas y pagos en detalle |
| PATCH | `/business/customers/{customerId}` | Editar nombre, teléfono, cédula, deporte habitual o notas (el nivel es automático) |
| PATCH | `/business/payments/{id}/approve` | Aprobar un pago pendiente |
| PATCH | `/business/payments/{id}/reject` | Rechazar un pago pendiente |
| PUT | `/business/courts/{id}/photos/{slot}` | Subir o reemplazar la foto de una posición (JPG o PNG, máx. 4 MB) |
| DELETE | `/business/courts/{id}/photos/{slot}` | Quitar la foto de una posición |

### business / profile

#### `GET /business/profile`

Perfil del negocio (404 si aún no existe)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

#### `PUT /business/profile`

Crear o actualizar el perfil del negocio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

**Body** `application/json`

**`SaveBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 120 caracteres |
| `address` | string | sí | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `description` | string | no | hasta 1000 caracteres |
| `latitude` | number | no | Latitud del punto de llegada. Va junto con longitude; si se omiten, la ubicación se borra (es un PUT). Ej.: `4.6097` |
| `longitude` | number | no | Longitud del punto de llegada. Ej.: `-74.0817` |
| `amenities` | string[] | no | Códigos del catálogo de servicios (GET /catalogs). Ej.: `["PARQUEADERO","WIFI"]` |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Juan Pérez",
  "address": "<address>",
  "neighborhood": "<neighborhood>",
  "latitude": 4.6097,
  "longitude": -74.0817,
  "amenities": [
    "PARQUEADERO",
    "WIFI"
  ]
}
```

</details>

#### `PUT /business/profile/image`

Subir o reemplazar la foto de portada (JPG o PNG, máx. 4 MB)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `DELETE /business/profile/image`

Quitar la foto de portada

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

### catalogs

#### `GET /catalogs`

Servicios, métodos de pago y superficies de cancha activos (para la app)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CatalogsDto](#catalogsdto)

### business / courts

#### `GET /business/courts`

Listar las canchas del negocio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)[]

#### `POST /business/courts`

Crear una cancha con horarios y tarifas (respeta el límite del plan; las fotos se suben después)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CourtDto](#courtdto)

**Body** `application/json`

**`CreateCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `surface` | string | no | Código de la superficie o tipo de grama (GET /catalogs → courtSurfaces); debe aplicar al deporte. null la quita. Ej.: `"GRAMA_SINTETICA"` |
| `lengthMeters` | number | no | Largo en metros; va junto con widthMeters. null quita las medidas. · mín. 1, máx. 200 Ej.: `42` |
| `widthMeters` | number | no | Ancho en metros; va junto con lengthMeters. · mín. 1, máx. 200 Ej.: `25` |
| `playersPerSide` | number | no | Formato: jugadores por equipo (5 = fútbol 5, 2 = pádel). null lo quita. · mín. 1, máx. 11 Ej.: `5` |
| `name` | string | sí | 1+ caracteres, hasta 60 caracteres |
| `isCovered` | boolean | sí | true = cubierta o con techo; false = al aire libre. |
| `isActive` | boolean | no | Si se omite, true. Para recibir reservas además necesita las 3 fotos obligatorias. |
| `currency` | string | no | Código ISO 4217. Si se omite, COP. · patrón `^[A-Z]{3}$` Ej.: `"COP"` |
| `basePricePerHour` | number | sí | Precio por hora donde ninguna tarifa aplica. · mín. 0, máx. 1000000000 Ej.: `80000` |
| `slotDuration` | `30` \| `60` \| `90` \| `120` | no | Duración del turno en minutos: 30, 60, 90 o 120. Si se omite, 60. |
| `schedules` | CourtScheduleDto[] | sí | Los 7 días de la semana, cada uno una vez. · 7+ elementos |
| `rates` | CourtRateDto[] | no | Tarifas por franja; no se pueden cruzar. |

**`CourtScheduleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `isOpen` | boolean | sí |  |
| `openTime` | string | no | Hora local de apertura; obligatoria si isOpen. Ej.: `"06:00"` |
| `closeTime` | string | no | Hora local de cierre; si es menor que openTime cierra al día siguiente. Ej.: `"23:00"` |

**`CourtRateDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `days` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY`[] | sí | Días en los que empieza la franja. · 1+ elementos Ej.: `["MONDAY","TUESDAY"]` |
| `name` | string | sí | 1+ caracteres, hasta 40 caracteres |
| `pricePerHour` | number | sí | Precio por hora en la moneda de la cancha. · mín. 0, máx. 1000000000 Ej.: `90000` |
| `startTime` | string | sí |  Ej.: `"18:00"` |
| `endTime` | string | sí | Si es menor que startTime, la franja termina al día siguiente. Ej.: `"23:00"` |

<details><summary>Ejemplo</summary>

```json
{
  "sport": "FUTBOL",
  "surface": "GRAMA_SINTETICA",
  "lengthMeters": 42,
  "widthMeters": 25,
  "playersPerSide": 5,
  "name": "Cancha 1",
  "isCovered": true,
  "currency": "COP",
  "basePricePerHour": 80000,
  "schedules": [
    {
      "dayOfWeek": "MONDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "TUESDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "WEDNESDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "THURSDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "FRIDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "SATURDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    },
    {
      "dayOfWeek": "SUNDAY",
      "isOpen": true,
      "openTime": "06:00",
      "closeTime": "23:00"
    }
  ]
}
```

</details>

#### `GET /business/courts/{id}`

Detalle de una cancha

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /business/courts/{id}`

Actualizar, activar o desactivar una cancha (schedules y rates reemplazan la lista completa)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no |  |
| `surface` | string | no | Código de la superficie o tipo de grama (GET /catalogs → courtSurfaces); debe aplicar al deporte. null la quita. Ej.: `"GRAMA_SINTETICA"` |
| `lengthMeters` | number | no | Largo en metros; va junto con widthMeters. null quita las medidas. · mín. 1, máx. 200 Ej.: `42` |
| `widthMeters` | number | no | Ancho en metros; va junto con lengthMeters. · mín. 1, máx. 200 Ej.: `25` |
| `playersPerSide` | number | no | Formato: jugadores por equipo (5 = fútbol 5, 2 = pádel). null lo quita. · mín. 1, máx. 11 Ej.: `5` |
| `name` | string | no | 1+ caracteres, hasta 60 caracteres |
| `isCovered` | boolean | no | true = cubierta o con techo; false = al aire libre. |
| `isActive` | boolean | no | Si se omite, true. Para recibir reservas además necesita las 3 fotos obligatorias. |
| `currency` | string | no | Código ISO 4217. Si se omite, COP. · patrón `^[A-Z]{3}$` Ej.: `"COP"` |
| `basePricePerHour` | number | no | Precio por hora donde ninguna tarifa aplica. · mín. 0, máx. 1000000000 Ej.: `80000` |
| `slotDuration` | `30` \| `60` \| `90` \| `120` | no | Duración del turno en minutos: 30, 60, 90 o 120. Si se omite, 60. |
| `schedules` | CourtScheduleDto[] | no | Los 7 días de la semana, cada uno una vez. · 7+ elementos |
| `rates` | CourtRateDto[] | no | Tarifas por franja; no se pueden cruzar. |

**`CourtScheduleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `isOpen` | boolean | sí |  |
| `openTime` | string | no | Hora local de apertura; obligatoria si isOpen. Ej.: `"06:00"` |
| `closeTime` | string | no | Hora local de cierre; si es menor que openTime cierra al día siguiente. Ej.: `"23:00"` |

**`CourtRateDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `days` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY`[] | sí | Días en los que empieza la franja. · 1+ elementos Ej.: `["MONDAY","TUESDAY"]` |
| `name` | string | sí | 1+ caracteres, hasta 40 caracteres |
| `pricePerHour` | number | sí | Precio por hora en la moneda de la cancha. · mín. 0, máx. 1000000000 Ej.: `90000` |
| `startTime` | string | sí |  Ej.: `"18:00"` |
| `endTime` | string | sí | Si es menor que startTime, la franja termina al día siguiente. Ej.: `"23:00"` |

<details><summary>Ejemplo</summary>

```json
{
  "surface": "GRAMA_SINTETICA",
  "lengthMeters": 42,
  "widthMeters": 25,
  "playersPerSide": 5,
  "currency": "COP",
  "basePricePerHour": 80000
}
```

</details>

#### `DELETE /business/courts/{id}`

Desactivar una cancha

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PUT /business/courts/{id}/photos/{slot}`

Subir o reemplazar la foto de una posición (JPG o PNG, máx. 4 MB)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `slot` | path | `MAIN` \| `SURFACE` \| `LIGHTING` \| `EXTRA_1` \| `EXTRA_2` | sí |  |

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `DELETE /business/courts/{id}/photos/{slot}`

Quitar la foto de una posición

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `slot` | path | `MAIN` \| `SURFACE` \| `LIGHTING` \| `EXTRA_1` \| `EXTRA_2` | sí |  |

### business / reservations

#### `GET /business/reservations`

Reservas del negocio: con date, la agenda de ese día (lista); sin date, todas paginadas (más recientes primero)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [ReservationDto](#reservationdto)[] \| [ReservationPageDto](#reservationpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `status` | query | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | no |  |
| `source` | query | `BUSINESS` \| `WEB` | no | BUSINESS o WEB (reservas hechas por jugadores desde el link). |
| `date` | query | string | no | Un día en hora del negocio. Ej.: `2026-10-15` |
| `from` | query | string | no | Desde este día, inclusive. Ej.: `2026-10-01` |
| `to` | query | string | no | Hasta este día, inclusive. Ej.: `2026-10-31` |
| `courtId` | query | string (uuid) | no |  |
| `customerId` | query | string (uuid) | no |  |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /business/reservations`

Reservar turnos seguidos con cliente (existente o nuevo), descuento y pago opcional

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [ReservationDto](#reservationdto)

**Body** `application/json`

**`CreateReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Cualquier cancha libre de este deporte: la API asigna la primera por nombre. Envía esto o `courtId`. |
| `courtId` | string (uuid) | no | Cancha elegida. Envía esto o `sport`. |
| `start` | string | sí | Inicio del primer turno (debe coincidir con un turno de GET …/availability). Ej.: `"2026-10-20T19:00:00-05:00"` |
| `slots` | number | sí | Turnos seguidos a reservar (la duración sale del turno de la cancha). · mín. 1, máx. 5 Ej.: `2` |
| `customerId` | string (uuid) | no | Cliente existente del negocio. Envía esto o `customer`. |
| `customer` | CustomerInputDto | no | Cliente nuevo (si el teléfono o la cédula ya existen, se usa el existente). |
| `customerDetail` | string | no | hasta 100 caracteres Ej.: `"Equipo Los Halcones"` |
| `contactNote` | string | no | hasta 200 caracteres |
| `tag` | string | no | hasta 30 caracteres Ej.: `"Torneo"` |
| `isRecurring` | boolean | no |  |
| `discount` | number | no | Se resta del valor de las tarifas. Por defecto 0. · mín. 0, máx. 1000000000 Ej.: `10000` |
| `payment` | ReservationPaymentInputDto | no | Pago opcional al reservar (anticipo o total). |

**`CustomerInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | sí | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |

**`ReservationPaymentInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `amount` | number | sí | Lo que paga al reservar; si es el total, el pago queda como TOTAL, si no como ANTICIPO. · mín. 0.01, máx. 1000000000 Ej.: `50000` |
| `method` | string | no | Código del método de pago (GET /catalogs). Si se omite, EFECTIVO. Ej.: `"NEQUI"` |
| `reference` | string | no | Obligatoria si el método la exige (p. ej. Nequi). · hasta 60 caracteres Ej.: `"M4829310"` |
| `note` | string | no | hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "start": "2026-10-20T19:00:00-05:00",
  "slots": 2,
  "customer": {
    "name": "Juan Pérez",
    "phone": "+57 300 123 4567",
    "documentId": "1.117.523.456"
  },
  "customerDetail": "Equipo Los Halcones",
  "tag": "Torneo",
  "discount": 10000,
  "payment": {
    "amount": 50000,
    "method": "NEQUI",
    "reference": "M4829310"
  },
  "courtId": "{{courtId}}"
}
```

</details>

#### `GET /business/availability`

Turnos de un día de todas las canchas reservables de un deporte (una tarjeta por cancha)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [SportAvailabilityDto](#sportavailabilitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `date` | query | string | sí | Día en la zona horaria del negocio. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `2026-10-13` |

#### `GET /business/reservations/{id}`

Detalle de una reserva

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `POST /business/reservations/{id}/cancel`

Cancelar una reserva confirmada con su motivo (libera el turno y devuelve los pagos)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`CancelReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reason` | string | sí | 3+ caracteres, hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "reason": "El cliente pidió cancelar"
}
```

</details>

#### `PATCH /business/reservations/{id}/status`

Marcar como confirmada, jugada (COMPLETED) o no asistió (NO_SHOW)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateReservationStatusDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` | sí |  |

<details><summary>Ejemplo</summary>

```json
{
  "status": "CONFIRMED"
}
```

</details>

#### `GET /business/courts/{id}/availability`

Turnos de un día con su estado (AVAILABLE, BOOKED, PAST) y precio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [AvailabilityDto](#availabilitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `date` | query | string | sí | Día en la zona horaria del negocio. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `2026-10-13` |

### business / customers

#### `GET /business/customers`

Clientes: con page, la cartera paginada con métricas, resumen, filtros (segment) y orden (sort); sin page, búsqueda rápida (máx. 20)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · object

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `segment` | query | `ALL` \| `LOYAL` \| `WITH_BALANCE` \| `NEW` | no | ALL todos · LOYAL frecuentes y VIP · WITH_BALANCE con saldo por cobrar · NEW registrados en los últimos 30 días. |
| `sort` | query | `MOST_RESERVATIONS` \| `TOP_SPENDERS` \| `LAST_VISIT` \| `HIGHEST_BALANCE` \| `NAME` \| `NEWEST` | no | Por defecto MOST_RESERVATIONS. |
| `page` | query | number | no | mín. 1 |
| `pageSize` | query | number | no | mín. 1, máx. 100 |
| `search` | query | string | no | Texto a buscar (nombre, teléfono o cédula). · hasta 100 caracteres |

#### `POST /business/customers`

Registrar un cliente sin reserva

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CustomerDto](#customerdto)

**Body** `application/json`

**`CreateCustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Deporte habitual; si se omite se usa el que más reserva. |
| `notes` | string | no | Notas internas del negocio. · hasta 1000 caracteres |
| `name` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | sí | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Juan Pérez",
  "phone": "+57 300 123 4567",
  "documentId": "1.117.523.456"
}
```

</details>

#### `GET /business/customers/{customerId}`

Ficha del cliente con sus reservas y pagos en detalle

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CustomerDetailDto](#customerdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `customerId` | path | string | sí |  |

#### `PATCH /business/customers/{customerId}`

Editar nombre, teléfono, cédula, deporte habitual o notas (el nivel es automático)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CustomerDto](#customerdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `customerId` | path | string | sí |  |

**Body** `application/json`

**`UpdateCustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Deporte habitual; si se omite se usa el que más reserva. |
| `name` | string | no | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | no | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | no | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |
| `notes` | string | no | Notas internas del negocio. · hasta 1000 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "documentId": "1.117.523.456"
}
```

</details>

### business / refunds

#### `GET /business/refunds`

Devoluciones del negocio (más recientes primero)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [RefundDto](#refunddto)[]

### business / dashboard

#### `GET /business/dashboard`

Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDashboardDto](#businessdashboarddto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `period` | query | `TODAY` \| `LAST_7_DAYS` \| `LAST_30_DAYS` \| `THIS_MONTH` \| `CUSTOM` | no | Por defecto TODAY. Con CUSTOM, `from` y `to` son obligatorios (máx. 366 días). |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Solo canchas de este deporte. |
| `from` | query | string | no | Primer día, inclusive (YYYY-MM-DD, hora del negocio). Solo con CUSTOM. |
| `to` | query | string | no | Último día, inclusive. Solo con CUSTOM. |
| `courtId` | query | string (uuid) | no | Solo esta cancha. |

### business / online booking

#### `GET /business/online-booking`

Link público de reservas y si está activo

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [OnlineBookingSettingsDto](#onlinebookingsettingsdto)

#### `PATCH /business/online-booking`

Activar o desactivar el link, o cambiar su slug

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [OnlineBookingSettingsDto](#onlinebookingsettingsdto)

**Body** `application/json`

**`UpdateOnlineBookingDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | no |  |
| `slug` | string | no | Minúsculas, números y guiones (3 a 60). · 3+ caracteres, hasta 60 caracteres Ej.: `"complejo-el-golazo"` |

<details><summary>Ejemplo</summary>

```json
{
  "slug": "complejo-el-golazo"
}
```

</details>

### business / payments

#### `GET /business/payments`

Listar pagos (filtrables por estado)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [PaymentDto](#paymentdto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `status` | query | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | no |  |

#### `POST /business/payments`

Registrar un pago recibido por el negocio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [PaymentDto](#paymentdto)

**Body** `application/json`

**`CreatePaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` | sí |  |
| `customerName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `amount` | number | sí | Monto con hasta 2 decimales. · mín. 0.01, máx. 1000000000 Ej.: `60000` |
| `method` | string | sí | Código del catálogo de métodos de pago (GET /catalogs). Ej.: `"NEQUI"` |
| `reference` | string | no | Obligatoria si el método la exige (p. ej. Nequi). · hasta 60 caracteres Ej.: `"M4829310"` |
| `note` | string | no | hasta 300 caracteres |
| `reservationId` | string (uuid) | no | Reserva a la que se abona el pago. |

<details><summary>Ejemplo</summary>

```json
{
  "concept": "ANTICIPO",
  "customerName": "<customerName>",
  "amount": 60000,
  "method": "NEQUI",
  "reference": "M4829310"
}
```

</details>

#### `PATCH /business/payments/{id}/approve`

Aprobar un pago pendiente

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [PaymentDto](#paymentdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /business/payments/{id}/reject`

Rechazar un pago pendiente

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [PaymentDto](#paymentdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`RejectPaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reason` | string | sí | 3+ caracteres, hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "reason": "El cliente pidió cancelar"
}
```

</details>

### business / account

#### `GET /business/account`

Perfil del administrador y suscripción

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessAccountDto](#businessaccountdto)

## Reservas en línea: público

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/public/auth/register` | Registrar una cuenta de jugador |
| POST | `/public/auth/login` | Iniciar sesión con celular o cédula y contraseña |
| GET | `/public/businesses/{slug}` | Información pública del negocio para reservar |
| GET | `/public/businesses/{slug}/availability` | Turnos de un día de todas las canchas de un deporte (HELD = otro jugador los apartó) |

### public / reservas en línea

#### `POST /public/auth/register`

Registrar una cuenta de jugador

- **Acceso:** público
- **Respuesta:** `201` · [PlayerSessionDto](#playersessiondto)

**Body** `application/json`

**`RegisterPlayerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `favoriteSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no |  |
| `fullName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `email` | string (email) | sí | hasta 120 caracteres Ej.: `"laura@correo.com"` |
| `phone` | string | sí | Celular; 10 dígitos se guardan con +57. · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | sí | Cédula; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.075.111.222"` |
| `password` | string | sí | Mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres |
| `birthDate` | string | no | Opcional. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `"1995-04-21"` |
| `acceptDataPolicy` | boolean | sí | Debe ser true: aceptación de la política de tratamiento de datos. |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "email": "laura@correo.com",
  "phone": "+57 300 123 4567",
  "documentId": "1.075.111.222",
  "password": "MiCancha2026!",
  "birthDate": "1995-04-21",
  "acceptDataPolicy": true
}
```

</details>

#### `POST /public/auth/login`

Iniciar sesión con celular o cédula y contraseña

- **Acceso:** público
- **Respuesta:** `200` · [PlayerSessionDto](#playersessiondto)

**Body** `application/json`

**`LoginPlayerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `identifier` | string | sí | Celular o cédula. · 4+ caracteres, hasta 30 caracteres Ej.: `"3115550001"` |
| `password` | string | sí | 1+ caracteres, hasta 72 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "identifier": "3115550001",
  "password": "MiCancha2026!"
}
```

</details>

#### `GET /public/businesses/{slug}`

Información pública del negocio para reservar

- **Acceso:** público
- **Respuesta:** `200` · [PublicBusinessDto](#publicbusinessdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

#### `GET /public/businesses/{slug}/availability`

Turnos de un día de todas las canchas de un deporte (HELD = otro jugador los apartó)

- **Acceso:** público
- **Respuesta:** `200` · [SportAvailabilityDto](#sportavailabilitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `date` | query | string | sí | patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `2026-10-20` |

## Reservas en línea: jugador

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/player/me` | Datos de la cuenta del jugador |
| POST | `/player/businesses/{slug}/reservations` | Reservar desde la web: queda confirmada y se paga en efectivo en la sede |
| GET | `/player/businesses/{slug}/reservations` | Mis reservas en este negocio |
| GET | `/player/businesses/{slug}/hold` | Mi apartado vigente en este negocio |
| PUT | `/player/businesses/{slug}/hold` | Apartar turnos mientras confirmo (3 min, máx. 3 turnos); reemplaza el apartado anterior |
| DELETE | `/player/businesses/{slug}/hold` | Soltar mi apartado |

### player

#### `GET /player/me`

Datos de la cuenta del jugador

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerDto](#playerdto)

#### `POST /player/businesses/{slug}/reservations`

Reservar desde la web: queda confirmada y se paga en efectivo en la sede

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `201` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

**Body** `application/json`

**`WebReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `notes` | string | no | Notas para la sede (se guardan en contactNote). · hasta 200 caracteres |
| `courtId` | string (uuid) | sí |  |
| `start` | string | sí | Inicio del primer turno, tal como llega en la disponibilidad. |
| `slots` | number | sí | mín. 1, máx. 3 |

<details><summary>Ejemplo</summary>

```json
{
  "courtId": "{{courtId}}",
  "start": "<start>",
  "slots": 1
}
```

</details>

#### `GET /player/businesses/{slug}/reservations`

Mis reservas en este negocio

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [ReservationDto](#reservationdto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

#### `GET /player/businesses/{slug}/hold`

Mi apartado vigente en este negocio

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [CurrentHoldDto](#currentholddto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

#### `PUT /player/businesses/{slug}/hold`

Apartar turnos mientras confirmo (3 min, máx. 3 turnos); reemplaza el apartado anterior

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [SlotHoldDto](#slotholddto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

**Body** `application/json`

**`WebHoldDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `courtId` | string (uuid) | sí |  |
| `start` | string | sí | Inicio del primer turno, tal como llega en la disponibilidad. |
| `slots` | number | sí | mín. 1, máx. 3 |

<details><summary>Ejemplo</summary>

```json
{
  "courtId": "{{courtId}}",
  "start": "<start>",
  "slots": 1
}
```

</details>

#### `DELETE /player/businesses/{slug}/hold`

Soltar mi apartado

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `slug` | path | string | sí |  |

## Super admin

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/catalogs/amenities` | Servicios (incluye inactivos y uso) |
| POST | `/admin/catalogs/amenities` | Crear un servicio |
| GET | `/admin/catalogs/payment-methods` | Métodos de pago (incluye inactivos y uso) |
| POST | `/admin/catalogs/payment-methods` | Crear un método de pago |
| GET | `/admin/catalogs/court-surfaces` | Superficies de cancha (incluye inactivas y uso) |
| POST | `/admin/catalogs/court-surfaces` | Crear una superficie de cancha |
| GET | `/admin/dashboard` | Métricas generales de la plataforma |
| GET | `/admin/clients` | Listado de clientes (negocios) |
| POST | `/admin/clients` | Crear un cliente: usuario de negocio + negocio + plan |
| GET | `/admin/users` | Listado de usuarios |
| GET | `/admin/plans` | Planes de suscripción |
| POST | `/admin/plans` | Crear un plan |
| GET | `/admin/enums` | Enums fijos del sistema (solo lectura) |
| PATCH | `/admin/catalogs/amenities/{id}` | Editar o (des)activar un servicio |
| PATCH | `/admin/catalogs/payment-methods/{id}` | Editar o (des)activar un método de pago |
| PATCH | `/admin/catalogs/court-surfaces/{id}` | Editar o (des)activar una superficie de cancha |
| GET | `/admin/clients/{id}/dashboard` | Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes |
| GET | `/admin/clients/{id}/online-booking` | Link público de reservas del cliente |
| PATCH | `/admin/clients/{id}/online-booking` | Activar o desactivar el link del cliente, o cambiar su slug |
| GET | `/admin/clients/{id}` | Ficha del cliente: negocio, responsable, plan, canchas y actividad |
| PATCH | `/admin/clients/{id}` | Actualizar datos generales o ubicación del cliente |
| PUT | `/admin/clients/{id}/image` | Subir o reemplazar el logo/foto de portada del cliente (negocio) |
| DELETE | `/admin/clients/{id}/image` | Eliminar el logo/foto de portada del cliente (negocio) |
| GET | `/admin/clients/{id}/courts` | Canchas del cliente con horarios, tarifas y fotos |
| GET | `/admin/clients/{id}/availability` | Turnos de un día de todas las canchas de un deporte del cliente |
| GET | `/admin/clients/{id}/reservations` | Reservas del cliente: con date, la agenda de ese día; sin date, paginadas con filtros |
| POST | `/admin/clients/{id}/reservations` | Crear una reserva para el cliente (mismas reglas que el negocio) |
| GET | `/admin/clients/{id}/customers` | Clientes (personas) del negocio: con page, listado paginado con métricas; sin page, búsqueda rápida (máx. 20) |
| POST | `/admin/clients/{id}/customers` | Registrar un cliente (persona) del negocio |
| GET | `/admin/clients/{id}/refunds` | Devoluciones del negocio |
| PATCH | `/admin/clients/{id}/subscription` | Cambiar el plan o activar/suspender al cliente |
| PATCH | `/admin/plans/{id}` | Editar un plan |
| DELETE | `/admin/plans/{id}` | Eliminar un plan sin clientes |
| PATCH | `/admin/clients/{id}/courts/{courtId}` | Editar una cancha del cliente (mismas reglas que el negocio; schedules y rates reemplazan la lista) |
| GET | `/admin/clients/{id}/courts/{courtId}/availability` | Turnos de un día de una cancha del cliente |
| POST | `/admin/clients/{id}/reservations/{reservationId}/cancel` | Cancelar una reserva del cliente con su motivo |
| PATCH | `/admin/clients/{id}/customers/{customerId}` | Editar un cliente (persona) del negocio |
| GET | `/admin/clients/{id}/customers/{customerId}` | Ficha del cliente del negocio con todas sus reservas y pagos en detalle |

### admin / catalogs

#### `GET /admin/catalogs/amenities`

Servicios (incluye inactivos y uso)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AdminAmenityDto](#adminamenitydto)[]

#### `POST /admin/catalogs/amenities`

Crear un servicio

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [AmenityDto](#amenitydto)

**Body** `application/json`

**`CreateAmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  Ej.: `"PISCINA"` |
| `name` | string | sí | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |

<details><summary>Ejemplo</summary>

```json
{
  "code": "PISCINA",
  "name": "Piscina"
}
```

</details>

#### `GET /admin/catalogs/payment-methods`

Métodos de pago (incluye inactivos y uso)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AdminPaymentMethodDto](#adminpaymentmethoddto)[]

#### `POST /admin/catalogs/payment-methods`

Crear un método de pago

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [PaymentMethodDto](#paymentmethoddto)

**Body** `application/json`

**`CreatePaymentMethodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  Ej.: `"PISCINA"` |
| `name` | string | sí | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |
| `requiresReference` | boolean | sí | Si exige número de referencia o comprobante al registrar el pago. |

<details><summary>Ejemplo</summary>

```json
{
  "code": "PISCINA",
  "name": "Piscina",
  "requiresReference": true
}
```

</details>

#### `GET /admin/catalogs/court-surfaces`

Superficies de cancha (incluye inactivas y uso)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AdminCourtSurfaceDto](#admincourtsurfacedto)[]

#### `POST /admin/catalogs/court-surfaces`

Crear una superficie de cancha

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [CourtSurfaceDto](#courtsurfacedto)

**Body** `application/json`

**`CreateCourtSurfaceDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | sí | Deportes en los que se ofrece; vacío = todos. Ej.: `["FUTBOL","PADEL"]` |
| `code` | string | sí |  Ej.: `"PISCINA"` |
| `name` | string | sí | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |

<details><summary>Ejemplo</summary>

```json
{
  "sports": [
    "FUTBOL",
    "PADEL"
  ],
  "code": "PISCINA",
  "name": "Piscina"
}
```

</details>

#### `PATCH /admin/catalogs/amenities/{id}`

Editar o (des)activar un servicio

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AmenityDto](#amenitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateAmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |
| `active` | boolean | no |  |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Piscina"
}
```

</details>

#### `PATCH /admin/catalogs/payment-methods/{id}`

Editar o (des)activar un método de pago

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [PaymentMethodDto](#paymentmethoddto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdatePaymentMethodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |
| `active` | boolean | no |  |
| `requiresReference` | boolean | no |  |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Piscina"
}
```

</details>

#### `PATCH /admin/catalogs/court-surfaces/{id}`

Editar o (des)activar una superficie de cancha

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CourtSurfaceDto](#courtsurfacedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateCourtSurfaceDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | Nombre visible en la app. · 2+ caracteres, hasta 60 caracteres Ej.: `"Piscina"` |
| `sortOrder` | number | no | mín. 0, máx. 999 |
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | no |  |
| `active` | boolean | no |  |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Piscina"
}
```

</details>

### admin

#### `GET /admin/dashboard`

Métricas generales de la plataforma

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [DashboardDto](#dashboarddto)

#### `GET /admin/clients`

Listado de clientes (negocios)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientPageDto](#clientpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /admin/clients`

Crear un cliente: usuario de negocio + negocio + plan

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [ClientDto](#clientdto)

**Body** `application/json`

**`CreateClientDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí | Nombre del administrador del negocio. · 2+ caracteres, hasta 100 caracteres |
| `email` | string (email) | sí |  Ej.: `"contacto@golazo.co"` |
| `password` | string | sí | Contraseña inicial (mín. 8). · 8+ caracteres, hasta 72 caracteres |
| `phone` | string | no | hasta 20 caracteres Ej.: `3001234567` |
| `businessName` | string | sí | 2+ caracteres, hasta 120 caracteres |
| `address` | string | sí | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `planId` | string (uuid) | sí |  |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "email": "contacto@golazo.co",
  "password": "MiCancha2026!",
  "phone": 3001234567,
  "businessName": "<businessName>",
  "address": "<address>",
  "neighborhood": "<neighborhood>",
  "planId": "{{planId}}"
}
```

</details>

#### `GET /admin/users`

Listado de usuarios

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [UserPageDto](#userpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `role` | query | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | no |  |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `GET /admin/plans`

Planes de suscripción

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [PlanDto](#plandto)[]

#### `POST /admin/plans`

Crear un plan

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [PlanDto](#plandto)

**Body** `application/json`

**`CreatePlanDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 40 caracteres Ej.: `"Pro"` |
| `monthlyPrice` | number | sí | Precio mensual en COP. · mín. 0, máx. 100000000 Ej.: `179000` |
| `courtLimit` | number | sí | Canchas activas permitidas. · mín. 1, máx. 500 Ej.: `8` |
| `benefits` | PlanBenefitInputDto[] | sí |  |

**`PlanBenefitInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí | 2+ caracteres, hasta 60 caracteres |
| `detail` | string | sí | hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Pro",
  "monthlyPrice": 179000,
  "courtLimit": 8,
  "benefits": [
    {
      "title": "<title>",
      "detail": "<detail>"
    }
  ]
}
```

</details>

#### `GET /admin/enums`

Enums fijos del sistema (solo lectura)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [SystemEnumDto](#systemenumdto)[]

#### `GET /admin/clients/{id}/dashboard`

Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BusinessDashboardDto](#businessdashboarddto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `period` | query | `TODAY` \| `LAST_7_DAYS` \| `LAST_30_DAYS` \| `THIS_MONTH` \| `CUSTOM` | no | Por defecto TODAY. Con CUSTOM, `from` y `to` son obligatorios (máx. 366 días). |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Solo canchas de este deporte. |
| `from` | query | string | no | Primer día, inclusive (YYYY-MM-DD, hora del negocio). Solo con CUSTOM. |
| `to` | query | string | no | Último día, inclusive. Solo con CUSTOM. |
| `courtId` | query | string (uuid) | no | Solo esta cancha. |

#### `GET /admin/clients/{id}/online-booking`

Link público de reservas del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [OnlineBookingSettingsDto](#onlinebookingsettingsdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /admin/clients/{id}/online-booking`

Activar o desactivar el link del cliente, o cambiar su slug

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [OnlineBookingSettingsDto](#onlinebookingsettingsdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateOnlineBookingDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | no |  |
| `slug` | string | no | Minúsculas, números y guiones (3 a 60). · 3+ caracteres, hasta 60 caracteres Ej.: `"complejo-el-golazo"` |

<details><summary>Ejemplo</summary>

```json
{
  "slug": "complejo-el-golazo"
}
```

</details>

#### `GET /admin/clients/{id}`

Ficha del cliente: negocio, responsable, plan, canchas y actividad

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /admin/clients/{id}`

Actualizar datos generales o ubicación del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateClientDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | 2+ caracteres, hasta 120 caracteres |
| `address` | string | no | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | no | 2+ caracteres, hasta 100 caracteres |
| `description` | string | no | hasta 1000 caracteres |
| `latitude` | number | no |  |
| `longitude` | number | no |  |

<details><summary>Ejemplo</summary>

```json
{}
```

</details>

#### `PUT /admin/clients/{id}/image`

Subir o reemplazar el logo/foto de portada del cliente (negocio)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `DELETE /admin/clients/{id}/image`

Eliminar el logo/foto de portada del cliente (negocio)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `GET /admin/clients/{id}/courts`

Canchas del cliente con horarios, tarifas y fotos

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CourtDto](#courtdto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `GET /admin/clients/{id}/availability`

Turnos de un día de todas las canchas de un deporte del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [SportAvailabilityDto](#sportavailabilitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `date` | query | string | sí | Día en la zona horaria del negocio. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `2026-10-13` |

#### `GET /admin/clients/{id}/reservations`

Reservas del cliente: con date, la agenda de ese día; sin date, paginadas con filtros

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · object

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `status` | query | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | no |  |
| `source` | query | `BUSINESS` \| `WEB` | no | BUSINESS o WEB (reservas hechas por jugadores desde el link). |
| `date` | query | string | no | Un día en hora del negocio. Ej.: `2026-10-15` |
| `from` | query | string | no | Desde este día, inclusive. Ej.: `2026-10-01` |
| `to` | query | string | no | Hasta este día, inclusive. Ej.: `2026-10-31` |
| `courtId` | query | string (uuid) | no |  |
| `customerId` | query | string (uuid) | no |  |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /admin/clients/{id}/reservations`

Crear una reserva para el cliente (mismas reglas que el negocio)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`CreateReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Cualquier cancha libre de este deporte: la API asigna la primera por nombre. Envía esto o `courtId`. |
| `courtId` | string (uuid) | no | Cancha elegida. Envía esto o `sport`. |
| `start` | string | sí | Inicio del primer turno (debe coincidir con un turno de GET …/availability). Ej.: `"2026-10-20T19:00:00-05:00"` |
| `slots` | number | sí | Turnos seguidos a reservar (la duración sale del turno de la cancha). · mín. 1, máx. 5 Ej.: `2` |
| `customerId` | string (uuid) | no | Cliente existente del negocio. Envía esto o `customer`. |
| `customer` | CustomerInputDto | no | Cliente nuevo (si el teléfono o la cédula ya existen, se usa el existente). |
| `customerDetail` | string | no | hasta 100 caracteres Ej.: `"Equipo Los Halcones"` |
| `contactNote` | string | no | hasta 200 caracteres |
| `tag` | string | no | hasta 30 caracteres Ej.: `"Torneo"` |
| `isRecurring` | boolean | no |  |
| `discount` | number | no | Se resta del valor de las tarifas. Por defecto 0. · mín. 0, máx. 1000000000 Ej.: `10000` |
| `payment` | ReservationPaymentInputDto | no | Pago opcional al reservar (anticipo o total). |

**`CustomerInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | sí | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |

**`ReservationPaymentInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `amount` | number | sí | Lo que paga al reservar; si es el total, el pago queda como TOTAL, si no como ANTICIPO. · mín. 0.01, máx. 1000000000 Ej.: `50000` |
| `method` | string | no | Código del método de pago (GET /catalogs). Si se omite, EFECTIVO. Ej.: `"NEQUI"` |
| `reference` | string | no | Obligatoria si el método la exige (p. ej. Nequi). · hasta 60 caracteres Ej.: `"M4829310"` |
| `note` | string | no | hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "start": "2026-10-20T19:00:00-05:00",
  "slots": 2,
  "customer": {
    "name": "Juan Pérez",
    "phone": "+57 300 123 4567",
    "documentId": "1.117.523.456"
  },
  "customerDetail": "Equipo Los Halcones",
  "tag": "Torneo",
  "discount": 10000,
  "payment": {
    "amount": 50000,
    "method": "NEQUI",
    "reference": "M4829310"
  },
  "courtId": "{{courtId}}"
}
```

</details>

#### `GET /admin/clients/{id}/customers`

Clientes (personas) del negocio: con page, listado paginado con métricas; sin page, búsqueda rápida (máx. 20)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · object

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `segment` | query | `ALL` \| `LOYAL` \| `WITH_BALANCE` \| `NEW` | no | ALL todos · LOYAL frecuentes y VIP · WITH_BALANCE con saldo por cobrar · NEW registrados en los últimos 30 días. |
| `sort` | query | `MOST_RESERVATIONS` \| `TOP_SPENDERS` \| `LAST_VISIT` \| `HIGHEST_BALANCE` \| `NAME` \| `NEWEST` | no | Por defecto MOST_RESERVATIONS. |
| `page` | query | number | no | mín. 1 |
| `pageSize` | query | number | no | mín. 1, máx. 100 |
| `search` | query | string | no | Texto a buscar (nombre, teléfono o cédula). · hasta 100 caracteres |

#### `POST /admin/clients/{id}/customers`

Registrar un cliente (persona) del negocio

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [CustomerDto](#customerdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`CreateCustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Deporte habitual; si se omite se usa el que más reserva. |
| `notes` | string | no | Notas internas del negocio. · hasta 1000 caracteres |
| `name` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | sí | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Juan Pérez",
  "phone": "+57 300 123 4567",
  "documentId": "1.117.523.456"
}
```

</details>

#### `GET /admin/clients/{id}/refunds`

Devoluciones del negocio

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [RefundDto](#refunddto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /admin/clients/{id}/subscription`

Cambiar el plan o activar/suspender al cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDto](#clientdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateSubscriptionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `planId` | string (uuid) | no |  |
| `isActive` | boolean | no |  |

<details><summary>Ejemplo</summary>

```json
{}
```

</details>

#### `PATCH /admin/plans/{id}`

Editar un plan

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [PlanDto](#plandto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdatePlanDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | 2+ caracteres, hasta 40 caracteres Ej.: `"Pro"` |
| `monthlyPrice` | number | no | Precio mensual en COP. · mín. 0, máx. 100000000 Ej.: `179000` |
| `courtLimit` | number | no | Canchas activas permitidas. · mín. 1, máx. 500 Ej.: `8` |
| `benefits` | PlanBenefitInputDto[] | no |  |

**`PlanBenefitInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí | 2+ caracteres, hasta 60 caracteres |
| `detail` | string | sí | hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Pro",
  "monthlyPrice": 179000,
  "courtLimit": 8
}
```

</details>

#### `DELETE /admin/plans/{id}`

Eliminar un plan sin clientes

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /admin/clients/{id}/courts/{courtId}`

Editar una cancha del cliente (mismas reglas que el negocio; schedules y rates reemplazan la lista)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `courtId` | path | string | sí |  |

**Body** `application/json`

**`UpdateCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no |  |
| `surface` | string | no | Código de la superficie o tipo de grama (GET /catalogs → courtSurfaces); debe aplicar al deporte. null la quita. Ej.: `"GRAMA_SINTETICA"` |
| `lengthMeters` | number | no | Largo en metros; va junto con widthMeters. null quita las medidas. · mín. 1, máx. 200 Ej.: `42` |
| `widthMeters` | number | no | Ancho en metros; va junto con lengthMeters. · mín. 1, máx. 200 Ej.: `25` |
| `playersPerSide` | number | no | Formato: jugadores por equipo (5 = fútbol 5, 2 = pádel). null lo quita. · mín. 1, máx. 11 Ej.: `5` |
| `name` | string | no | 1+ caracteres, hasta 60 caracteres |
| `isCovered` | boolean | no | true = cubierta o con techo; false = al aire libre. |
| `isActive` | boolean | no | Si se omite, true. Para recibir reservas además necesita las 3 fotos obligatorias. |
| `currency` | string | no | Código ISO 4217. Si se omite, COP. · patrón `^[A-Z]{3}$` Ej.: `"COP"` |
| `basePricePerHour` | number | no | Precio por hora donde ninguna tarifa aplica. · mín. 0, máx. 1000000000 Ej.: `80000` |
| `slotDuration` | `30` \| `60` \| `90` \| `120` | no | Duración del turno en minutos: 30, 60, 90 o 120. Si se omite, 60. |
| `schedules` | CourtScheduleDto[] | no | Los 7 días de la semana, cada uno una vez. · 7+ elementos |
| `rates` | CourtRateDto[] | no | Tarifas por franja; no se pueden cruzar. |

**`CourtScheduleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `isOpen` | boolean | sí |  |
| `openTime` | string | no | Hora local de apertura; obligatoria si isOpen. Ej.: `"06:00"` |
| `closeTime` | string | no | Hora local de cierre; si es menor que openTime cierra al día siguiente. Ej.: `"23:00"` |

**`CourtRateDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `days` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY`[] | sí | Días en los que empieza la franja. · 1+ elementos Ej.: `["MONDAY","TUESDAY"]` |
| `name` | string | sí | 1+ caracteres, hasta 40 caracteres |
| `pricePerHour` | number | sí | Precio por hora en la moneda de la cancha. · mín. 0, máx. 1000000000 Ej.: `90000` |
| `startTime` | string | sí |  Ej.: `"18:00"` |
| `endTime` | string | sí | Si es menor que startTime, la franja termina al día siguiente. Ej.: `"23:00"` |

<details><summary>Ejemplo</summary>

```json
{
  "surface": "GRAMA_SINTETICA",
  "lengthMeters": 42,
  "widthMeters": 25,
  "playersPerSide": 5,
  "currency": "COP",
  "basePricePerHour": 80000
}
```

</details>

#### `GET /admin/clients/{id}/courts/{courtId}/availability`

Turnos de un día de una cancha del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AvailabilityDto](#availabilitydto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `courtId` | path | string | sí |  |
| `date` | query | string | sí | Día en la zona horaria del negocio. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `2026-10-13` |

#### `POST /admin/clients/{id}/reservations/{reservationId}/cancel`

Cancelar una reserva del cliente con su motivo

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [ReservationDto](#reservationdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `reservationId` | path | string | sí |  |

**Body** `application/json`

**`CancelReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reason` | string | sí | 3+ caracteres, hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "reason": "El cliente pidió cancelar"
}
```

</details>

#### `PATCH /admin/clients/{id}/customers/{customerId}`

Editar un cliente (persona) del negocio

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CustomerDto](#customerdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `customerId` | path | string | sí |  |

**Body** `application/json`

**`UpdateCustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Deporte habitual; si se omite se usa el que más reserva. |
| `name` | string | no | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | no | Se guardan solo los dígitos (y el + inicial). · patrón `^\+?[\d\s()-]{7,20}$` |
| `documentId` | string | no | Cédula u otro documento; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.117.523.456"` |
| `notes` | string | no | Notas internas del negocio. · hasta 1000 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "documentId": "1.117.523.456"
}
```

</details>

#### `GET /admin/clients/{id}/customers/{customerId}`

Ficha del cliente del negocio con todas sus reservas y pagos en detalle

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CustomerDetailDto](#customerdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `customerId` | path | string | sí |  |

## Imágenes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/images/business-profile/{id}` | Foto de portada de un negocio (pública) |
| GET | `/images/courts/{id}` | Foto de una cancha (pública) |

### images

#### `GET /images/business-profile/{id}`

Foto de portada de un negocio (pública)

- **Acceso:** público
- **Respuesta:** `200` · —

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `GET /images/courts/{id}`

Foto de una cancha (pública)

- **Acceso:** público
- **Respuesta:** `200` · —

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

## Modelos de respuesta

<a id="adminamenitydto"></a>

**`AdminAmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |
| `usageCount` | number | sí | Negocios que lo ofrecen. |

<a id="admincourtsurfacedto"></a>

**`AdminCourtSurfaceDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | sí | Deportes en los que se ofrece; vacío = todos. |
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |
| `usageCount` | number | sí | Canchas con esta superficie. |

<a id="adminpaymentmethoddto"></a>

**`AdminPaymentMethodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |
| `requiresReference` | boolean | sí |  |
| `usageCount` | number | sí | Pagos registrados con este método. |

<a id="adminprofiledto"></a>

**`AdminProfileDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí |  |
| `email` | string | sí |  |
| `phone` | string | sí |  |
| `roleLabel` | string | sí |  |
| `verified` | boolean | sí |  |

<a id="adminuserdto"></a>

**`AdminUserDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `role` | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | sí |  |
| `id` | string | sí |  |
| `displayName` | string | sí |  |
| `email` | string | sí |  |
| `phone` | string | sí |  |
| `verified` | boolean | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `businessName` | string | sí | Negocio que administra (si es ADMIN_NEGOCIO). |
| `authProviders` | string[] | sí | Formas de iniciar sesión: password, google, apple. |

<a id="amenitydto"></a>

**`AmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |

<a id="authresponsedto"></a>

**`AuthResponseDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `accessToken` | string | sí |  |
| `user` | [AuthUserDto](#authuserdto) | sí |  |

<a id="authuserdto"></a>

**`AuthUserDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `role` | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | sí |  |
| `id` | string | sí |  |
| `displayName` | string | sí |  |

<a id="availabilitycourtdto"></a>

**`AvailabilityCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `surfaceName` | string | sí | Superficie o tipo de grama, p. ej. Grama sintética. |
| `lengthMeters` | number | sí | Medidas en metros (las dos o ninguna). |
| `widthMeters` | number | sí |  |
| `playersPerSide` | number | sí | Jugadores por equipo (5 = fútbol 5). |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `isCovered` | boolean | sí |  |
| `slotDuration` | number | sí | Minutos de cada turno. |
| `currency` | string | sí |  |
| `photoUrl` | string | sí | Foto principal (MAIN). |

<a id="availabilitydto"></a>

**`AvailabilityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `slots` | [SlotDto](#slotdto)[] | sí |  |
| `date` | string | sí |  |
| `courtId` | string | sí |  |
| `slotDuration` | number | sí |  |
| `currency` | string | sí |  |
| `maxSlots` | number | sí | Turnos seguidos que se pueden reservar como máximo. |

<a id="bookingrulesdto"></a>

**`BookingRulesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `minAdvanceMinutes` | number | sí |  |
| `maxDaysAhead` | number | sí |  |
| `maxReservationsPerDay` | number | sí |  |
| `maxSlots` | number | sí |  |
| `holdMinutes` | number | sí |  |
| `paymentMethod` | string | sí | Las reservas web se pagan en la sede. |

<a id="businessaccountdto"></a>

**`BusinessAccountDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `admin` | [AdminProfileDto](#adminprofiledto) | sí |  |
| `subscription` | [SubscriptionDto](#subscriptiondto) | sí | null si el negocio aún no tiene plan. |

<a id="businessdashboarddto"></a>

**`BusinessDashboardDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `occupancyByCourt` | [CourtOccupancyDto](#courtoccupancydto)[] | sí |  |
| `byWeekday` | [WeekdayDto](#weekdaydto)[] | sí | Siempre los 7 días, de lunes a domingo. |
| `heatmap` | [HeatmapCellDto](#heatmapcelldto)[] | sí | Solo las celdas con reservas. |
| `topCustomers` | [TopCustomerDto](#topcustomerdto)[] | sí |  |
| `paymentMethods` | [PaymentMethodStatDto](#paymentmethodstatdto)[] | sí |  |
| `bySport` | [SportStatDto](#sportstatdto)[] | sí |  |
| `period` | [DashboardPeriodDto](#dashboardperioddto) | sí |  |
| `currency` | string | sí |  |
| `summary` | [DashboardSummaryDto](#dashboardsummarydto) | sí |  |
| `heatmapMax` | number | sí |  |

<a id="businessdto"></a>

**`BusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `description` | string | sí |  |
| `amenities` | string[] | sí | Códigos de los servicios que ofrece. |
| `imageUrl` | string | sí | URL pública de la foto de portada; null si no tiene. |
| `latitude` | number | sí | Punto de llegada; ambos null si aún no se fijó. |
| `longitude` | number | sí |  |

<a id="catalogrefdto"></a>

**`CatalogRefDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  |
| `name` | string | sí |  |

<a id="catalogsdto"></a>

**`CatalogsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `amenities` | [AmenityDto](#amenitydto)[] | sí |  |
| `paymentMethods` | [PaymentMethodDto](#paymentmethoddto)[] | sí |  |
| `courtSurfaces` | [CourtSurfaceDto](#courtsurfacedto)[] | sí |  |

<a id="clientcourtdto"></a>

**`ClientCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `isCovered` | boolean | sí |  |
| `currency` | string | sí | Código ISO 4217 de los precios. |
| `basePricePerHour` | number | sí |  |
| `isActive` | boolean | sí |  |
| `isComplete` | boolean | sí | Tiene las 3 fotos obligatorias. |

<a id="clientdetaildto"></a>

**`ClientDetailDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `description` | string | sí |  |
| `imageUrl` | string | sí | URL pública de la foto de portada; null si no tiene. |
| `latitude` | number | sí |  |
| `longitude` | number | sí |  |
| `amenities` | [CatalogRefDto](#catalogrefdto)[] | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `updatedAt` | string (date-time) | sí |  |
| `owner` | [ClientOwnerDetailDto](#clientownerdetaildto) | sí |  |
| `subscription` | [ClientSubscriptionDto](#clientsubscriptiondto) | sí |  |
| `courts` | [ClientCourtDto](#clientcourtdto)[] | sí |  |
| `stats` | [ClientStatsDto](#clientstatsdto) | sí |  |
| `recentReservations` | [ClientReservationDto](#clientreservationdto)[] | sí | Las 10 reservas más recientes por fecha de juego. |
| `recentPayments` | [ClientPaymentDto](#clientpaymentdto)[] | sí | Los 10 pagos más recientes. |

<a id="clientdto"></a>

**`ClientDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `owner` | object | sí |  |
| `plan` | object | sí |  |
| `subscriptionActive` | boolean | sí |  |
| `nextPayment` | string (date-time) | sí |  |
| `activeCourts` | number | sí |  |

<a id="clientownerdetaildto"></a>

**`ClientOwnerDetailDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `fullName` | string | sí |  |
| `email` | string | sí |  |
| `phone` | string | sí |  |
| `verified` | boolean | sí |  |
| `createdAt` | string (date-time) | sí |  |

<a id="clientpagedto"></a>

**`ClientPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [ClientDto](#clientdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="clientpaymentdto"></a>

**`ClientPaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` | sí |  |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | sí |  |
| `id` | string | sí |  |
| `receivedAt` | string (date-time) | sí |  |
| `customerName` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí |  |

<a id="clientreservationdto"></a>

**`ClientReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | sí |  |
| `id` | string | sí |  |
| `start` | string (date-time) | sí |  |
| `end` | string (date-time) | sí |  |
| `courtName` | string | sí |  |
| `customerName` | string | sí |  |
| `totalPrice` | number | sí |  |
| `currency` | string | sí |  |
| `cancellationReason` | string | sí |  |

<a id="clientstatsdto"></a>

**`ClientStatsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reservationsTotal` | number | sí |  |
| `reservationsLast30Days` | number | sí |  |
| `upcomingReservations` | number | sí | Reservas confirmadas desde ahora en adelante. |
| `approvedRevenueLast30Days` | number | sí | Pagos aprobados en los últimos 30 días, en COP. |
| `pendingPayments` | number | sí |  |

<a id="clientsubscriptiondto"></a>

**`ClientSubscriptionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `plan` | object | sí |  |
| `since` | string (date-time) | sí |  |
| `nextPayment` | string (date-time) | sí |  |
| `isActive` | boolean | sí |  |
| `autoBilling` | boolean | sí |  |

<a id="countbylabeldto"></a>

**`CountByLabelDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `label` | string | sí |  |
| `count` | number | sí |  |

<a id="courtdto"></a>

**`CourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `missingPhotos` | `MAIN` \| `SURFACE` \| `LIGHTING` \| `EXTRA_1` \| `EXTRA_2`[] | sí |  |
| `surface` | [CourtSurfaceRefDto](#courtsurfacerefdto) | sí |  |
| `lengthMeters` | number | sí |  |
| `widthMeters` | number | sí |  |
| `playersPerSide` | number | sí |  |
| `schedules` | [CourtScheduleDto](#courtscheduledto)[] | sí |  |
| `rates` | [CourtRateDto](#courtratedto)[] | sí |  |
| `photos` | [CourtPhotoDto](#courtphotodto)[] | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `isCovered` | boolean | sí |  |
| `isActive` | boolean | sí |  |
| `isComplete` | boolean | sí | Tiene las fotos MAIN, SURFACE y LIGHTING. |
| `isBookable` | boolean | sí | Activa y completa: puede recibir reservas. |
| `currency` | string | sí |  |
| `basePricePerHour` | number | sí |  |
| `slotDuration` | number | sí |  |

<a id="courtoccupancydto"></a>

**`CourtOccupancyDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `courtId` | string | sí |  |
| `name` | string | sí |  |
| `reservations` | number | sí |  |
| `bookedHours` | number | sí |  |
| `openHours` | number | sí |  |
| `occupancyPct` | number | sí |  |
| `booked` | number | sí | Valor de sus reservas confirmadas y jugadas. |

<a id="courtphotodto"></a>

**`CourtPhotoDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `slot` | `MAIN` \| `SURFACE` \| `LIGHTING` \| `EXTRA_1` \| `EXTRA_2` | sí |  |
| `url` | string | sí |  |

<a id="courtratedto"></a>

**`CourtRateDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `days` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY`[] | sí | Días en los que empieza la franja. · 1+ elementos Ej.: `["MONDAY","TUESDAY"]` |
| `name` | string | sí | 1+ caracteres, hasta 40 caracteres |
| `pricePerHour` | number | sí | Precio por hora en la moneda de la cancha. · mín. 0, máx. 1000000000 Ej.: `90000` |
| `startTime` | string | sí |  Ej.: `"18:00"` |
| `endTime` | string | sí | Si es menor que startTime, la franja termina al día siguiente. Ej.: `"23:00"` |

<a id="courtscheduledto"></a>

**`CourtScheduleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `isOpen` | boolean | sí |  |
| `openTime` | string | no | Hora local de apertura; obligatoria si isOpen. Ej.: `"06:00"` |
| `closeTime` | string | no | Hora local de cierre; si es menor que openTime cierra al día siguiente. Ej.: `"23:00"` |

<a id="courtslotsdto"></a>

**`CourtSlotsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `slots` | [SlotDto](#slotdto)[] | sí |  |
| `court` | [AvailabilityCourtDto](#availabilitycourtdto) | sí |  |
| `availableCount` | number | sí | Turnos AVAILABLE del día. |

<a id="courtsurfacedto"></a>

**`CourtSurfaceDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | sí | Deportes en los que se ofrece; vacío = todos. |
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |

<a id="courtsurfacerefdto"></a>

**`CourtSurfaceRefDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  Ej.: `"GRAMA_SINTETICA"` |
| `name` | string | sí |  |

<a id="currentholddto"></a>

**`CurrentHoldDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `hold` | [SlotHoldDto](#slotholddto) | sí |  |

<a id="customerdetaildto"></a>

**`CustomerDetailDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `businessId` | string | sí |  |
| `name` | string | sí |  |
| `phone` | string | sí |  |
| `documentId` | string | sí |  |
| `notes` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `updatedAt` | string (date-time) | sí |  |
| `metrics` | [CustomerMetricsDto](#customermetricsdto) | sí |  |
| `stats` | [CustomerStatsDto](#customerstatsdto) | sí |  |
| `reservations` | [CustomerReservationItemDto](#customerreservationitemdto)[] | sí |  |
| `payments` | [CustomerPaymentItemDto](#customerpaymentitemdto)[] | sí |  |

<a id="customerdto"></a>

**`CustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `phone` | string | sí | Con indicativo, p. ej. +573114567890. |
| `documentId` | string | sí |  |
| `notes` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |

<a id="customerlastvisitdto"></a>

**`CustomerLastVisitDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `date` | string (date-time) | sí |  |
| `courtName` | string | sí |  |

<a id="customermetricsdto"></a>

**`CustomerMetricsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `level` | `NEW` \| `RECURRENT` \| `FREQUENT` \| `VIP` | sí | Automático: NEW (0–1), RECURRENT (2–4), FREQUENT (5–19), VIP (20+). |
| `favoriteSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí | preferredSport si está definido; si no, el deporte más reservado. |
| `reservations` | number | sí | Reservas no canceladas. |
| `attendancePct` | number | sí | Jugadas ÷ (jugadas + no asistió), en %; null si aún no hay. |
| `totalSpent` | number | sí | Pagos aprobados. |
| `balance` | number | sí | Saldo de reservas confirmadas y jugadas. |
| `lastVisit` | [CustomerLastVisitDto](#customerlastvisitdto) | sí |  |

<a id="customerpaymentitemdto"></a>

**`CustomerPaymentItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí |  |
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` | sí |  |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | sí |  |
| `reference` | string | sí |  |
| `note` | string | sí |  |
| `rejectionReason` | string | sí |  |
| `registeredByBusiness` | boolean | sí |  |
| `receivedAt` | string (date-time) | sí |  |
| `reservationId` | string | sí |  |
| `courtName` | string | sí |  |
| `reservationStart` | string (date-time) | sí |  |
| `reservationEnd` | string (date-time) | sí |  |
| `refund` | [CustomerRefundItemDto](#customerrefunditemdto) | sí |  |

<a id="customerrefunditemdto"></a>

**`CustomerRefundItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `amount` | number | sí |  |
| `reason` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `createdBy` | string | sí |  |

<a id="customerreservationitemdto"></a>

**`CustomerReservationItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `courtId` | string | sí |  |
| `courtName` | string | sí |  |
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `currency` | string | sí |  |
| `start` | string (date-time) | sí |  |
| `end` | string (date-time) | sí |  |
| `customerName` | string | sí |  |
| `customerDetail` | string | sí |  |
| `phone` | string | sí |  |
| `contactNote` | string | sí |  |
| `tag` | string | sí |  |
| `isRecurring` | boolean | sí |  |
| `subtotal` | number | sí |  |
| `discount` | number | sí |  |
| `totalPrice` | number | sí |  |
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | sí |  |
| `cancellationReason` | string | sí |  |
| `cancelledAt` | string (date-time) | sí |  |
| `cancelledByName` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `payments` | [CustomerPaymentItemDto](#customerpaymentitemdto)[] | sí |  |
| `refunds` | [CustomerRefundItemDto](#customerrefunditemdto)[] | sí |  |

<a id="customerstatsdto"></a>

**`CustomerStatsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `totalReservations` | number | sí |  |
| `confirmedReservations` | number | sí |  |
| `completedReservations` | number | sí |  |
| `cancelledReservations` | number | sí |  |
| `noShowReservations` | number | sí |  |
| `totalSpent` | number | sí |  |
| `pendingPayments` | number | sí |  |
| `totalRefunded` | number | sí |  |

<a id="dashboarddto"></a>

**`DashboardDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `clients` | object | sí |  |
| `users` | object | sí |  |
| `activeCourts` | number | sí |  |
| `reservationsLast30Days` | number | sí |  |
| `monthlyRecurringRevenue` | number | sí | Suma del precio mensual de las suscripciones activas (COP). |
| `clientsByPlan` | [CountByLabelDto](#countbylabeldto)[] | sí |  |
| `signupsByMonth` | [MonthlySignupsDto](#monthlysignupsdto)[] | sí |  |

<a id="dashboardperioddto"></a>

**`DashboardPeriodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | `TODAY` \| `LAST_7_DAYS` \| `LAST_30_DAYS` \| `THIS_MONTH` \| `CUSTOM` | sí |  |
| `from` | string | sí |  |
| `to` | string | sí |  |
| `days` | number | sí |  |
| `previousFrom` | string | sí | Período anterior de la misma duración, para comparar. |
| `previousTo` | string | sí |  |

<a id="dashboardsummarydto"></a>

**`DashboardSummaryDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reservations` | [TrendDto](#trenddto) | sí | Reservas que empiezan en el período (todas, incluidas canceladas). |
| `confirmed` | number | sí |  |
| `completed` | number | sí |  |
| `noShow` | number | sí |  |
| `cancelled` | number | sí |  |
| `collected` | [TrendDto](#trenddto) | sí | Pagos aprobados recibidos en el período. |
| `booked` | number | sí | Valor de las reservas confirmadas y jugadas del período. |
| `pendingBalance` | number | sí | Lo que falta por cobrar de esas reservas. |
| `pendingPayments` | object | sí |  |
| `occupancyPct` | [TrendDto](#trenddto) | sí | Horas reservadas ÷ horas abiertas, en %. |
| `bookedHours` | number | sí |  |
| `openHours` | number | sí |  |
| `averageTicket` | number | sí | booked ÷ reservas confirmadas y jugadas. |
| `newCustomers` | [TrendDto](#trenddto) | sí |  |
| `cancellationRate` | number | sí | Canceladas ÷ total, en %. |
| `noShowRate` | number | sí | No asistió ÷ total, en %. |
| `discounts` | number | sí | Descuentos de las reservas confirmadas y jugadas. |
| `refunds` | object | sí |  |

<a id="healthdto"></a>

**`HealthDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|

<a id="heatmapcelldto"></a>

**`HeatmapCellDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `hour` | number | sí | Hora local de inicio, 0–23. |
| `reservations` | number | sí |  |

<a id="monthlysignupsdto"></a>

**`MonthlySignupsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `month` | string | sí | Mes en formato YYYY-MM. |
| `clients` | number | sí |  |
| `players` | number | sí |  |

<a id="onlinebookingsettingsdto"></a>

**`OnlineBookingSettingsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | sí |  |
| `slug` | string | sí |  |
| `url` | string | sí | Link para compartir. |
| `bookingAvailable` | boolean | sí |  |
| `unavailableReason` | string | sí |  |

<a id="paymentdto"></a>

**`PaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` | sí |  |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | sí |  |
| `id` | string | sí |  |
| `customerName` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí | Código del método de pago. |
| `receivedAt` | string (date-time) | sí |  |
| `reservationId` | string | sí |  |
| `courtName` | string | sí |  |
| `reservationStart` | string (date-time) | sí |  |
| `reference` | string | sí |  |
| `note` | string | sí |  |
| `rejectionReason` | string | sí |  |
| `registeredByBusiness` | boolean | sí |  |

<a id="paymentmethoddto"></a>

**`PaymentMethodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |
| `requiresReference` | boolean | sí |  |

<a id="paymentmethodstatdto"></a>

**`PaymentMethodStatDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  |
| `name` | string | sí |  |
| `count` | number | sí |  |
| `amount` | number | sí |  |
| `pct` | number | sí | % del total cobrado. |

<a id="planbenefitdto"></a>

**`PlanBenefitDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí |  |
| `detail` | string | sí |  |

<a id="planbenefitinputdto"></a>

**`PlanBenefitInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí | 2+ caracteres, hasta 60 caracteres |
| `detail` | string | sí | hasta 200 caracteres |

<a id="plandto"></a>

**`PlanDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 40 caracteres Ej.: `"Pro"` |
| `monthlyPrice` | number | sí | Precio mensual en COP. · mín. 0, máx. 100000000 Ej.: `179000` |
| `courtLimit` | number | sí | Canchas activas permitidas. · mín. 1, máx. 500 Ej.: `8` |
| `benefits` | [PlanBenefitInputDto](#planbenefitinputdto)[] | sí |  |
| `id` | string | sí |  |
| `subscriptions` | number | sí | Negocios suscritos a este plan. |

<a id="playerdto"></a>

**`PlayerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `favoriteSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `fullName` | string | sí |  |
| `email` | string | sí |  |
| `phone` | string | sí |  |
| `documentId` | string | sí |  |
| `birthDate` | string | sí |  |

<a id="playersessiondto"></a>

**`PlayerSessionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `accessToken` | string | sí |  |
| `player` | [PlayerDto](#playerdto) | sí |  |

<a id="publicbusinessdto"></a>

**`PublicBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | sí | Deportes con al menos una cancha reservable. |
| `courts` | [PublicCourtDto](#publiccourtdto)[] | sí | Canchas reservables (activas y con sus fotos obligatorias). |
| `name` | string | sí |  |
| `slug` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `description` | string | sí |  |
| `amenities` | object[] | sí |  |
| `imageUrl` | string | sí |  |
| `latitude` | number | sí |  |
| `longitude` | number | sí |  |
| `mapsUrl` | string | sí | Abre Google Maps en el punto (o la dirección si no hay punto). |
| `currency` | string | sí |  |
| `rules` | [BookingRulesDto](#bookingrulesdto) | sí |  |
| `bookingAvailable` | boolean | sí |  |
| `unavailableReason` | string | sí | Por qué no se puede reservar: DISABLED, PLAN_INACTIVE o NO_COURTS. |

<a id="publiccourtdto"></a>

**`PublicCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `surface` | [CourtSurfaceRefDto](#courtsurfacerefdto) | sí |  |
| `lengthMeters` | number | sí |  |
| `widthMeters` | number | sí |  |
| `playersPerSide` | number | sí |  |
| `schedules` | [CourtScheduleDto](#courtscheduledto)[] | sí |  |
| `rates` | [CourtRateDto](#courtratedto)[] | sí |  |
| `photos` | [CourtPhotoDto](#courtphotodto)[] | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `isCovered` | boolean | sí |  |
| `currency` | string | sí |  |
| `basePricePerHour` | number | sí | Precio por hora donde ninguna tarifa aplica. |
| `slotDuration` | number | sí |  |

<a id="refunddto"></a>

**`RefundDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `customer` | object | sí |  |

<a id="reservationdto"></a>

**`ReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `payments` | [ReservationPaymentDto](#reservationpaymentdto)[] | sí |  |
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | sí |  |
| `source` | `BUSINESS` \| `WEB` | sí | BUSINESS (negocio o super admin) o WEB (jugador desde el link de reservas). |
| `id` | string | sí |  |
| `courtId` | string | sí |  |
| `courtName` | string | sí |  |
| `start` | string (date-time) | sí |  |
| `end` | string (date-time) | sí |  |
| `customer` | [CustomerDto](#customerdto) | sí | null en reservas anteriores a la tabla de clientes. |
| `customerName` | string | sí |  |
| `customerDetail` | string | sí |  |
| `phone` | string | sí |  |
| `contactNote` | string | sí |  |
| `tag` | string | sí |  |
| `isRecurring` | boolean | sí |  |
| `subtotal` | number | sí | Valor según las tarifas. |
| `discount` | number | sí |  |
| `totalPrice` | number | sí | subtotal - discount. |
| `currency` | string | sí | Código ISO 4217, p. ej. COP. |
| `amountPaid` | number | sí | Suma de los pagos aprobados. |
| `balance` | number | sí | totalPrice - amountPaid. |
| `cancellationReason` | string | sí |  |
| `cancelledAt` | string (date-time) | sí |  |
| `cancelledBy` | string | sí | Nombre de quien canceló. |

<a id="reservationpagedto"></a>

**`ReservationPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [ReservationDto](#reservationdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="reservationpaymentdto"></a>

**`ReservationPaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` | sí |  |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | sí |  |
| `id` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí |  |
| `reference` | string | sí |  |
| `receivedAt` | string (date-time) | sí |  |

<a id="slotdto"></a>

**`SlotDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `status` | `AVAILABLE` \| `BOOKED` \| `PAST` \| `UNAVAILABLE` \| `HELD` | sí | Solo en la web: UNAVAILABLE = libre pero dentro de la anticipación mínima; HELD = otro jugador lo apartó mientras confirma. |
| `start` | string (date-time) | sí |  |
| `end` | string (date-time) | sí |  |
| `price` | number | sí | Valor del turno según las tarifas. |

<a id="slotholddto"></a>

**`SlotHoldDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `courtId` | string | sí |  |
| `start` | string (date-time) | sí | Inicio del primer turno y fin del último. |
| `end` | string (date-time) | sí |  |
| `slots` | number | sí |  |
| `expiresAt` | string (date-time) | sí | Cuándo se libera si no se confirma. |

<a id="sportavailabilitydto"></a>

**`SportAvailabilityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `courts` | [CourtSlotsDto](#courtslotsdto)[] | sí | Una por cancha activa y con sus fotos, ordenadas por nombre. |
| `date` | string | sí |  |
| `maxSlots` | number | sí |  |

<a id="sportstatdto"></a>

**`SportStatDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `reservations` | number | sí |  |
| `booked` | number | sí |  |

<a id="subscriptiondto"></a>

**`SubscriptionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `planName` | string | sí |  |
| `monthlyPrice` | number | sí | Precio mensual en COP. |
| `since` | string (date-time) | sí |  |
| `nextPayment` | string (date-time) | sí |  |
| `courtLimit` | number | sí |  |
| `courtsInUse` | number | sí | Canchas activas en este momento. |
| `benefits` | [PlanBenefitDto](#planbenefitdto)[] | sí |  |
| `isActive` | boolean | sí |  |
| `autoBilling` | boolean | sí |  |

<a id="systemenumdto"></a>

**`SystemEnumDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí |  |
| `description` | string | sí |  |
| `values` | string[] | sí |  |

<a id="topcustomerdto"></a>

**`TopCustomerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `phone` | string | sí |  |
| `reservations` | number | sí |  |
| `paid` | number | sí | Pagos aprobados de esas reservas. |

<a id="trenddto"></a>

**`TrendDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `value` | number | sí |  |
| `previous` | number | sí |  |
| `changePct` | number | sí |  |

<a id="userpagedto"></a>

**`UserPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [AdminUserDto](#adminuserdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="weekdaydto"></a>

**`WeekdayDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `reservations` | number | sí |  |
| `booked` | number | sí |  |
