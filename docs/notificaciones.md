# Notificaciones web: aviso de nueva reserva al negocio

Cuando un jugador reserva desde la web (`/reservar/<sede>`), el dueño de la sede recibe una
notificación del navegador, incluso con la pestaña cerrada o en segundo plano:
**"Nueva reserva — Pedro Pérez · Cancha 1 · mar 22 oct, 6:30 p. m."**

Usa **Web Push estándar (VAPID)**: no necesita Firebase ni cuentas de terceros, solo un par de
claves propias. Funciona en Chrome, Edge, Firefox y Safari 16.4+ (en iPhone/iPad, solo si la web
está instalada en la pantalla de inicio).

## Cómo funciona

```
Jugador reserva (web)
        │
        ▼
ReservationsService.createWebReservation   ← guarda la reserva
        │  (ya guardada)
        ▼
NotificationsService.notifyNewReservation
        │  busca los navegadores suscritos del dueño (tabla PushSubscription)
        ▼
WebPushService (librería web-push, firmado con las claves VAPID)
        │
        ▼
Servicio push del navegador ──► Service Worker de la app ──► notificación en pantalla
        │
        └─ si responde 404/410 (suscripción vencida) se borra de la base
```

Reglas de diseño:

- **Solo avisa reservas con origen `WEB`** (hechas por jugadores). Las que crea el propio negocio
  o el super admin no generan aviso.
- **Nunca rompe la reserva.** El envío va después de guardar, con tope de 3 s y errores
  capturados: si falla, solo queda en el log.
- **Varios navegadores**: si el dueño activó los avisos en el PC y en otro equipo, todos reciben.
- **Reserva de varias canchas**: llega un solo aviso ("3 canchas").
- **Una suscripción = una cuenta.** Si en el mismo navegador entra otra cuenta y activa los avisos,
  la suscripción pasa a esa cuenta (`endpoint` es único).
