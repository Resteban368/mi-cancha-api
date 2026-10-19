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
| `prisma/migrations/20261019170556_push_subscriptions` | Tabla `PushSubscription` |

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

`DELETE /api/v1/business/notifications/subscriptions` → `204`

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/…" }
```

Solo borra si pertenece a la cuenta que llama.

### Contenido del push

El servidor envía un JSON al Service Worker (no usa el formato `notification` del navegador, así el
Service Worker decide cómo mostrarlo):

```json
{
  "title": "Nueva reserva",
  "body": "Pedro Pérez · Cancha 1 · mar 22 oct, 6:30 p. m.",
  "url": "/negocio/reservas",
  "tag": "reserva-<id>",
  "data": { "type": "NEW_RESERVATION", "reservationId": "<id>" }
}
```

`url` es la ruta de la app que se abre al tocar el aviso; `tag` evita apilar el mismo aviso dos veces.

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

  /// Al cerrar sesión o al desactivar los avisos, ANTES de borrar el JWT.
  Future<void> disable() async {
    final registration = await web.window.navigator.serviceWorker
        .getRegistration('push/'.toJS)
        .toDart;
    final subscription = await registration?.pushManager.getSubscription().toDart;
    if (subscription == null) return;
    await api.delete('/business/notifications/subscriptions',
        body: {'endpoint': subscription.endpoint});
    await subscription.unsubscribe().toDart;
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
- Llamar `disable()` en el cierre de sesión.

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
