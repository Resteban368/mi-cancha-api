# Mi Cancha API — referencia de endpoints

> Generado por `npm run docs:api` a partir del código (decoradores de Swagger y DTOs). No lo edites a mano.
> Guía de uso (autenticación, errores, flujos): [README.md](README.md).

Base URL: `http://localhost:3000/api/v1` (local) · `https://mi-cancha-api.vercel.app/api/v1` (producción). 159 endpoints.

- [Salud y autenticación](#salud-y-autenticación) (8)
- [Negocio (app y panel)](#negocio-app-y-panel) (65)
- [Reservas en línea: público](#reservas-en-línea-público) (11)
- [Reservas en línea: jugador](#reservas-en-línea-jugador) (12)
- [Super admin](#super-admin) (57)
- [Imágenes](#imágenes) (3)
- [Modelos de respuesta](#modelos-de-respuesta) (134)

## Salud y autenticación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API y de la base de datos |
| POST | `/auth/business/register` | Registrar un administrador de negocio |
| POST | `/auth/business/signup` | Registrar un negocio nuevo con 15 días de prueba (crea cuenta, negocio y suscripción «Prueba») |
| POST | `/auth/business/login` | Iniciar sesión como negocio (email y contraseña) |
| POST | `/auth/google` | Iniciar sesión como jugador con Google |
| POST | `/auth/apple` | Iniciar sesión como jugador con Apple |
| PUT | `/auth/password` | Cambiar la contraseña del negocio (pide la actual y la nueva; 400 si la actual no coincide) |
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

#### `POST /auth/business/signup`

Registrar un negocio nuevo con 15 días de prueba (crea cuenta, negocio y suscripción «Prueba»)

- **Acceso:** público
- **Respuesta:** `201` · [AuthResponseDto](#authresponsedto)

**Body** `application/json`

**`SignupBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `email` | string (email) | sí |  Ej.: `"admin@golazo.co"` |
| `password` | string | sí | Mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres Ej.: `"MiCancha2026!"` |
| `phone` | string | sí | Celular de contacto del negocio. · 7+ caracteres, hasta 20 caracteres |
| `businessName` | string | sí |  |
| `address` | string | sí | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | sí | 2+ caracteres, hasta 120 caracteres Ej.: `"Centro"` |
| `cityId` | string (uuid) | sí | Ciudad del negocio (GET /catalogs/departments/:id/cities). |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "email": "admin@golazo.co",
  "password": "MiCancha2026!",
  "phone": "+57 300 123 4567",
  "businessName": "<businessName>",
  "address": "<address>",
  "neighborhood": "Centro",
  "cityId": "{{cityId}}"
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

#### `PUT /auth/password`

Cambiar la contraseña del negocio (pide la actual y la nueva; 400 si la actual no coincide)

- **Acceso:** Bearer token · rol `cualquier usuario autenticado`
- **Respuesta:** `204` · sin contenido

**Body** `application/json`

**`ChangePasswordDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `currentPassword` | string | sí | Contraseña con la que inicia sesión hoy. · hasta 72 caracteres |
| `newPassword` | string | sí | Mínimo 8 caracteres; debe ser distinta de la actual. · 8+ caracteres, hasta 72 caracteres Ej.: `"NuevaClave2026!"` |

<details><summary>Ejemplo</summary>

```json
{
  "currentPassword": "<currentPassword>",
  "newPassword": "NuevaClave2026!"
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
| PUT | `/business/profile/image` | Reemplazar la portada, la primera foto (JPG o PNG, máx. 4 MB) |
| DELETE | `/business/profile/image` | Quitar la foto de portada |
| POST | `/business/profile/photos` | Agregar una foto al negocio (hasta 5; JPG o PNG, máx. 4 MB) |
| PUT | `/business/profile/photos/order` | Ordenar las fotos; la primera es la portada del directorio |
| GET | `/catalogs` | Servicios, métodos de pago y superficies de cancha activos (para la app) |
| GET | `/catalogs/departments` | Departamentos de Colombia (DANE) |
| GET | `/business/courts` | Listar las canchas del negocio |
| POST | `/business/courts` | Crear una cancha con horarios y tarifas (respeta el límite del plan; las fotos se suben después) |
| GET | `/business/reservations` | Reservas del negocio: con date, la agenda de ese día (lista); sin date, todas paginadas (más recientes primero) |
| POST | `/business/reservations` | Reservar turnos seguidos con cliente (existente o nuevo), descuento y pago opcional |
| GET | `/business/availability` | Turnos de un día de todas las canchas reservables de un deporte (una tarjeta por cancha) |
| GET | `/business/customers` | Clientes: con page, la cartera paginada con métricas, resumen, filtros (segment) y orden (sort); sin page, búsqueda rápida (máx. 20) |
| POST | `/business/customers` | Registrar un cliente sin reserva |
| GET | `/business/notifications` | Bandeja del negocio: sus notificaciones (reservas nuevas y avisos), de la más reciente a la más antigua |
| GET | `/business/notifications/unread-count` | Cuántas notificaciones no ha leído (para la insignia) |
| POST | `/business/notifications/read-all` | Marcar todas como leídas |
| GET | `/business/notifications/vapid-key` | Clave pública VAPID para suscribir el navegador (404 si el servidor no tiene push configurado) |
| POST | `/business/notifications/subscriptions` | Suscribir este navegador a los avisos de nuevas reservas |
| DELETE | `/business/notifications/subscriptions` | Quitar la suscripción de este navegador |
| GET | `/business/refunds` | Devoluciones del negocio (más recientes primero) |
| GET | `/business/dashboard` | Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes |
| GET | `/business/online-booking` | Link público de reservas y si está activo |
| PATCH | `/business/online-booking` | Activar o desactivar el link, o cambiar su slug |
| GET | `/business/payments` | Listar pagos (filtrables por estado) |
| POST | `/business/payments` | Registrar un pago recibido por el negocio |
| GET | `/business/products` | Productos del negocio, por nombre (activos o todos) |
| POST | `/business/products` | Crear un producto |
| GET | `/business/sales` | Ventas de un día o de una reserva (más recientes primero) |
| POST | `/business/sales` | Registrar una venta: consumo de una reserva (suma a su saldo) o venta suelta pagada |
| GET | `/business/cash/current` | Caja abierta con lo cobrado hasta ahora y el último cierre |
| POST | `/business/cash/open` | Abrir la caja con una base de efectivo |
| POST | `/business/cash/close` | Cerrar la caja con el efectivo contado (arqueo) |
| GET | `/business/cash/sessions` | Cierres anteriores (más recientes primero) |
| POST | `/business/cash/expenses` | Pago a un proveedor en la caja abierta |
| POST | `/business/cash/movements` | Ingreso o retiro manual de efectivo en la caja abierta |
| GET | `/business/suppliers` | Proveedores del negocio (activos o todos) |
| POST | `/business/suppliers` | Registrar un proveedor |
| GET | `/business/inventory` | Existencias de los productos y alertas |
| POST | `/business/inventory/entries` | Entrada de mercancía (suma al stock) |
| POST | `/business/inventory/adjustments` | Ajuste por conteo físico (deja el stock en ese valor) |
| GET | `/business/inventory/movements` | Historial de existencias (más recientes primero) |
| GET | `/business/account` | Perfil del administrador y suscripción |
| DELETE | `/business/profile/photos/{photoId}` | Quitar una foto del negocio |
| GET | `/catalogs/departments/{id}/cities` | Ciudades (municipios) de un departamento |
| GET | `/business/courts/{id}` | Detalle de una cancha |
| PATCH | `/business/courts/{id}` | Actualizar, activar o desactivar una cancha (schedules y rates reemplazan la lista completa) |
| DELETE | `/business/courts/{id}` | Desactivar una cancha |
| GET | `/business/reservations/{id}` | Detalle de una reserva |
| POST | `/business/reservations/{id}/cancel` | Cancelar una reserva confirmada con su motivo (libera el turno y devuelve los pagos) |
| PATCH | `/business/reservations/{id}/status` | Marcar como confirmada, jugada (COMPLETED) o no asistió (NO_SHOW) |
| GET | `/business/courts/{id}/availability` | Turnos de un día con su estado (AVAILABLE, BOOKED, PAST) y precio |
| GET | `/business/customers/{customerId}` | Ficha del cliente con sus reservas y pagos en detalle |
| PATCH | `/business/customers/{customerId}` | Editar nombre, teléfono, cédula, deporte habitual o notas (el nivel es automático) |
| POST | `/business/notifications/{id}/read` | Marcar una notificación como leída |
| PATCH | `/business/payments/{id}/approve` | Aprobar un pago pendiente |
| PATCH | `/business/payments/{id}/reject` | Rechazar un pago pendiente |
| PATCH | `/business/products/{id}` | Editar nombre, precio o activar/desactivar un producto |
| POST | `/business/sales/{id}/void` | Anular una venta (con motivo) |
| POST | `/business/cash/movements/{id}/void` | Anular un ingreso o retiro (caja abierta) |
| POST | `/business/cash/expenses/{id}/void` | Anular un pago a proveedor (caja abierta) |
| PATCH | `/business/suppliers/{id}` | Editar o activar/desactivar un proveedor |
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
| `name` | string | sí |  |
| `address` | string | sí | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `description` | string | no | hasta 1000 caracteres |
| `latitude` | number | no | Latitud del punto de llegada. Va junto con longitude; si se omiten, la ubicación se borra (es un PUT). Ej.: `4.6097` |
| `longitude` | number | no | Longitud del punto de llegada. Ej.: `-74.0817` |
| `cityId` | string (uuid) | no | Ciudad del negocio (id de `GET /catalogs/departments/:id/cities`); de ella sale el departamento. Obligatoria al crear el negocio; al actualizar, si se omite se conserva la actual. |
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

Reemplazar la portada, la primera foto (JPG o PNG, máx. 4 MB)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `DELETE /business/profile/image`

Quitar la foto de portada

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

#### `POST /business/profile/photos`

Agregar una foto al negocio (hasta 5; JPG o PNG, máx. 4 MB)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [BusinessDto](#businessdto)

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `PUT /business/profile/photos/order`

Ordenar las fotos; la primera es la portada del directorio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

**Body** `application/json`

**`ReorderPhotosDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `ids` | string (uuid)[] | sí |  |

<details><summary>Ejemplo</summary>

```json
{
  "ids": [
    "{{ids}}"
  ]
}
```

</details>

#### `DELETE /business/profile/photos/{photoId}`

Quitar una foto del negocio

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessDto](#businessdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `photoId` | path | string | sí |  |

### catalogs

#### `GET /catalogs`

Servicios, métodos de pago y superficies de cancha activos (para la app)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CatalogsDto](#catalogsdto)

#### `GET /catalogs/departments`

Departamentos de Colombia (DANE)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [DepartmentDto](#departmentdto)[]

#### `GET /catalogs/departments/{id}/cities`

Ciudades (municipios) de un departamento

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CityDto](#citydto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

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
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Cualquier cancha libre de este deporte: la API asigna la primera por nombre. Envía esto, `courtId` o `courtIds`. |
| `courtId` | string (uuid) | no | Cancha elegida. Envía esto, `courtIds` o `sport`. |
| `courtIds` | string (uuid)[] | no | Varias canchas a la vez (máximo 3), del mismo deporte y con el mismo turno, todas libres en la misma franja. Se reservan juntas o ninguna. · 1+ elementos |
| `courts` | number | no | Con `sport`: cuántas canchas libres reservar a la vez (1 a 3). Por defecto 1. · mín. 1, máx. 3 |
| `start` | string | sí | Inicio del primer turno (debe coincidir con un turno de GET …/availability). Ej.: `"2026-10-20T19:00:00-05:00"` |
| `slots` | number | sí | Turnos seguidos a reservar (la duración sale del turno de la cancha). · mín. 1, máx. 5 Ej.: `2` |
| `customerId` | string (uuid) | no | Cliente existente del negocio. Envía esto o `customer`. |
| `customer` | CustomerInputDto | no | Cliente nuevo (si el teléfono o la cédula ya existen, se usa el existente). |
| `customerDetail` | string | no | hasta 100 caracteres Ej.: `"Equipo Los Halcones"` |
| `contactNote` | string | no | hasta 200 caracteres |
| `tag` | string | no | hasta 30 caracteres Ej.: `"Torneo"` |
| `isRecurring` | boolean | no |  |
| `discount` | number | no | Se resta del valor de las tarifas; con varias canchas es sobre el total y se reparte en proporción al valor de cada una. Por defecto 0. · mín. 0, máx. 1000000000 Ej.: `10000` |
| `payment` | ReservationPaymentInputDto | no | Pago opcional al reservar (anticipo o total; con varias canchas, del total del grupo). |

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

### business / notifications

#### `GET /business/notifications`

Bandeja del negocio: sus notificaciones (reservas nuevas y avisos), de la más reciente a la más antigua

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [InboxPageDto](#inboxpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `unread` | query | boolean | no | true = solo las que no se han leído. |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `GET /business/notifications/unread-count`

Cuántas notificaciones no ha leído (para la insignia)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [UnreadCountDto](#unreadcountdto)

#### `POST /business/notifications/read-all`

Marcar todas como leídas

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `204` · sin contenido

#### `GET /business/notifications/vapid-key`

Clave pública VAPID para suscribir el navegador (404 si el servidor no tiene push configurado)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [VapidKeyDto](#vapidkeydto)

#### `POST /business/notifications/subscriptions`

Suscribir este navegador a los avisos de nuevas reservas

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `user-agent` | header | string | sí |  |

**Body** `application/json`

**`SubscribeDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `endpoint` | string (uri) | sí | URL del servicio push del navegador · hasta 2048 caracteres |
| `keys` | SubscriptionKeysDto | sí |  |

**`SubscriptionKeysDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `p256dh` | string | sí | 10+ caracteres, hasta 200 caracteres |
| `auth` | string | sí | 10+ caracteres, hasta 100 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "endpoint": "<endpoint>",
  "keys": {
    "p256dh": "<p256dh>",
    "auth": "<auth>"
  }
}
```

</details>

#### `DELETE /business/notifications/subscriptions`

Quitar la suscripción de este navegador

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `204` · sin contenido

**Body** `application/json`

**`UnsubscribeDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `endpoint` | string (uri) | sí | hasta 2048 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "endpoint": "<endpoint>"
}
```

</details>

#### `POST /business/notifications/{id}/read`

Marcar una notificación como leída

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

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
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` \| `VENTA` | sí |  |
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

### business / products

#### `GET /business/products`

Productos del negocio, por nombre (activos o todos)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [ProductDto](#productdto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `sort` | query | `name` \| `popular` | no | name (por defecto) o popular: más vendidos en los últimos 30 días primero. |
| `includeInactive` | query | boolean | no | true = también los desactivados (para administrar el catálogo). |

#### `POST /business/products`

Crear un producto

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [ProductDto](#productdto)

**Body** `application/json`

**`CreateProductDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `AGUA` \| `BEBIDA` \| `HIDRATANTE` \| `CERVEZA` \| `SNACK` \| `COMIDA` \| `ALQUILER` \| `OTRO` | no | Por defecto OTRO. |
| `name` | string | sí | 2+ caracteres, hasta 60 caracteres |
| `price` | number | sí | Precio por unidad. · mín. 0, máx. 100000000 Ej.: `2500` |
| `trackStock` | boolean | no | Con el módulo de Inventario: controlar sus existencias. |
| `minStock` | number | no | Alerta de stock bajo; null = sin alerta. · mín. 0, máx. 100000 |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Juan Pérez",
  "price": 2500
}
```

</details>

#### `PATCH /business/products/{id}`

Editar nombre, precio o activar/desactivar un producto

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [ProductDto](#productdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateProductDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `AGUA` \| `BEBIDA` \| `HIDRATANTE` \| `CERVEZA` \| `SNACK` \| `COMIDA` \| `ALQUILER` \| `OTRO` | no |  |
| `name` | string | no | 2+ caracteres, hasta 60 caracteres |
| `price` | number | no | mín. 0, máx. 100000000 |
| `isActive` | boolean | no |  |
| `trackStock` | boolean | no |  |
| `minStock` | number | no | mín. 0, máx. 100000 |

<details><summary>Ejemplo</summary>

```json
{}
```

</details>

### business / sales

#### `GET /business/sales`

Ventas de un día o de una reserva (más recientes primero)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [SaleDto](#saledto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `date` | query | string | no | Día (YYYY-MM-DD, hora local del negocio). |
| `reservationId` | query | string (uuid) | no |  |

#### `POST /business/sales`

Registrar una venta: consumo de una reserva (suma a su saldo) o venta suelta pagada

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [SaleDto](#saledto)

**Body** `application/json`

**`CreateSaleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | SaleItemInputDto[] | sí | 1+ elementos |
| `reservationId` | string (uuid) | no | Reserva a la que se carga el consumo; sin ella es una venta suelta y lleva payment. |
| `payment` | SalePaymentInputDto | no | Obligatorio en una venta suelta. En un consumo de reserva es opcional: lo cobra ya. |
| `customerName` | string | no | A quién se le vendió (venta suelta). · hasta 100 caracteres Ej.: `"Mostrador"` |
| `note` | string | no | hasta 300 caracteres |

**`SaleItemInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `productId` | string (uuid) | sí |  |
| `quantity` | number | sí | mín. 1, máx. 999 |

**`SalePaymentInputDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `method` | string | sí | Código del catálogo de métodos de pago (GET /catalogs). Ej.: `"EFECTIVO"` |
| `reference` | string | no | hasta 60 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "items": [
    {
      "productId": "{{productId}}",
      "quantity": 1
    }
  ],
  "payment": {
    "method": "EFECTIVO"
  },
  "customerName": "Mostrador"
}
```

</details>

#### `POST /business/sales/{id}/void`

Anular una venta (con motivo)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [SaleDto](#saledto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`VoidSaleDto`**

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

### business / cash

#### `GET /business/cash/current`

Caja abierta con lo cobrado hasta ahora y el último cierre

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [CashCurrentDto](#cashcurrentdto)

#### `POST /business/cash/open`

Abrir la caja con una base de efectivo

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashSessionDto](#cashsessiondto)

**Body** `application/json`

**`OpenCashDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `openingCash` | number | sí | Efectivo con que se abre la caja. · mín. 0, máx. 1000000000 Ej.: `50000` |
| `note` | string | no | hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "openingCash": 50000
}
```

</details>

#### `POST /business/cash/close`

Cerrar la caja con el efectivo contado (arqueo)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashSessionDto](#cashsessiondto)

**Body** `application/json`

**`CloseCashDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `countedCash` | number | sí | Efectivo contado al cerrar. · mín. 0, máx. 1000000000 Ej.: `242500` |
| `note` | string | no | hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "countedCash": 242500
}
```

</details>

#### `GET /business/cash/sessions`

Cierres anteriores (más recientes primero)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · —

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /business/cash/expenses`

Pago a un proveedor en la caja abierta

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashExpenseDto](#cashexpensedto)

**Body** `application/json`

**`CreateCashExpenseDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `supplierId` | string (uuid) | sí |  |
| `amount` | number | sí | mín. 0.01, máx. 1000000000 Ej.: `120000` |
| `method` | string | sí | Código del catálogo de métodos de pago. Si es EFECTIVO sale de la caja. Ej.: `"EFECTIVO"` |
| `concept` | string | sí | Qué se pagó. · 2+ caracteres, hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "supplierId": "{{supplierId}}",
  "amount": 120000,
  "method": "EFECTIVO",
  "concept": "<concept>"
}
```

</details>

#### `POST /business/cash/movements`

Ingreso o retiro manual de efectivo en la caja abierta

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashMovementDto](#cashmovementdto)

**Body** `application/json`

**`CreateCashMovementDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | `INGRESO` \| `RETIRO` | sí | INGRESO = se agrega efectivo; RETIRO = se saca efectivo. |
| `amount` | number | sí | mín. 0.01, máx. 1000000000 Ej.: `50000` |
| `reason` | string | sí | 2+ caracteres, hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "type": "INGRESO",
  "amount": 50000,
  "reason": "El cliente pidió cancelar"
}
```

</details>

#### `POST /business/cash/movements/{id}/void`

Anular un ingreso o retiro (caja abierta)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashMovementDto](#cashmovementdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`VoidCashExpenseDto`**

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

#### `POST /business/cash/expenses/{id}/void`

Anular un pago a proveedor (caja abierta)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [CashExpenseDto](#cashexpensedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`VoidCashExpenseDto`**

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

### business / suppliers

#### `GET /business/suppliers`

Proveedores del negocio (activos o todos)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [SupplierDto](#supplierdto)[]

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `includeInactive` | query | boolean | no | true = también los desactivados (para administrarlos). |

#### `POST /business/suppliers`

Registrar un proveedor

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [SupplierDto](#supplierdto)

**Body** `application/json`

**`CreateSupplierDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | 2+ caracteres, hasta 80 caracteres |
| `documentId` | string | no | NIT o cédula. · hasta 30 caracteres Ej.: `"900123456-7"` |
| `phone` | string | no | hasta 30 caracteres |
| `notes` | string | no | hasta 300 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "name": "Juan Pérez",
  "documentId": "900123456-7"
}
```

</details>

#### `PATCH /business/suppliers/{id}`

Editar o activar/desactivar un proveedor

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [SupplierDto](#supplierdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateSupplierDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | no | 2+ caracteres, hasta 80 caracteres |
| `documentId` | string | no | hasta 30 caracteres |
| `phone` | string | no | hasta 30 caracteres |
| `notes` | string | no | hasta 300 caracteres |
| `isActive` | boolean | no |  |

<details><summary>Ejemplo</summary>

```json
{}
```

</details>

### business / inventory

#### `GET /business/inventory`

Existencias de los productos y alertas

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [InventoryDto](#inventorydto)

#### `POST /business/inventory/entries`

Entrada de mercancía (suma al stock)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [StockMovementDto](#stockmovementdto)

**Body** `application/json`

**`StockEntryDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `productId` | string (uuid) | sí |  |
| `quantity` | number | sí | Unidades que entran. · mín. 1, máx. 100000 Ej.: `24` |
| `unitCost` | number | no | Costo por unidad (opcional). · mín. 0, máx. 100000000 Ej.: `3200` |
| `supplierId` | string (uuid) | no |  |
| `note` | string | no | hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "productId": "{{productId}}",
  "quantity": 24,
  "unitCost": 3200
}
```

</details>

#### `POST /business/inventory/adjustments`

Ajuste por conteo físico (deja el stock en ese valor)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `201` · [StockMovementDto](#stockmovementdto)

**Body** `application/json`

**`StockAdjustmentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `productId` | string (uuid) | sí |  |
| `stock` | number | sí | Unidades que hay de verdad (conteo físico). · mín. 0, máx. 100000 Ej.: `18` |
| `reason` | string | sí | 2+ caracteres, hasta 200 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "productId": "{{productId}}",
  "stock": 18,
  "reason": "El cliente pidió cancelar"
}
```

</details>

#### `GET /business/inventory/movements`

Historial de existencias (más recientes primero)

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · —

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |
| `productId` | query | string (uuid) | no |  |

### business / account

#### `GET /business/account`

Perfil del administrador y suscripción

- **Acceso:** Bearer token · rol `ADMIN_NEGOCIO`
- **Respuesta:** `200` · [BusinessAccountDto](#businessaccountdto)

## Reservas en línea: público

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/public/businesses` | Directorio de sedes que reciben reservas: filtros, orden por cercanía (lat y lng) y paginación |
| GET | `/public/cities` | Ciudades que ya tienen sedes reservables, con cuántas (selector del directorio) |
| GET | `/public/businesses/map` | Ubicación de todas las sedes que reciben reservas (mapa del directorio) |
| GET | `/public/amenities` | Servicios activos para filtrar el directorio |
| POST | `/public/auth/register/code` | Registro, paso 1: si el celular está libre, le envía el código por SMS |
| POST | `/public/auth/register` | Registro, paso 2: crea la cuenta con el código del SMS o el token de /otp/verify |
| POST | `/public/auth/password/code` | Olvidé mi contraseña: envía un código por SMS si el celular tiene cuenta (responde igual si no) |
| POST | `/public/auth/password/reset` | Nueva contraseña con el código del SMS; deja la sesión iniciada |
| POST | `/public/auth/login` | Iniciar sesión con celular o cédula y contraseña |
| GET | `/public/businesses/{slug}` | Información pública del negocio para reservar |
| GET | `/public/businesses/{slug}/availability` | Turnos de un día de todas las canchas de un deporte (HELD = otro jugador los apartó) |

### public / reservas en línea

#### `GET /public/businesses`

Directorio de sedes que reciben reservas: filtros, orden por cercanía (lat y lng) y paginación

- **Acceso:** público
- **Respuesta:** `200` · [DirectoryPageDto](#directorypagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `q` | query | string | no | Busca en nombre, barrio y dirección. · hasta 80 caracteres |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no |  |
| `amenity` | query | string | no | Código de un servicio del catálogo, p. ej. PARQUEADERO. · patrón `^[A-Z_]{2,40}$` |
| `cityId` | query | string (uuid) | no | Ciudad elegida (id de GET /public/cities): solo trae las sedes de esa ciudad. |
| `lat` | query | number | no | Latitud del usuario (solo si pidió "cerca de mí"). Va junto con lng. · mín. -90, máx. 90 |
| `lng` | query | number | no | mín. -180, máx. 180 |
| `radiusKm` | query | number | no | Radio en km alrededor de lat/lng: solo trae sedes a esa distancia o menos (las que no tienen punto en el mapa quedan fuera). Exige lat y lng. · mín. 1, máx. 1000 |
| `page` | query | number | no | mín. 1 |
| `limit` | query | number | no | mín. 1, máx. 50 |

#### `GET /public/cities`

Ciudades que ya tienen sedes reservables, con cuántas (selector del directorio)

- **Acceso:** público
- **Respuesta:** `200` · [DirectoryCityDto](#directorycitydto)[]

#### `GET /public/businesses/map`

Ubicación de todas las sedes que reciben reservas (mapa del directorio)

- **Acceso:** público
- **Respuesta:** `200` · [DirectoryMapPointDto](#directorymappointdto)[]

#### `GET /public/amenities`

Servicios activos para filtrar el directorio

- **Acceso:** público
- **Respuesta:** `200` · [PublicAmenityDto](#publicamenitydto)[]

#### `POST /public/auth/register/code`

Registro, paso 1: si el celular está libre, le envía el código por SMS

- **Acceso:** público
- **Respuesta:** `200` · [OtpSentDto](#otpsentdto)

**Body** `application/json`

**`StartRegistrationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Celular de Colombia; recibe el código por SMS y sirve para ingresar. |
| `password` | string | sí | Mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres |
| `acceptDataPolicy` | boolean | sí | Debe ser true: aceptación de la política de tratamiento de datos. |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "phone": "+57 300 123 4567",
  "password": "Contrasena2026!",
  "acceptDataPolicy": true
}
```

</details>

#### `POST /public/auth/register`

Registro, paso 2: crea la cuenta con el código del SMS o el token de /otp/verify

- **Acceso:** público
- **Respuesta:** `201` · [PlayerSessionDto](#playersessiondto)

**Body** `application/json`

**`RegisterPlayerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `phone` | string | sí | Celular de Colombia; recibe el código por SMS y sirve para ingresar. |
| `password` | string | sí | Mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres |
| `acceptDataPolicy` | boolean | sí | Debe ser true: aceptación de la política de tratamiento de datos. |
| `code` | string | no |  Ej.: `123456` |
| `verificationToken` | string | no | hasta 2000 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "phone": "+57 300 123 4567",
  "password": "Contrasena2026!",
  "acceptDataPolicy": true,
  "code": 123456
}
```

</details>

#### `POST /public/auth/password/code`

Olvidé mi contraseña: envía un código por SMS si el celular tiene cuenta (responde igual si no)

- **Acceso:** público
- **Respuesta:** `200` · [OtpSentDto](#otpsentdto)

**Body** `application/json`

**`PasswordResetCodeDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `phone` | string | sí | Celular de la cuenta. |

<details><summary>Ejemplo</summary>

```json
{
  "phone": "+57 300 123 4567"
}
```

</details>

#### `POST /public/auth/password/reset`

Nueva contraseña con el código del SMS; deja la sesión iniciada

- **Acceso:** público
- **Respuesta:** `200` · [PlayerSessionDto](#playersessiondto)

**Body** `application/json`

**`ResetPasswordDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `phone` | string | sí | Celular de la cuenta. |
| `password` | string | sí | Contraseña nueva, mínimo 8 caracteres. · 8+ caracteres, hasta 72 caracteres |
| `code` | string | no | Código de 6 dígitos del SMS. Envía esto o `verificationToken`. Ej.: `123456` |
| `verificationToken` | string | no | Token de POST /public/auth/otp/verify. Envía esto o `code`. · hasta 2000 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "phone": "+57 300 123 4567",
  "password": "Contrasena2026!",
  "code": 123456
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
| `identifier` | string | sí | Celular (o la cédula, si ya la registró en su perfil). · 4+ caracteres, hasta 30 caracteres Ej.: `"3115550001"` |
| `password` | string | sí | 1+ caracteres, hasta 72 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "identifier": "3115550001",
  "password": "Contrasena2026!"
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
| PATCH | `/player/me` | Mi perfil: completar o cambiar nombre, correo, cédula, nacimiento y deporte |
| PUT | `/player/password` | Cambiar mi contraseña (pide la actual; si la cuenta la creó un negocio, la actual es la cédula) |
| POST | `/player/consent` | Aceptar la política de tratamiento de datos personales |
| GET | `/player/businesses` | Mis sedes: los negocios donde ya soy cliente (tengo al menos una reserva) |
| GET | `/player/reservations` | Todas mis reservas en todas las sedes, con filtros por estado (próximas, jugadas, canceladas, no asistí), deporte y sede |
| GET | `/player/stats` | Mi resumen: partidos jugados, horas, próximas, canceladas, deporte y sede favoritos y actividad de los últimos meses |
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

#### `PATCH /player/me`

Mi perfil: completar o cambiar nombre, correo, cédula, nacimiento y deporte

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerDto](#playerdto)

**Body** `application/json`

**`UpdatePlayerProfileDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `birthDate` | string | no | null la quita. · patrón `^\d{4}-\d{2}-\d{2}$` Ej.: `"1995-04-21"` |
| `favoriteSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | null lo quita. |
| `fullName` | string | no | 2+ caracteres, hasta 100 caracteres Ej.: `"Laura Gómez"` |
| `email` | string (email) | no | hasta 120 caracteres Ej.: `"laura@correo.com"` |
| `documentId` | string | no | Cédula; se ignoran puntos, espacios y guiones. · patrón `^[\dA-Za-z.\s-]{4,20}$` Ej.: `"1.075.111.222"` |

<details><summary>Ejemplo</summary>

```json
{
  "birthDate": "1995-04-21",
  "fullName": "Laura Gómez",
  "email": "laura@correo.com",
  "documentId": "1.075.111.222"
}
```

</details>

#### `PUT /player/password`

Cambiar mi contraseña (pide la actual; si la cuenta la creó un negocio, la actual es la cédula)

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerDto](#playerdto)

**Body** `application/json`

**`ChangePlayerPasswordDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `currentPassword` | string | sí | Contraseña actual (si la cuenta la creó un negocio, es su cédula). · hasta 72 caracteres |
| `newPassword` | string | sí | 8+ caracteres, hasta 72 caracteres |

<details><summary>Ejemplo</summary>

```json
{
  "currentPassword": "<currentPassword>",
  "newPassword": "<newPassword>"
}
```

</details>

#### `POST /player/consent`

Aceptar la política de tratamiento de datos personales

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerDto](#playerdto)

#### `GET /player/businesses`

Mis sedes: los negocios donde ya soy cliente (tengo al menos una reserva)

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerBusinessDto](#playerbusinessdto)[]

#### `GET /player/reservations`

Todas mis reservas en todas las sedes, con filtros por estado (próximas, jugadas, canceladas, no asistí), deporte y sede

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerReservationPageDto](#playerreservationpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `status` | query | `ALL` \| `UPCOMING` \| `PLAYED` \| `CANCELLED` \| `NO_SHOW` | no |  |
| `sport` | query | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no |  |
| `business` | query | string | no | Slug de la sede. · patrón `^[a-z0-9-]{1,80}$` |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `GET /player/stats`

Mi resumen: partidos jugados, horas, próximas, canceladas, deporte y sede favoritos y actividad de los últimos meses

- **Acceso:** Bearer token · rol `JUGADOR`
- **Respuesta:** `200` · [PlayerStatsDto](#playerstatsdto)

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
| `courtIds` | string (uuid)[] | no | 1 a 3 canchas del mismo deporte y turno, libres en la misma franja (para jugar varias canchas a la vez). Envía esto o `courtId`. · 1+ elementos |
| `courtId` | string (uuid) | no | Una sola cancha (equivale a `courtIds` con una). |
| `start` | string | sí | Inicio del primer turno, tal como llega en la disponibilidad. |
| `slots` | number | sí | mín. 1, máx. 3 |

<details><summary>Ejemplo</summary>

```json
{
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
| `courtIds` | string (uuid)[] | no | 1 a 3 canchas del mismo deporte y turno, libres en la misma franja (para jugar varias canchas a la vez). Envía esto o `courtId`. · 1+ elementos |
| `courtId` | string (uuid) | no | Una sola cancha (equivale a `courtIds` con una). |
| `start` | string | sí | Inicio del primer turno, tal como llega en la disponibilidad. |
| `slots` | number | sí | mín. 1, máx. 3 |

<details><summary>Ejemplo</summary>

```json
{
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
| GET | `/admin/notifications/recipients` | Negocios y cuántos navegadores tienen con los avisos activados |
| GET | `/admin/notifications/broadcasts` | Historial de avisos enviados, con a cuántos llegó y cuántos lo leyeron |
| POST | `/admin/notifications/images` | Subir la imagen de un aviso (JPG o PNG, máx. 4 MB); devuelve su id para enviarlo en imageId |
| POST | `/admin/notifications/broadcast` | Enviar un aviso a todos los negocios o solo a los elegidos |
| GET | `/admin/dashboard` | Métricas generales de la plataforma |
| GET | `/admin/clients` | Listado de clientes (negocios) |
| POST | `/admin/clients` | Crear un cliente: usuario de negocio + negocio + plan |
| GET | `/admin/users` | Listado de usuarios |
| POST | `/admin/users/delete` | Eliminar varios jugadores de forma definitiva (ignora negocios y super admins) |
| GET | `/admin/plans` | Planes de suscripción |
| POST | `/admin/plans` | Crear un plan |
| GET | `/admin/enums` | Enums fijos del sistema (solo lectura) |
| GET | `/admin/security/otp` | Códigos SMS enviados: totales, por día y quién los pide más (por celular y por origen) |
| GET | `/admin/security/audit` | Auditoría: acciones del super admin y eventos de seguridad, del más reciente al más antiguo |
| GET | `/admin/security/audit/actions` | Acciones que se registran, con su categoría y etiqueta (para filtros) |
| PATCH | `/admin/catalogs/amenities/{id}` | Editar o (des)activar un servicio |
| PATCH | `/admin/catalogs/payment-methods/{id}` | Editar o (des)activar un método de pago |
| PATCH | `/admin/catalogs/court-surfaces/{id}` | Editar o (des)activar una superficie de cancha |
| DELETE | `/admin/notifications/images/{id}` | Quitar una imagen subida que todavía no se usó en ningún aviso |
| GET | `/admin/clients/{id}/dashboard` | Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes |
| GET | `/admin/clients/{id}/online-booking` | Link público de reservas del cliente |
| PATCH | `/admin/clients/{id}/online-booking` | Activar o desactivar el link del cliente, o cambiar su slug |
| GET | `/admin/clients/{id}` | Ficha del cliente: negocio, responsable, plan, canchas y actividad |
| PATCH | `/admin/clients/{id}` | Actualizar datos generales o ubicación del cliente |
| DELETE | `/admin/clients/{id}` | Eliminar el cliente de forma definitiva (negocio, canchas, reservas, pagos y la cuenta del responsable) |
| PATCH | `/admin/clients/{id}/owner` | Editar nombre, correo o celular del responsable del cliente |
| PUT | `/admin/clients/{id}/image` | Subir o reemplazar el logo/foto de portada del cliente (negocio) |
| DELETE | `/admin/clients/{id}/image` | Eliminar el logo/foto de portada del cliente (negocio) |
| POST | `/admin/clients/{id}/photos` | Agregar una foto al negocio del cliente (hasta 5) |
| PUT | `/admin/clients/{id}/photos/order` | Ordenar las fotos del negocio; la primera es la portada |
| GET | `/admin/clients/{id}/courts` | Canchas del cliente con horarios, tarifas y fotos |
| GET | `/admin/clients/{id}/availability` | Turnos de un día de todas las canchas de un deporte del cliente |
| GET | `/admin/clients/{id}/reservations` | Reservas del cliente: con date, la agenda de ese día; sin date, paginadas con filtros |
| POST | `/admin/clients/{id}/reservations` | Crear una reserva para el cliente (mismas reglas que el negocio) |
| GET | `/admin/clients/{id}/customers` | Clientes (personas) del negocio: con page, listado paginado con métricas; sin page, búsqueda rápida (máx. 20) |
| POST | `/admin/clients/{id}/customers` | Registrar un cliente (persona) del negocio |
| GET | `/admin/clients/{id}/refunds` | Devoluciones del negocio |
| PATCH | `/admin/clients/{id}/modules` | Activar o desactivar módulos del cliente (Ventas y caja) |
| PATCH | `/admin/clients/{id}/subscription` | Cambiar el plan o activar/suspender al cliente |
| PATCH | `/admin/plans/{id}` | Editar un plan |
| DELETE | `/admin/plans/{id}` | Eliminar un plan sin clientes |
| GET | `/admin/users/{id}/ban-preview` | Antes de bloquear: a quién y cuántas reservas futuras se cancelarían |
| POST | `/admin/users/{id}/ban` | Bloquear una cuenta (jugador o negocio): no puede ingresar y sus sesiones dejan de valer |
| DELETE | `/admin/users/{id}/ban` | Desbloquear una cuenta |
| DELETE | `/admin/clients/{id}/photos/{photoId}` | Quitar una foto del negocio del cliente |
| PATCH | `/admin/clients/{id}/courts/{courtId}` | Editar una cancha del cliente (mismas reglas que el negocio; schedules y rates reemplazan la lista) |
| GET | `/admin/clients/{id}/courts/{courtId}/availability` | Turnos de un día de una cancha del cliente |
| POST | `/admin/clients/{id}/reservations/{reservationId}/cancel` | Cancelar una reserva del cliente con su motivo |
| PATCH | `/admin/clients/{id}/customers/{customerId}` | Editar un cliente (persona) del negocio |
| GET | `/admin/clients/{id}/customers/{customerId}` | Ficha del cliente del negocio con todas sus reservas y pagos en detalle |
| DELETE | `/admin/clients/{id}/courts/{courtId}/photos/{slot}` | Eliminar una foto de una cancha del cliente (sin la principal la cancha deja de recibir reservas) |

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
| `requiresReference` | boolean | sí | Si al registrar el pago se pide el número de referencia o comprobante (siempre opcional). |

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

### admin / notificaciones

#### `GET /admin/notifications/recipients`

Negocios y cuántos navegadores tienen con los avisos activados

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BroadcastRecipientDto](#broadcastrecipientdto)[]

#### `GET /admin/notifications/broadcasts`

Historial de avisos enviados, con a cuántos llegó y cuántos lo leyeron

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BroadcastHistoryPageDto](#broadcasthistorypagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /admin/notifications/images`

Subir la imagen de un aviso (JPG o PNG, máx. 4 MB); devuelve su id para enviarlo en imageId

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · object

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `POST /admin/notifications/broadcast`

Enviar un aviso a todos los negocios o solo a los elegidos

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BroadcastResultDto](#broadcastresultdto)

**Body** `application/json`

**`BroadcastDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí | 1+ caracteres, hasta 60 caracteres Ej.: `"Mantenimiento programado"` |
| `body` | string | sí | 1+ caracteres, hasta 240 caracteres Ej.: `"Esta noche a las 11 p. m. la plataforma estará en mantenimiento."` |
| `url` | string | no | Ruta de la app que se abre al tocar el aviso; por defecto "/" · patrón `^\/(?!\/)[\w\-./?=&%#]{0,199}$` Ej.: `"/negocio/reservas"` |
| `imageId` | string (uuid) | no | Id de una imagen ya subida con POST /admin/notifications/images |
| `all` | boolean | sí | true = todos los negocios; false = solo los de businessIds |
| `businessIds` | string (uuid)[] | no | Negocios elegidos (cuando all es false) |

<details><summary>Ejemplo</summary>

```json
{
  "title": "Mantenimiento programado",
  "body": "Esta noche a las 11 p. m. la plataforma estará en mantenimiento.",
  "url": "/negocio/reservas",
  "all": true
}
```

</details>

#### `DELETE /admin/notifications/images/{id}`

Quitar una imagen subida que todavía no se usó en ningún aviso

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

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
| `businessName` | string | sí |  |
| `address` | string | sí | 3+ caracteres, hasta 200 caracteres |
| `neighborhood` | string | sí | 2+ caracteres, hasta 100 caracteres |
| `cityId` | string (uuid) | sí | Ciudad del negocio (GET /catalogs/departments/:id/cities); de ella sale el departamento. |
| `planId` | string (uuid) | sí |  |

<details><summary>Ejemplo</summary>

```json
{
  "fullName": "Juan Pérez",
  "email": "contacto@golazo.co",
  "password": "Contrasena2026!",
  "phone": 3001234567,
  "businessName": "<businessName>",
  "address": "<address>",
  "neighborhood": "<neighborhood>",
  "cityId": "{{cityId}}",
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
| `banned` | query | boolean | no | true = solo cuentas bloqueadas; false = solo activas. |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `POST /admin/users/delete`

Eliminar varios jugadores de forma definitiva (ignora negocios y super admins)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [DeleteUsersResultDto](#deleteusersresultdto)

**Body** `application/json`

**`DeleteUsersDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `ids` | string (uuid)[] | sí | Ids de los jugadores a eliminar (hasta 100 por vez). · 1+ elementos |

<details><summary>Ejemplo</summary>

```json
{
  "ids": [
    "{{ids}}"
  ]
}
```

</details>

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
| `cityId` | string (uuid) | no | Ciudad del negocio (GET /catalogs/departments/:id/cities). |
| `name` | string | no |  |
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

#### `DELETE /admin/clients/{id}`

Eliminar el cliente de forma definitiva (negocio, canchas, reservas, pagos y la cuenta del responsable)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `PATCH /admin/clients/{id}/owner`

Editar nombre, correo o celular del responsable del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateClientOwnerDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fullName` | string | no | 2+ caracteres, hasta 100 caracteres |
| `email` | string (email) | no | Con este correo inicia sesión el responsable; no puede repetirse. |
| `phone` | string | no | Celular del responsable. Cadena vacía para quitarlo. · hasta 20 caracteres |

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

#### `POST /admin/clients/{id}/photos`

Agregar una foto al negocio del cliente (hasta 5)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `201` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).

#### `PUT /admin/clients/{id}/photos/order`

Ordenar las fotos del negocio; la primera es la portada

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`ReorderPhotosDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `ids` | string (uuid)[] | sí |  |

<details><summary>Ejemplo</summary>

```json
{
  "ids": [
    "{{ids}}"
  ]
}
```

</details>

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
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | no | Cualquier cancha libre de este deporte: la API asigna la primera por nombre. Envía esto, `courtId` o `courtIds`. |
| `courtId` | string (uuid) | no | Cancha elegida. Envía esto, `courtIds` o `sport`. |
| `courtIds` | string (uuid)[] | no | Varias canchas a la vez (máximo 3), del mismo deporte y con el mismo turno, todas libres en la misma franja. Se reservan juntas o ninguna. · 1+ elementos |
| `courts` | number | no | Con `sport`: cuántas canchas libres reservar a la vez (1 a 3). Por defecto 1. · mín. 1, máx. 3 |
| `start` | string | sí | Inicio del primer turno (debe coincidir con un turno de GET …/availability). Ej.: `"2026-10-20T19:00:00-05:00"` |
| `slots` | number | sí | Turnos seguidos a reservar (la duración sale del turno de la cancha). · mín. 1, máx. 5 Ej.: `2` |
| `customerId` | string (uuid) | no | Cliente existente del negocio. Envía esto o `customer`. |
| `customer` | CustomerInputDto | no | Cliente nuevo (si el teléfono o la cédula ya existen, se usa el existente). |
| `customerDetail` | string | no | hasta 100 caracteres Ej.: `"Equipo Los Halcones"` |
| `contactNote` | string | no | hasta 200 caracteres |
| `tag` | string | no | hasta 30 caracteres Ej.: `"Torneo"` |
| `isRecurring` | boolean | no |  |
| `discount` | number | no | Se resta del valor de las tarifas; con varias canchas es sobre el total y se reparte en proporción al valor de cada una. Por defecto 0. · mín. 0, máx. 1000000000 Ej.: `10000` |
| `payment` | ReservationPaymentInputDto | no | Pago opcional al reservar (anticipo o total; con varias canchas, del total del grupo). |

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

#### `PATCH /admin/clients/{id}/modules`

Activar o desactivar módulos del cliente (Ventas y caja)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`UpdateModulesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sales` | boolean | sí | Ventas e inventario: productos, consumos, caja y stock. |

<details><summary>Ejemplo</summary>

```json
{
  "sales": true
}
```

</details>

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

#### `DELETE /admin/clients/{id}/photos/{photoId}`

Quitar una foto del negocio del cliente

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [ClientDetailDto](#clientdetaildto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `photoId` | path | string | sí |  |

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

#### `DELETE /admin/clients/{id}/courts/{courtId}/photos/{slot}`

Eliminar una foto de una cancha del cliente (sin la principal la cancha deja de recibir reservas)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [CourtDto](#courtdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |
| `courtId` | path | string | sí |  |
| `slot` | path | `MAIN` \| `SURFACE` \| `LIGHTING` \| `EXTRA_1` \| `EXTRA_2` | sí |  |

### admin / seguridad

#### `GET /admin/security/otp`

Códigos SMS enviados: totales, por día y quién los pide más (por celular y por origen)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [OtpStatsDto](#otpstatsdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `days` | query | number | no | Días hacia atrás para el gráfico y los rankings. · mín. 1, máx. 90 Ej.: `30` |

#### `GET /admin/security/audit`

Auditoría: acciones del super admin y eventos de seguridad, del más reciente al más antiguo

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AuditPageDto](#auditpagedto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `category` | query | `ADMIN` \| `SECURITY` | no |  |
| `action` | query | string | no | Código exacto, p. ej. player.login_failed. · patrón `^[a-z_.]{3,60}$` |
| `success` | query | boolean | no | true = solo los que salieron bien; false = solo los rechazados. |
| `from` | query | string | no | Desde este día (YYYY-MM-DD, hora de Colombia). · patrón `^\d{4}-\d{2}-\d{2}$` |
| `to` | query | string | no | Hasta este día incluido (YYYY-MM-DD, hora de Colombia). · patrón `^\d{4}-\d{2}-\d{2}$` |
| `page` | query | number | no | mín. 1, por defecto `1` |
| `pageSize` | query | number | no | mín. 1, máx. 100, por defecto `20` |
| `search` | query | string | no | Texto a buscar (nombre, email, teléfono…). · hasta 100 caracteres |

#### `GET /admin/security/audit/actions`

Acciones que se registran, con su categoría y etiqueta (para filtros)

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [AuditActionDto](#auditactiondto)[]

#### `GET /admin/users/{id}/ban-preview`

Antes de bloquear: a quién y cuántas reservas futuras se cancelarían

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BanPreviewDto](#banpreviewdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

#### `POST /admin/users/{id}/ban`

Bloquear una cuenta (jugador o negocio): no puede ingresar y sus sesiones dejan de valer

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `200` · [BanResultDto](#banresultdto)

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

**Body** `application/json`

**`BanUserDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reason` | string | sí | Por qué se bloquea; queda en la auditoría. · 3+ caracteres, hasta 300 caracteres |
| `cancelFutureReservations` | boolean | no | Cancela sus reservas futuras (con sus devoluciones). Por defecto no. |

<details><summary>Ejemplo</summary>

```json
{
  "reason": "El cliente pidió cancelar"
}
```

</details>

#### `DELETE /admin/users/{id}/ban`

Desbloquear una cuenta

- **Acceso:** Bearer token · rol `SUPER_ADMIN`
- **Respuesta:** `204` · sin contenido

| Parámetro | En | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| `id` | path | string | sí |  |

## Imágenes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/images/business-profile/{id}` | Foto de portada de un negocio (pública) |
| GET | `/images/courts/{id}` | Foto de una cancha (pública) |
| GET | `/images/notifications/{id}` | Imagen de un aviso (pública) |

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

#### `GET /images/notifications/{id}`

Imagen de un aviso (pública)

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
| `bannedAt` | string (date-time) | sí | Cuándo se bloqueó la cuenta; null si está activa. |
| `bannedReason` | string | sí |  |

<a id="amenitydto"></a>

**`AmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí |  |
| `name` | string | sí |  |
| `active` | boolean | sí |  |
| `sortOrder` | number | sí |  |

<a id="auditactiondto"></a>

**`AuditActionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `ADMIN` \| `SECURITY` | sí |  |
| `code` | string | sí |  |
| `label` | string | sí |  |

<a id="auditlogdto"></a>

**`AuditLogDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `ADMIN` \| `SECURITY` | sí |  |
| `actorRole` | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | sí |  |
| `metadata` | object | sí |  |
| `id` | string | sí |  |
| `action` | string | sí |  |
| `success` | boolean | sí |  |
| `actorId` | string | sí |  |
| `actorLabel` | string | sí |  |
| `entityType` | string | sí |  |
| `entityId` | string | sí |  |
| `source` | string | sí | Primeros 8 caracteres del hash de la IP (la misma de los códigos SMS). |
| `createdAt` | string (date-time) | sí |  |

<a id="auditpagedto"></a>

**`AuditPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [AuditLogDto](#auditlogdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

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

<a id="banpreviewdto"></a>

**`BanPreviewDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `role` | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | sí |  |
| `id` | string | sí |  |
| `displayName` | string | sí |  |
| `businessName` | string | sí | Negocio que administra (si es ADMIN_NEGOCIO). |
| `bannedAt` | string (date-time) | sí |  |
| `bannedReason` | string | sí |  |
| `futureReservations` | number | sí | Reservas confirmadas que todavía no pasan y se cancelarían: las del jugador o, si es un negocio, todas las de su negocio. |

<a id="banresultdto"></a>

**`BanResultDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `bannedAt` | string (date-time) | sí |  |
| `cancelledReservations` | number | sí | Reservas que se cancelaron al bloquear (0 si no se pidió cancelarlas). |
| `failedCancellations` | number | sí | Reservas que se quisieron cancelar y no se pudo; revisar a mano. |

<a id="bookinglinkdto"></a>

**`BookingLinkDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | sí |  |
| `slug` | string | sí |  |
| `url` | string | sí | Link para compartir. |
| `bookingAvailable` | boolean | sí | true cuando hay reservas encendidas, plan activo y al menos una cancha completa. |
| `unavailableReason` | string | sí | DISABLED, PLAN_INACTIVE o NO_COURTS; null si está disponible. |

<a id="bookingrulesdto"></a>

**`BookingRulesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `minAdvanceMinutes` | number | sí |  |
| `maxDaysAhead` | number | sí |  |
| `maxReservationsPerDay` | number | sí |  |
| `maxSlots` | number | sí |  |
| `holdMinutes` | number | sí |  |
| `maxCourts` | number | sí | Canchas que se pueden reservar a la vez en la misma franja. |
| `paymentMethod` | string | sí | Las reservas web se pagan en la sede. |

<a id="broadcasthistoryitemdto"></a>

**`BroadcastHistoryItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `title` | string | sí |  |
| `body` | string | sí |  |
| `url` | string | sí |  |
| `imageUrl` | string | sí |  |
| `scope` | string | sí | ALL o SELECTED. |
| `sentByLabel` | string | sí |  |
| `targeted` | number | sí |  |
| `reachable` | number | sí |  |
| `delivered` | number | sí |  |
| `read` | number | sí | Cuántos dueños ya la abrieron/leyeron en su bandeja. |
| `createdAt` | string (date-time) | sí |  |

<a id="broadcasthistorypagedto"></a>

**`BroadcastHistoryPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [BroadcastHistoryItemDto](#broadcasthistoryitemdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="broadcastrecipientdto"></a>

**`BroadcastRecipientDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `businessId` | string | sí |  |
| `name` | string | sí |  |
| `ownerName` | string | sí |  |
| `devices` | number | sí | Navegadores con los avisos activados; 0 = no recibiría nada. |
| `banned` | boolean | sí | Cuenta bloqueada: no recibe avisos. |

<a id="broadcastresultdto"></a>

**`BroadcastResultDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `businesses` | number | sí | Negocios a los que se dirigió el aviso. |
| `reachable` | number | sí | De ellos, cuántos tienen avisos activados. |
| `delivered` | number | sí | Navegadores que lo aceptaron. |

<a id="businessaccountdto"></a>

**`BusinessAccountDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `admin` | [AdminProfileDto](#adminprofiledto) | sí |  |
| `modules` | [BusinessModulesDto](#businessmodulesdto) | sí | Módulos adicionales que el super admin activa por negocio. |
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
| `sales` | [DashboardSalesDto](#dashboardsalesdto) | sí | Con filtro de deporte o cancha solo cuentan los consumos de esas canchas. |
| `salesEnabled` | boolean | sí | Si el negocio tiene el módulo de Ventas (si no, la app oculta `sales`). |

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
| `photos` | [BusinessPhotoDto](#businessphotodto)[] | sí | Fotos del negocio (hasta 5) en orden; la primera es la portada. |
| `city` | [CityRefDto](#cityrefdto) | sí | Ciudad y departamento; null en negocios anteriores que aún no la completan. |
| `bookingLink` | [BookingLinkDto](#bookinglinkdto) | sí | Link de reservas y si ya está activo. |
| `latitude` | number | sí | Punto de llegada; ambos null si aún no se fijó. |
| `longitude` | number | sí |  |

<a id="businessmodulesdto"></a>

**`BusinessModulesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sales` | [SalesModuleDto](#salesmoduledto) | sí | Ventas e inventario: productos, consumos, ventas sueltas, caja y stock. |

<a id="businessphotodto"></a>

**`BusinessPhotoDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `url` | string | sí |  |

<a id="cashcurrentdto"></a>

**`CashCurrentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `session` | [CashSessionDto](#cashsessiondto) | sí | Caja abierta con sus totales hasta ahora, o null. |
| `lastClosed` | [CashSessionDto](#cashsessiondto) | sí | Último cierre (para sugerir la base de la próxima apertura). |

<a id="cashexpensedto"></a>

**`CashExpenseDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `supplierId` | string | sí |  |
| `supplierName` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí | Código del método de pago. |
| `methodName` | string | sí |  |
| `concept` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `createdByName` | string | sí |  |
| `voidedAt` | string (date-time) | sí |  |
| `voidReason` | string | sí |  |

<a id="cashmethoddto"></a>

**`CashMethodDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí | Código del método de pago. |
| `name` | string | sí |  |
| `count` | number | sí |  |
| `amount` | number | sí |  |

<a id="cashmovementdto"></a>

**`CashMovementDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | `INGRESO` \| `RETIRO` | sí |  |
| `id` | string | sí |  |
| `amount` | number | sí |  |
| `reason` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `createdByName` | string | sí |  |
| `voidedAt` | string (date-time) | sí |  |
| `voidReason` | string | sí |  |

<a id="cashsessiondto"></a>

**`CashSessionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `methods` | [CashMethodDto](#cashmethoddto)[] | sí | Pagos aprobados del turno por método (de mayor a menor). |
| `expenses` | [CashExpenseDto](#cashexpensedto)[] | sí | Pagos a proveedores del turno (también los anulados), más recientes primero. |
| `movements` | [CashMovementDto](#cashmovementdto)[] | sí | Ingresos y retiros manuales de efectivo (también los anulados), más recientes primero. |
| `id` | string | sí |  |
| `openingCash` | number | sí |  |
| `openingNote` | string | sí |  |
| `openedAt` | string (date-time) | sí |  |
| `openedByName` | string | sí |  |
| `closedAt` | string (date-time) | sí |  |
| `closedByName` | string | sí |  |
| `closingNote` | string | sí |  |
| `expectedCash` | number | sí | Base + cobros en efectivo + ingresos − pagos a proveedores en efectivo − retiros (al cerrar o hasta ahora). |
| `countedCash` | number | sí | null mientras está abierta. |
| `difference` | number | sí | countedCash - expectedCash; negativo = faltante. |
| `collected` | number | sí | Suma de todos los métodos. |
| `expensesTotal` | number | sí | Pagos a proveedores sin anular, de cualquier método. |
| `cashExpensesTotal` | number | sí | De ellos, los pagados en efectivo: se restan del efectivo esperado. |
| `cashInTotal` | number | sí | Ingresos manuales sin anular (suman al esperado). |
| `cashOutTotal` | number | sí | Retiros sin anular (restan al esperado). |
| `businessName` | string | sí | Nombre del negocio (para el comprobante). |

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

<a id="citydto"></a>

**`CityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí | Código DANE de 5 dígitos. |
| `name` | string | sí |  |

<a id="cityrefdto"></a>

**`CityRefDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `department` | object | sí |  |

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
| `photos` | [BusinessPhotoDto](#businessphotodto)[] | sí | Fotos del negocio (hasta 5) en orden; la primera es la portada. |
| `city` | [CityRefDto](#cityrefdto) | sí | Ciudad y departamento; null si aún no la completan. |
| `bookingLink` | [BookingLinkDto](#bookinglinkdto) | sí | Link de reservas del negocio y si ya está activo. |
| `latitude` | number | sí |  |
| `longitude` | number | sí |  |
| `amenities` | [CatalogRefDto](#catalogrefdto)[] | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `updatedAt` | string (date-time) | sí |  |
| `owner` | [ClientOwnerDetailDto](#clientownerdetaildto) | sí |  |
| `subscription` | [ClientSubscriptionDto](#clientsubscriptiondto) | sí |  |
| `modules` | [ClientModulesDto](#clientmodulesdto) | sí | Módulos adicionales del negocio (los activa el super admin). |
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
| `city` | [CityRefDto](#cityrefdto) | sí | Ciudad y departamento; null en negocios anteriores que aún no la completan. |
| `createdAt` | string (date-time) | sí |  |
| `owner` | object | sí |  |
| `plan` | object | sí |  |
| `subscriptionActive` | boolean | sí | false si el cliente está suspendido (aparte de si su prueba venció: ver trialExpired). |
| `nextPayment` | string (date-time) | sí |  |
| `trialEndsAt` | string (date-time) | sí | Fin de la prueba gratuita; null si el plan es de pago. |
| `trialDaysLeft` | number | sí | Días que le quedan de prueba (0 si vence hoy); null si no está en prueba. |
| `trialExpired` | boolean | sí |  |
| `activeCourts` | number | sí |  |

<a id="clientmodulesdto"></a>

**`ClientModulesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sales` | object | sí |  |

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
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` \| `VENTA` | sí |  |
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
| `documentId` | string | sí |  |
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `businessId` | string | sí |  |
| `name` | string | sí |  |
| `phone` | string | sí |  |
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
| `documentId` | string | sí | null en clientes que llegaron por la web sin cédula. |
| `preferredSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `phone` | string | sí | Con indicativo, p. ej. +573114567890. |
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
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` \| `VENTA` | sí |  |
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

<a id="dashboardsalesdto"></a>

**`DashboardSalesDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `topProducts` | [TopProductDto](#topproductdto)[] | sí | Los 5 que más dinero dejaron. |
| `byDay` | [SalesDayDto](#salesdaydto)[] | sí | Todos los días del período, de más antiguo a más nuevo. |
| `total` | [TrendDto](#trenddto) | sí | Ventas sueltas + consumos cargados a reservas. |
| `walkIn` | number | sí | Ventas sueltas (cobradas en el momento). |
| `consumptions` | number | sí | Consumos cargados a reservas (se cobran con la reserva). |
| `count` | number | sí |  |
| `units` | number | sí |  |
| `averageConsumption` | number | sí | Consumos ÷ reservas confirmadas y jugadas que empiezan en el período. |
| `pendingConsumptions` | number | sí | Parte del saldo pendiente que son consumos (los pagos cubren primero la cancha). |

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

<a id="deleteusersresultdto"></a>

**`DeleteUsersResultDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `deleted` | number | sí | Jugadores eliminados. |
| `skipped` | number | sí | Ids ignorados: no existen o no son jugadores (los negocios y super admins no se borran aquí). |

<a id="departmentdto"></a>

**`DepartmentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `code` | string | sí | Código DANE de 2 dígitos. |
| `name` | string | sí |  |

<a id="directorybusinessdto"></a>

**`DirectoryBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sports` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL`[] | sí |  |
| `name` | string | sí |  |
| `slug` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `imageUrl` | string | sí |  |
| `latitude` | number | sí |  |
| `longitude` | number | sí |  |
| `courtCount` | number | sí | Canchas reservables (activas y con sus fotos obligatorias). |
| `amenities` | object[] | sí |  |
| `fromPricePerHour` | number | sí | Precio por hora más bajo entre sus canchas reservables; null si no hay. |
| `currency` | string | sí |  |
| `city` | [CityRefDto](#cityrefdto) | sí | Ciudad y departamento; null en sedes anteriores que aún no la completan. |
| `distanceKm` | number | sí | Solo si se pidieron lat y lng. |

<a id="directorycitydto"></a>

**`DirectoryCityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `department` | object | sí |  |
| `businessCount` | number | sí | Sedes que reciben reservas en esa ciudad. |

<a id="directorymappointdto"></a>

**`DirectoryMapPointDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí |  |
| `slug` | string | sí |  |
| `latitude` | number | sí |  |
| `longitude` | number | sí |  |

<a id="directorypagedto"></a>

**`DirectoryPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `businesses` | [DirectoryBusinessDto](#directorybusinessdto)[] | sí |  |
| `url` | string | sí | Link general de reservas para compartir: /reservar. |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `limit` | number | sí |  |

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

<a id="inboxpagedto"></a>

**`InboxPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [NotificationDto](#notificationdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |
| `unread` | number | sí | Cuántas no se han leído en total (para la insignia). |

<a id="inventorydto"></a>

**`InventoryDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [InventoryItemDto](#inventoryitemdto)[] | sí | Productos activos, por nombre (con y sin control de stock). |
| `tracked` | number | sí | Con control de stock. |
| `low` | number | sí | Con stock bajo (en el mínimo o por debajo, con existencias). |
| `out` | number | sí | Agotados (0 unidades). |

<a id="inventoryitemdto"></a>

**`InventoryItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `AGUA` \| `BEBIDA` \| `HIDRATANTE` \| `CERVEZA` \| `SNACK` \| `COMIDA` \| `ALQUILER` \| `OTRO` | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `price` | number | sí |  |
| `trackStock` | boolean | sí |  |
| `stock` | number | sí |  |
| `minStock` | number | sí |  |
| `lowStock` | boolean | sí |  |

<a id="monthlysignupsdto"></a>

**`MonthlySignupsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `month` | string | sí | Mes en formato YYYY-MM. |
| `clients` | number | sí |  |
| `players` | number | sí |  |

<a id="notificationdto"></a>

**`NotificationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | `NEW_RESERVATION` \| `ADMIN_BROADCAST` | sí |  |
| `data` | object | sí |  |
| `id` | string | sí |  |
| `title` | string | sí |  |
| `body` | string | sí |  |
| `url` | string | sí | Ruta de la app que se abre al tocarla. |
| `imageUrl` | string | sí | Imagen del aviso (URL pública), si tiene. |
| `readAt` | string (date-time) | sí | null = sin leer. |
| `createdAt` | string (date-time) | sí |  |

<a id="onlinebookingsettingsdto"></a>

**`OnlineBookingSettingsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | sí |  |
| `slug` | string | sí |  |
| `url` | string | sí | Link para compartir. |
| `bookingAvailable` | boolean | sí |  |
| `unavailableReason` | string | sí |  |

<a id="otpdailydto"></a>

**`OtpDailyDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `date` | string | sí | Día calendario en Colombia (YYYY-MM-DD). |
| `count` | number | sí |  |

<a id="otpsentdto"></a>

**`OtpSentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `message` | string | sí | Siempre el mismo: no revela si el número tiene cuenta. |

<a id="otpstatsdto"></a>

**`OtpStatsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `daily` | [OtpDailyDto](#otpdailydto)[] | sí |  |
| `topPhones` | [OtpTopPhoneDto](#otptopphonedto)[] | sí |  |
| `topSources` | [OtpTopSourceDto](#otptopsourcedto)[] | sí |  |
| `days` | number | sí | Días del período usado en el gráfico y los rankings. |
| `totals` | [OtpTotalsDto](#otptotalsdto) | sí |  |
| `period` | object | sí |  |

<a id="otptopphonedto"></a>

**`OtpTopPhoneDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `user` | [OtpTopUserDto](#otptopuserdto) | sí | Cuenta con ese celular; null si nadie se registró con él. |
| `phone` | string | sí | Celular en formato E.164. |
| `requests` | number | sí | Códigos enviados a este celular en el período. |
| `verified` | number | sí | De esos, cuántos se usaron para verificar. |
| `lastRequestAt` | string (date-time) | sí |  |

<a id="otptopsourcedto"></a>

**`OtpTopSourceDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `source` | string | sí | Primeros 8 caracteres del hash de la IP (la IP real no se guarda). |
| `requests` | number | sí |  |
| `phones` | number | sí | Celulares distintos que pidieron códigos desde ese origen. |

<a id="otptopuserdto"></a>

**`OtpTopUserDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `role` | `SUPER_ADMIN` \| `ADMIN_NEGOCIO` \| `JUGADOR` | sí |  |
| `id` | string | sí |  |
| `displayName` | string | sí |  |

<a id="otptotalsdto"></a>

**`OtpTotalsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `today` | number | sí | Desde las 00:00 de hoy (hora de Colombia). |
| `last7Days` | number | sí |  |
| `last30Days` | number | sí |  |
| `all` | number | sí | Todos los códigos enviados desde siempre. |

<a id="otpverifieddto"></a>

**`OtpVerifiedDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `verified` | boolean | sí |  |
| `verificationToken` | string | sí | Prueba de que el celular se verificó: se envía como `verificationToken` al registrarse o al cambiar la contraseña (en vez del código). |
| `expiresIn` | number | sí | Segundos de vigencia del token. |

<a id="paymentdto"></a>

**`PaymentDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` \| `VENTA` | sí |  |
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

<a id="playerbusinessdto"></a>

**`PlayerBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `slug` | string | sí |  |
| `name` | string | sí |  |
| `address` | string | sí |  |
| `neighborhood` | string | sí |  |
| `imageUrl` | string | sí |  |
| `clientSince` | string (date-time) | sí | Desde cuándo es cliente (su primera reserva en la sede). |

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
| `mustChangePassword` | boolean | sí | La cuenta la creó un negocio con la cédula como clave: debe cambiarla al ingresar. |
| `needsDataConsent` | boolean | sí | Aún no aceptó la política de tratamiento de datos. |

<a id="playerreservationdto"></a>

**`PlayerReservationDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `consumptions` | [SaleDto](#saledto)[] | sí | Ventas cargadas a la reserva (también las anuladas), de la más antigua a la más nueva. |
| `payments` | [ReservationPaymentDto](#reservationpaymentdto)[] | sí |  |
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | sí |  |
| `source` | `BUSINESS` \| `WEB` | sí | BUSINESS (negocio o super admin) o WEB (jugador desde el link de reservas). |
| `group` | [ReservationGroupDto](#reservationgroupdto) | sí | Si es parte de una reserva de varias canchas; los montos del grupo están aquí. |
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
| `consumptionsTotal` | number | sí | Suma de las ventas activas cargadas a la reserva (bebidas, snacks…). |
| `amountPaid` | number | sí | Suma de los pagos aprobados. |
| `balance` | number | sí | totalPrice + consumptionsTotal - amountPaid. |
| `cancellationReason` | string | sí |  |
| `cancelledAt` | string (date-time) | sí |  |
| `cancelledBy` | string | sí | Nombre de quien canceló. |
| `businessName` | string | sí |  |
| `businessSlug` | string | sí |  |

<a id="playerreservationpagedto"></a>

**`PlayerReservationPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [PlayerReservationDto](#playerreservationdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="playersessiondto"></a>

**`PlayerSessionDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `accessToken` | string | sí |  |
| `player` | [PlayerDto](#playerdto) | sí |  |

<a id="playerstatsbusinessdto"></a>

**`PlayerStatsBusinessDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí |  |
| `slug` | string | sí |  |
| `played` | number | sí |  |

<a id="playerstatsdto"></a>

**`PlayerStatsDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `favoriteSport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `topBusiness` | [PlayerStatsBusinessDto](#playerstatsbusinessdto) | sí |  |
| `bySport` | [PlayerStatsSportDto](#playerstatssportdto)[] | sí |  |
| `byMonth` | [PlayerStatsMonthDto](#playerstatsmonthdto)[] | sí | Partidos jugados en cada uno de los últimos 6 meses (del más antiguo al actual). |
| `next` | [PlayerStatsNextDto](#playerstatsnextdto) | sí |  |
| `total` | number | sí | Todas las reservas hechas (también canceladas). |
| `played` | number | sí | Jugados: completados o confirmados cuya hora ya pasó. |
| `upcoming` | number | sí |  |
| `cancelled` | number | sí |  |
| `noShow` | number | sí |  |
| `hoursPlayed` | number | sí | Horas de juego de los partidos jugados. |
| `spent` | number | sí | Valor de los partidos jugados según las tarifas. |
| `currency` | string | sí |  |

<a id="playerstatsmonthdto"></a>

**`PlayerStatsMonthDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `month` | string | sí | YYYY-MM en hora de Colombia. |
| `played` | number | sí |  |

<a id="playerstatsnextdto"></a>

**`PlayerStatsNextDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `start` | string (date-time) | sí |  |
| `end` | string (date-time) | sí |  |
| `businessName` | string | sí |  |
| `businessSlug` | string | sí |  |
| `courtName` | string | sí |  |

<a id="playerstatssportdto"></a>

**`PlayerStatsSportDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `sport` | `FUTBOL` \| `PADEL` \| `BALONCESTO` \| `VOLEIBOL` | sí |  |
| `played` | number | sí |  |

<a id="productdto"></a>

**`ProductDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `category` | `AGUA` \| `BEBIDA` \| `HIDRATANTE` \| `CERVEZA` \| `SNACK` \| `COMIDA` \| `ALQUILER` \| `OTRO` | sí |  |
| `id` | string | sí |  |
| `name` | string | sí |  |
| `price` | number | sí |  |
| `isActive` | boolean | sí |  |
| `sold` | number | sí | Unidades vendidas en los últimos 30 días (sin anuladas). |
| `trackStock` | boolean | sí | Inventario: si se controlan sus existencias y cuántas hay. |
| `stock` | number | sí |  |
| `minStock` | number | sí |  |
| `lowStock` | boolean | sí | Sin unidades o en el mínimo (solo si trackStock). |

<a id="publicamenitydto"></a>

**`PublicAmenityDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `code` | string | sí |  |
| `name` | string | sí |  |

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
| `photos` | string[] | sí | URLs de las fotos de la sede (hasta 5) en orden; la primera es la portada. |
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
| `consumptions` | [SaleDto](#saledto)[] | sí | Ventas cargadas a la reserva (también las anuladas), de la más antigua a la más nueva. |
| `payments` | [ReservationPaymentDto](#reservationpaymentdto)[] | sí |  |
| `status` | `CONFIRMED` \| `COMPLETED` \| `NO_SHOW` \| `CANCELLED` | sí |  |
| `source` | `BUSINESS` \| `WEB` | sí | BUSINESS (negocio o super admin) o WEB (jugador desde el link de reservas). |
| `group` | [ReservationGroupDto](#reservationgroupdto) | sí | Si es parte de una reserva de varias canchas; los montos del grupo están aquí. |
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
| `consumptionsTotal` | number | sí | Suma de las ventas activas cargadas a la reserva (bebidas, snacks…). |
| `amountPaid` | number | sí | Suma de los pagos aprobados. |
| `balance` | number | sí | totalPrice + consumptionsTotal - amountPaid. |
| `cancellationReason` | string | sí |  |
| `cancelledAt` | string (date-time) | sí |  |
| `cancelledBy` | string | sí | Nombre de quien canceló. |

<a id="reservationgroupcourtdto"></a>

**`ReservationGroupCourtDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `reservationId` | string | sí |  |
| `courtId` | string | sí |  |
| `courtName` | string | sí |  |

<a id="reservationgroupdto"></a>

**`ReservationGroupDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `courts` | [ReservationGroupCourtDto](#reservationgroupcourtdto)[] | sí |  |
| `id` | string | sí |  |
| `totalPrice` | number | sí | Suma de las canchas del grupo, con el descuento. |
| `consumptionsTotal` | number | sí | Consumos activos de todas las canchas del grupo. |
| `amountPaid` | number | sí | Pagos aprobados del grupo (se registran en la primera reserva). |
| `balance` | number | sí | totalPrice + consumptionsTotal - amountPaid. |

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
| `concept` | `ANTICIPO` \| `SALDO` \| `TOTAL` \| `VENTA` | sí |  |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `REFUNDED` | sí |  |
| `id` | string | sí |  |
| `amount` | number | sí |  |
| `method` | string | sí |  |
| `reference` | string | sí |  |
| `receivedAt` | string (date-time) | sí |  |

<a id="saledto"></a>

**`SaleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `status` | `ACTIVE` \| `VOIDED` | sí |  |
| `items` | [SaleItemDto](#saleitemdto)[] | sí |  |
| `id` | string | sí |  |
| `reservationId` | string | sí | null = venta suelta. |
| `customerName` | string | sí |  |
| `total` | number | sí |  |
| `note` | string | sí |  |
| `voidReason` | string | sí |  |
| `voidedAt` | string (date-time) | sí |  |
| `createdAt` | string (date-time) | sí |  |
| `paymentMethod` | string | sí | Código del método con que se pagó (venta suelta o consumo cobrado ya). |
| `courtName` | string | sí | Cancha e inicio de la reserva de un consumo. |
| `reservationStart` | string (date-time) | sí |  |

<a id="saleitemdto"></a>

**`SaleItemDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `productId` | string | sí |  |
| `productName` | string | sí |  |
| `unitPrice` | number | sí |  |
| `quantity` | number | sí |  |
| `subtotal` | number | sí |  |

<a id="salesdaydto"></a>

**`SalesDayDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `date` | string | sí | YYYY-MM-DD, hora del negocio. |
| `walkIn` | number | sí |  |
| `consumptions` | number | sí |  |

<a id="salesmoduledto"></a>

**`SalesModuleDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `enabled` | boolean | sí |  |
| `enabledAt` | string (date-time) | sí | Cuándo lo activó el super admin; null si nunca. |

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
| `courtIds` | string[] | sí | Canchas apartadas, todas en la misma franja. |
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

<a id="stockmovementdto"></a>

**`StockMovementDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `type` | `ENTRADA` \| `AJUSTE` \| `VENTA` \| `ANULACION` | sí |  |
| `id` | string | sí |  |
| `productId` | string | sí |  |
| `productName` | string | sí |  |
| `quantity` | number | sí | Unidades que entran (+) o salen (−). |
| `stockAfter` | number | sí |  |
| `unitCost` | number | sí |  |
| `supplierName` | string | sí |  |
| `note` | string | sí |  |
| `createdByName` | string | sí |  |
| `createdAt` | string (date-time) | sí |  |

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
| `isActive` | boolean | sí | false si está suspendido o si su prueba gratuita ya venció. |
| `autoBilling` | boolean | sí |  |
| `trialEndsAt` | string (date-time) | sí | Fin de la prueba gratuita; null si el plan es de pago. |
| `trialDaysLeft` | number | sí | Días que le quedan de prueba (0 si vence hoy); null si no está en prueba. |
| `trialExpired` | boolean | sí | La prueba ya venció: debe comprar un plan para seguir operando. |
| `nextPlanName` | string | sí | Plan al que puede mejorar: el más barato que cuesta más que el actual; null si ya tiene el plan más caro. |

<a id="supplierdto"></a>

**`SupplierDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí |  |
| `name` | string | sí |  |
| `documentId` | string | sí |  |
| `phone` | string | sí |  |
| `notes` | string | sí |  |
| `isActive` | boolean | sí |  |

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

<a id="topproductdto"></a>

**`TopProductDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `productId` | string | sí | null si el producto ya no existe. |
| `name` | string | sí |  |
| `units` | number | sí |  |
| `amount` | number | sí |  |

<a id="trenddto"></a>

**`TrendDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `value` | number | sí |  |
| `previous` | number | sí |  |
| `changePct` | number | sí |  |

<a id="unreadcountdto"></a>

**`UnreadCountDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `unread` | number | sí |  |

<a id="userpagedto"></a>

**`UserPageDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `items` | [AdminUserDto](#adminuserdto)[] | sí |  |
| `total` | number | sí |  |
| `page` | number | sí |  |
| `pageSize` | number | sí |  |

<a id="vapidkeydto"></a>

**`VapidKeyDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `publicKey` | string | sí | Clave pública VAPID para pushManager.subscribe (applicationServerKey) |

<a id="weekdaydto"></a>

**`WeekdayDto`**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `dayOfWeek` | `MONDAY` \| `TUESDAY` \| `WEDNESDAY` \| `THURSDAY` \| `FRIDAY` \| `SATURDAY` \| `SUNDAY` | sí |  |
| `reservations` | number | sí |  |
| `booked` | number | sí |  |