- Sin claves VAPID: en desarrollo solo escribe en el log; en producción deja un error en el log y
  no envía (la API sigue funcionando).

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/notifications/push.service.ts` | `PushService` (abstracto) y sus implementaciones: `WebPushService`, `DevPushService`, `UnconfiguredPushService` |
| `src/notifications/notifications.service.ts` | Guardar/quitar suscripciones y armar y enviar el aviso |
| `src/notifications/notifications.controller.ts` | Endpoints de clave pública y suscripción |
| `src/notifications/notifications.module.ts` | Elige la implementación según `VAPID_*` |
| `src/reservations/reservations.service.ts` | Llama a `notifyNewReservation` tras crear la reserva web |
| `src/notifications/admin-notifications.controller.ts` | Super admin: destinatarios, envío e historial de avisos |
| `src/notifications/public-notifications.controller.ts` | Corte de avisos al cerrar sesión, sin token |
| `prisma/migrations/20261019170556_push_subscriptions` | Tabla `PushSubscription` |
| `prisma/migrations/20261019181901_notifications` | Tablas `Notification` y `NotificationBroadcast` |
| `src/notifications/notification-images.service.ts` / `.controller.ts` | Subida, borrado y servicio público de las imágenes de avisos |
| `prisma/migrations/*_notification_images` | Tabla `NotificationImage` y `imageId` en las otras dos |

Cambiar de proveedor solo requiere otra clase que extienda `PushService`.

## API

Los tres endpoints exigen el JWT de un usuario `ADMIN_NEGOCIO`.

### Obtener la clave pública

`GET /api/v1/business/notifications/vapid-key` → `200 { "publicKey": "B..." }`

Responde `404` si el servidor no tiene claves VAPID (la app debe ocultar la opción de avisos).

### Suscribir este navegador

`POST /api/v1/business/notifications/subscriptions` → `204`

Cuerpo: lo que devuelve `subscription.toJSON()` del navegador.

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/…",
  "keys": { "p256dh": "…", "auth": "…" }
}
```

Es idempotente: repetirlo con el mismo `endpoint` solo actualiza `lastSeenAt`.

### Quitar la suscripción

`DELETE /api/v1/business/notifications/subscriptions` → `204` (con sesión)

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/…" }
```

Solo borra si pertenece a la cuenta que llama.

### Dejar de recibir avisos al cerrar sesión

Al cerrar sesión **ese navegador no debe recibir más avisos**. Hay tres capas, y la app debe usar las tres:

1. `DELETE /api/v1/public/notifications/subscriptions` → `204`, **sin token**, mismo cuerpo
   `{ "endpoint": "…" }`. Es la recomendada para el cierre de sesión: funciona aunque la sesión ya haya
   vencido (el `DELETE` autenticado respondería 401). El `endpoint` es una URL secreta de ese navegador, así
   que conocerla basta para darlo de baja.
2. `subscription.unsubscribe()` en el navegador. Es el corte definitivo: aunque la llamada al servidor falle
   por red, el servicio push responde 410 en el siguiente envío y el servidor borra la suscripción solo.
3. Si otra cuenta inicia sesión en el mismo navegador y activa los avisos, la suscripción pasa a esa cuenta
   (`endpoint` es único): la cuenta anterior deja de recibirlos.

Orden en la app: llamar al endpoint público → `unsubscribe()` → borrar el token de sesión. Un error en los
dos primeros pasos no debe impedir cerrar la sesión.

Además, las cuentas **bloqueadas** no reciben avisos.

## Bandeja de notificaciones

Cada aviso se guarda en la tabla `Notification` del destinatario **aunque no tenga el push activado**, así
la app puede mostrar el listado de todo lo que le llegó (reservas nuevas y avisos del admin).

| Endpoint (rol `ADMIN_NEGOCIO`) | Qué hace |
|---|---|
| `GET /api/v1/business/notifications?page=&pageSize=&unread=true` | Listado, la más reciente primero. Responde `{ items, total, unread, page, pageSize }` |
| `GET /api/v1/business/notifications/unread-count` | `{ "unread": 3 }`, para la insignia de la campana |
| `POST /api/v1/business/notifications/:id/read` | Marca una como leída (`204`, idempotente) |
| `POST /api/v1/business/notifications/read-all` | Marca todas como leídas (`204`) |

Cada elemento de `items`:

```json
{
  "id": "…", "type": "NEW_RESERVATION", "title": "Nueva reserva",
  "body": "Pedro Pérez · Cancha 1 · mar 22 oct, 6:30 p. m.",
  "url": "/negocio/reservas", "imageUrl": null, "data": { "reservationId": "…" },
  "readAt": null, "createdAt": "2026-10-19T18:22:02.432Z"
}
```

`type`: `NEW_RESERVATION` o `ADMIN_BROADCAST`. `imageUrl` es la URL pública de la imagen del aviso (o `null`); la app puede mostrarla en la bandeja. Solo ve las suyas. El push de una reserva trae
`data.notificationId` para marcarla como leída al tocarla.

### Tablas

- `Notification`: `userId`, `type`, `title`, `body`, `url`, `data` (JSON), `broadcastId`, `readAt`,
  `createdAt`. Índices por `(userId, createdAt)` y `(userId, readAt)`.
- `NotificationImage`: la imagen de un aviso (solo la ruta en el almacenamiento y su tipo; el archivo vive en Koofr).
  `Notification` y `NotificationBroadcast` la referencian con `imageId`.
- `NotificationBroadcast`: un registro por aviso del super admin (quién lo envió, `scope`, `targeted`,
  `reachable`, `delivered`). Es el historial del panel; cada `Notification` de ese aviso apunta a él.

> No hay purga automática: la tabla crece con cada reserva y aviso. Conviene borrar las leídas con más de
> ~90 días cuando el volumen lo justifique.

### Contenido del push

El servidor envía un JSON al Service Worker (no usa el formato `notification` del navegador, así el
Service Worker decide cómo mostrarlo):

```json
{
  "title": "Nueva reserva",
  "body": "Pedro Pérez · Cancha 1 · mar 22 oct, 6:30 p. m.",
  "image": "https://…/api/v1/images/notifications/<id>",
  "url": "/negocio/reservas",
  "tag": "reserva-<id>",
  "data": { "type": "NEW_RESERVATION", "reservationId": "<id>" }
}
```

`image` solo viene en los avisos del admin que llevan imagen (las reservas nuevas no). `url` es la ruta de la app que se abre al tocar el aviso; `tag` evita apilar el mismo aviso dos veces.

## Avisos del super admin a los negocios

En el panel (`/admin` → **Avisos**) el super admin escribe un título y un mensaje y lo envía a **todos
los negocios** o solo a los que marque. La pantalla muestra cuántos navegadores tiene activados cada
negocio y cuántos recibirán el aviso (los que no activaron los avisos, o con la cuenta bloqueada, no
reciben nada).

| Endpoint (rol `SUPER_ADMIN`) | Qué hace |
|---|---|
| `GET /api/v1/admin/notifications/recipients` | Negocios con `devices` (navegadores suscritos) y `banned` |
| `POST /api/v1/admin/notifications/broadcast` | Envía el aviso; responde `{ businesses, reachable, delivered }` |
| `POST /api/v1/admin/notifications/images` | Sube la imagen de un aviso (multipart, campo `image`, JPG o PNG hasta 4 MB); responde `{ id, url }` |
| `DELETE /api/v1/admin/notifications/images/:id` | Borra una imagen que todavía no se usó en ningún aviso (`204`; `409` si ya se envió) |
| `GET /api/v1/admin/notifications/broadcasts?page=&pageSize=` | Historial de avisos enviados, con cuántos dueños ya los leyeron (`read`) |

Cuerpo de `broadcast`:

```json
{ "title": "Mantenimiento", "body": "Esta noche a las 11 p. m.…", "url": "/", "imageId": "<uuid de la imagen subida>", "all": false, "businessIds": ["<uuid>"] }
```

- `title` hasta 60 caracteres, `body` hasta 240. `url` es opcional, una ruta de la app (por defecto `/`;
  no se aceptan enlaces a otros sitios).
- `all: true` envía a todos; con `all: false` hay que mandar al menos un `businessIds` y todos deben existir.
- **Imagen (opcional):** primero se sube con `POST /admin/notifications/images` (se guarda en el servicio de
  imágenes, Koofr, en `<STORAGE_ROOT>/notifications/<id>.<ext>`) y luego se manda su `id` en `imageId`. La URL
  pública es `…/api/v1/images/notifications/<id>` (sin sesión, con caché de un año: el navegador la descarga al
  mostrar la notificación). Si el admin la quita antes de enviar, el panel la borra con `DELETE`. Una imagen ya
  enviada no se puede borrar.
- El push lleva `data.type = "ADMIN_BROADCAST"` (el de reservas es `NEW_RESERVATION`); el Service Worker de la
  app no necesita cambios.
- Si el servidor no tiene claves VAPID responde `503`.
- El aviso se guarda en la bandeja de **cada dueño** (con cuenta activa), tenga o no el push activado, y en el
  historial de la pantalla Avisos.
- Cada envío queda en la **Auditoría** como "Aviso enviado a negocios", con el alcance y cuántos lo recibieron.

## Puesta en marcha

### 1. Generar las claves VAPID (una sola vez)

```bash
npx web-push generate-vapid-keys
```

Entrega `Public Key` y `Private Key`. **La privada es un secreto**: no va al repositorio. Si se
cambian las claves, todas las suscripciones existentes dejan de funcionar y cada usuario debe
volver a activar los avisos.

### 2. Variables de entorno

```
VAPID_PUBLIC_KEY=<clave pública>
VAPID_PRIVATE_KEY=<clave privada>
VAPID_SUBJECT=mailto:soporte@tudominio.com
```

- Local: en tu `.env`.
- Producción: Vercel → `mi-cancha-api` → Settings → Environment Variables (*Production*), o
  `vercel env add VAPID_PRIVATE_KEY production`. **Redesplegar** después para que las tome.

### 3. Migración de base de datos

No corre sola al desplegar. Aplícala **antes** de publicar el código:

```bash
npx prisma migrate dev      # local
npx prisma migrate deploy   # Neon (con la URL de .env.neon)
```

Si el código se despliega primero, activar los avisos da error 500 (no existe la tabla), pero las
reservas siguen funcionando.

### 4. Cliente: la app web del negocio (Flutter web, `../mi_cancha`)

Los navegadores solo permiten notificaciones desde **HTTPS** (o `localhost`).

**4.1 Service Worker** — crear `web/push/sw.js`. Va en su propia carpeta para no chocar con el
`flutter_service_worker.js` de Flutter (solo puede haber un Service Worker por alcance; los avisos
llegan igual aunque la página no esté dentro de su alcance).

```js
self.addEventListener('push', (event) => {
  const msg = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Mi Cancha', {
      body: msg.body,
      image: msg.image, // opcional; se ignora donde el sistema no la soporta
      tag: msg.tag,
      icon: '/icons/Icon-192.png',
      data: { url: msg.url || '/', ...msg.data },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((open) => {
      const tab = open.find((c) => c.url.startsWith(self.location.origin));
      if (tab) return tab.focus().then((c) => c.navigate(target));
      return clients.openWindow(target);
    }),
  );
});
```

**4.2 Suscribirse desde Dart** — `package:web` (ya viene con Flutter) para hablar con el navegador:

```dart
import 'dart:convert';
import 'dart:js_interop';
import 'package:web/web.dart' as web;

class WebPush {
  final ApiClient api; // el cliente HTTP que ya envía el JWT
  WebPush(this.api);

  bool get supported =>
      web.window.navigator.has('serviceWorker') && web.window.has('PushManager');

  /// Llamar desde un botón "Activar avisos" (el navegador exige un gesto del usuario).
  Future<bool> enable() async {
    if (!supported) return false;
    final permission = (await web.Notification.requestPermission().toDart).toDart;
    if (permission != 'granted') return false;

    final key = (await api.get('/business/notifications/vapid-key'))['publicKey'] as String;
    final registration = await web.window.navigator.serviceWorker
        .register('push/sw.js'.toJS, web.RegistrationOptions(scope: 'push/'))
        .toDart;
    await web.window.navigator.serviceWorker.ready.toDart;

    final subscription = await registration.pushManager
        .subscribe(web.PushSubscriptionOptionsInit(
          userVisibleOnly: true,
          applicationServerKey: _decode(key).toJS,
        ))
        .toDart;

    await api.post('/business/notifications/subscriptions',
        body: jsonDecode((web.JSON.stringify(subscription.toJSON()) as JSString).toDart));
    return true;
  }

  /// Al cerrar sesión (o al desactivar los avisos). Nunca debe impedir el cierre de sesión.
  Future<void> disable() async {
    try {
      final registration = await web.window.navigator.serviceWorker
          .getRegistration('push/'.toJS)
          .toDart;
      final subscription = await registration?.pushManager.getSubscription().toDart;
      if (subscription == null) return;
      // 1) Endpoint público: funciona aunque el token ya haya vencido.
      await api.delete('/public/notifications/subscriptions',
          body: {'endpoint': subscription.endpoint}, skipAuth: true);
      // 2) Corte definitivo en el navegador.
      await subscription.unsubscribe().toDart;
    } catch (_) {
      // Sin red u otro error: el siguiente envío recibe 410 y el servidor la borra sola.
    }
  }

  // La clave VAPID viene en base64url; el navegador la quiere en bytes.
  Uint8List _decode(String key) => base64Url.decode(base64Url.normalize(key));
}
```

> Las firmas de `package:web` cambian entre versiones; si el compilador se queja, ajusta los
> nombres al `package:web` que tengas instalado. Lo importante es la secuencia: permiso →
> registrar el Service Worker → `pushManager.subscribe` con la clave pública → enviar el
> `toJSON()` al servidor.

**4.3 UI** — un botón o interruptor "Avisarme de nuevas reservas" en la pantalla del negocio:

- Mostrarlo solo si `supported` y el endpoint `vapid-key` no devolvió `404`.
- Si `Notification.permission == 'denied'`, explicar que el usuario debe permitirlas desde el
  candado de la barra de direcciones.
- Llamar `disable()` en el cierre de sesión **y** cuando la sesión venza (401), antes de borrar el token.
- Una campana con insignia (`GET /business/notifications/unread-count`) que abra la bandeja
  (`GET /business/notifications`), con "marcar todas como leídas" y, al tocar una, `POST …/:id/read` y
  navegar a su `url`.

**4.4 Reserva en tiempo real** — con la pestaña abierta el Service Worker igual muestra el aviso.
Si además quieres refrescar la lista al instante, el Service Worker puede avisar a la página con
`client.postMessage(...)` dentro del evento `push` y la app escuchar `serviceWorker.onmessage`.

### 5. Probar

1. Entra al panel del negocio por HTTPS (o `localhost`), pulsa "Activar avisos" y acepta el permiso.
   Verifica en la base:
   ```sql
   SELECT "userId", left(endpoint, 40), "lastSeenAt" FROM "PushSubscription";
   ```
2. En otra ventana (o privada) entra a `/reservar/<tu-sede>`, inicia sesión como jugador y reserva.
3. Debe aparecer "Nueva reserva", con la pestaña del negocio abierta, en segundo plano y cerrada
   (el navegador debe seguir abierto; en Chrome de escritorio basta con que el proceso exista).

Sin claves VAPID en local, el log muestra
`Push de prueba a 1 navegador(es): "Nueva reserva" — faltan las claves VAPID, no se envió`.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `GET …/vapid-key` da 404 | Faltan `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` en ese entorno o no se redesplegó |
| `POST …/subscriptions` da 500 | No se aplicó la migración `push_subscriptions` en esa base |
| El navegador rechaza `subscribe` | La página no es HTTPS, el permiso está bloqueado o la clave pública no es base64url válida |
| No llega nada y no hay error | El navegador está cerrado del todo, o el sistema operativo tiene silenciadas las notificaciones del navegador |
| En iPhone no se puede activar | Safari exige instalar la web en la pantalla de inicio (iOS 16.4+) |
| Dejaron de llegar tras cambiar las claves | Las suscripciones quedaron atadas a las claves anteriores: volver a activar los avisos |
| Llegan avisos de reservas del negocio | No debería: solo se avisa el origen `WEB` |

## Pendiente / ideas

- Avisar también cuando un jugador **cancela** su reserva (mismo mecanismo, otro `type`).
- Limpiar `PushSubscription` con `lastSeenAt` de más de ~60 días.
- Avisos al jugador (confirmación, recordatorio): hoy los endpoints son solo para `ADMIN_NEGOCIO`.
- Si más adelante se quiere push en el celular nativo, la tabla y el servicio se pueden extender
  con tokens FCM sin cambiar el punto de enganche en las reservas.
