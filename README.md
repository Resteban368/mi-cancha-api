# Mi Cancha API

Backend de la app Flutter [`mi_cancha`](../mi_cancha), que sirve para reservar canchas deportivas en Colombia.
Stack: **NestJS 12** (ESM), **PostgreSQL** y **Prisma 7**, con JWT propio y validación con `class-validator`.

## Puesta en marcha

```bash
npm install                 # genera el cliente de Prisma e instala el panel (admin/)
cp .env.example .env        # y define un JWT_SECRET propio (mín. 32 caracteres)
npm run db:up               # Postgres 17 en Docker (puerto 5433)
npm run db:migrate          # aplica las migraciones
npm run db:seed             # datos de demo
npm run build:admin         # compila el panel en public/admin
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs` (deshabilitado si `NODE_ENV=production`)
- Panel de super admin: `http://localhost:3000/admin`
- Usuarios demo (seed): super admin `superadmin@micancha.co` / `SuperAdmin2026!` · negocio `admin@micancha.co` / `MiCancha2026!`

## Panel de super admin (`admin/`)

SPA en React + Vite + Tailwind servida en `/admin`: se compila en `public/admin`, que en Vercel sirve el CDN y en local sirve Nest. Solo entran cuentas `SUPER_ADMIN`.

- **Dashboard:** clientes, usuarios por rol, ingreso mensual recurrente, canchas, altas por mes.
- **Clientes:** listado con búsqueda; alta de cliente (usuario de negocio + negocio + plan); cambio de plan y suspensión.
- **Usuarios:** listado de todas las cuentas con filtro por rol.
- **Planes:** crear, editar y eliminar (solo si no tiene clientes).
- **Catálogos:** servicios y métodos de pago editables; enums del sistema en solo lectura.

Desarrollo con recarga en caliente: `npm run start:dev` y, en otra terminal, `npm run admin:dev` → `http://localhost:5173/admin/` (Vite reenvía `/api` a Nest).

## Base de datos en Neon

Proyecto Neon **`mi-cancha`** (`empty-mud-04894416`, rama `main`, `aws-us-east-1`). Las credenciales viven en `.env.neon` (ignorado por git):
`DATABASE_URL` con pooler para la API y `DATABASE_URL_UNPOOLED` directa para migraciones y seed.

```bash
# Aplicar migraciones nuevas en Neon
( set -a; . ./.env.neon; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy )

# Seed mínimo (planes, catálogos y SUPER_ADMIN; idempotente, no pisa cambios del panel)
( set -a; . ./.env.neon; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" SEED_MODE=minimal npx prisma db seed )

# Correr la API local contra Neon (modo watch, con Swagger)
npm run start:neon
```

`start:dev` usa la base local de Docker (`.env`) y `start:neon` usa Neon (`.env.neon`). Las dos usan el puerto 3000: corre una a la vez, o cambia el puerto con `PORT=3001 npm run start:neon`.

`SEED_MODE=minimal` exige `SEED_SUPER_ADMIN_PASSWORD` (mín. 12 caracteres). Sin `SEED_MODE`, el seed carga los datos demo: úsalo solo en local.

## Despliegue en Vercel

Proyecto Vercel **`mi-cancha-api`** (equipo `banestecodes-7711's projects`), conectado al repo de GitHub: cada push a `main` despliega a producción.

- Producción: https://mi-cancha-api.vercel.app — API en `/api/v1`, panel en `/admin` (Swagger desactivado en producción).
- NestJS se detecta solo (`src/main.ts` → una Vercel Function con Fluid compute, región `iad1`, junto a Neon en `us-east-1`).
- `vercel.json`: compila el panel en `public/admin` (lo sirve el CDN) y reescribe las rutas del panel a su `index.html`.
- Variables de producción (sensibles): `DATABASE_URL` (Neon con pooler), `JWT_SECRET`, `JWT_EXPIRES_IN`, `APP_UTC_OFFSET`.
- Las migraciones **no** corren en el build: aplícalas a Neon antes de desplegar cambios de schema (ver «Base de datos en Neon»).

## Diagrama de la base de datos

[`docs/database/ERD.md`](docs/database/ERD.md) (Mermaid) y [`docs/database/erd.html`](docs/database/erd.html) (para abrir en el navegador).
Los genera `prisma/erd/generator.ts`, que es un generador más del schema. Se **actualizan solos** cada vez que corre `prisma generate`, `prisma migrate dev` o `npm install`.
Para regenerarlos a mano: `npm run db:erd`. No los edites directamente.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API y de la BD |
| POST | `/auth/business/register` | Registro de administrador de negocio |
| POST | `/auth/business/login` | Login de negocio (email + contraseña) |
| POST | `/auth/google` · `/auth/apple` | Login de jugador con el token del proveedor |
| GET | `/auth/me` | Usuario autenticado |
| GET · PUT | `/business/profile` | Perfil del negocio (PUT crea o actualiza) |
| PUT · DELETE | `/business/profile/image` | Foto de portada del negocio (multipart `image`, JPG/PNG ≤ 4 MB) |
| GET · POST · PATCH · DELETE | `/business/courts` · `/:id` | Canchas con horarios y tarifas (respeta el límite del plan; DELETE desactiva) |
| PUT · DELETE | `/business/courts/:id/photos/:slot` | Fotos de la cancha por posición: `MAIN`, `SURFACE`, `LIGHTING` (obligatorias), `EXTRA_1`, `EXTRA_2` |
| GET | `/business/reservations?date=YYYY-MM-DD` | Agenda del día |
| POST · PATCH `:id/status` | `/business/reservations` | Crear reserva (valida horario, turno y cruces; calcula el precio con las tarifas) y cambiar estado |
| GET · POST | `/business/payments?status=` | Pagos; los registrados por el negocio quedan aprobados |
| PATCH | `/business/payments/:id/approve` · `/reject` | Validar pagos pendientes |
| GET | `/business/account` | Perfil del admin y suscripción |
| GET | `/catalogs` | Servicios y métodos de pago activos (para la app) |
| GET | `/admin/dashboard` | Métricas de la plataforma |
| GET · POST | `/admin/clients` | Clientes; POST crea usuario de negocio + negocio + plan |
| GET | `/admin/clients/:id` | Ficha del cliente: negocio, responsable, plan, canchas y actividad |
| GET · PATCH | `/admin/clients/:id/courts` · `/:courtId` | Canchas del cliente con horarios, tarifas y fotos; el super admin puede editarlas (mismas reglas que el negocio) |
| PATCH | `/admin/clients/:id/subscription` | Cambiar plan o activar/suspender |
| GET | `/admin/users?role=&search=` | Usuarios |
| GET · POST · PATCH · DELETE | `/admin/plans` | Planes |
| GET · POST · PATCH | `/admin/catalogs/amenities` · `/payment-methods` | Catálogos editables |
| GET | `/admin/enums` | Enums fijos (solo lectura) |
| GET | `/images/business-profile/:id` · `/images/courts/:id` | Imágenes públicas (sin token, caché inmutable) |

Las rutas `/business/*` requieren rol `ADMIN_NEGOCIO`, y las `/admin/*`, rol `SUPER_ADMIN`.

**Plan inactivo = solo lectura.** Si la suscripción del negocio está suspendida o no tiene plan, el `ADMIN_NEGOCIO` puede hacer `GET` de todo, pero cualquier `POST`, `PUT`, `PATCH` o `DELETE` responde 403 con `code: SUBSCRIPTION_INACTIVE`. Lo aplica un guard global (`ActiveSubscriptionGuard`), así que cubre también los endpoints futuros. El super admin no se ve afectado; la app puede saber el estado con `GET /business/account` (`subscription.isActive`).

## Convenciones

- **Dinero:** precios de canchas y reservas con hasta 2 decimales, en la moneda de la cancha (`currency`, ISO 4217, por defecto `COP`). Planes y pagos siguen en enteros COP.
- **Canchas:** 7 horarios (uno por día, `MONDAY`…`SUNDAY`); si `closeTime` < `openTime` cierra al día siguiente. Las tarifas (`rates`) no se pueden cruzar; donde ninguna aplica rige `basePricePerHour` y una reserva que cruza franjas se cobra por fracciones. Solo reciben reservas si `isActive` y tienen las fotos `MAIN`, `SURFACE` y `LIGHTING` (`isBookable`). Con el límite del plan alcanzado se permite una sola cancha inactiva más; el error es 403 con `code: PLAN_LIMIT_REACHED`.
- **Fechas:** ISO 8601 en UTC. La agenda por día usa la zona del negocio (`APP_UTC_OFFSET`, por defecto `-05:00`).
- **Enums fijos** (`UserRole`, `Sport`, `DayOfWeek`, `CourtPhotoSlot`, `ReservationStatus`, `PaymentStatus`, `PaymentConcept`): en MAYÚSCULAS_CON_GUION_BAJO. La app Flutter los mapea a sus enums.
- **Catálogos editables** (`Amenity` = servicios, `PaymentMethod` = métodos de pago): la API recibe y devuelve su `code` (`PARQUEADERO`, `NEQUI`…). Los nombres visibles salen de `GET /catalogs`. Si un método tiene `requiresReference`, el pago exige referencia.
- **`amountPaid`** de una reserva es la suma de sus pagos **aprobados**; el saldo lo calcula la app.
- **Planes:** al crear su negocio, el admin recibe el plan con precio 0 (si existe), para que pueda habilitar su primera cancha.

## Pruebas

```bash
npm test          # unitarias (Prisma mockeado)
npm run test:e2e  # e2e contra la BD local; requiere el seed
npm run lint
```

## Login social

Define `GOOGLE_CLIENT_IDS` y `APPLE_CLIENT_IDS` (separados por coma) con los client IDs o bundle IDs de la app.
Si no están definidos, esos endpoints responden 503.
