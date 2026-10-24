# Fotos del negocio (hasta 5) y de las canchas (2 al crear)

## Negocio: hasta 5 fotos

La primera foto es la **portada** que sale en el directorio de `/reservar`. Las demás se ven en la
ficha de la sede (galería con zoom). Formatos JPG o PNG, máx. 4 MB cada una.

`BusinessDto` (`GET/PUT /business/profile`) ahora trae:

```json
{ "imageUrl": "…/img-1", "photos": [{ "id": "…", "url": "…" }] }
```

`imageUrl` es siempre la portada (`photos[0]`), así las versiones viejas de la app siguen funcionando.

| Acción | Dueño del negocio (`ADMIN_NEGOCIO`) | Super admin |
|---|---|---|
| Agregar al final (multipart, campo `image`) | `POST /business/profile/photos` | `POST /admin/clients/:id/photos` |
| Quitar una | `DELETE /business/profile/photos/:photoId` | `DELETE /admin/clients/:id/photos/:photoId` |
| Ordenar / cambiar portada | `PUT /business/profile/photos/order` `{ "ids": [...] }` | `PUT /admin/clients/:id/photos/order` |
| Reemplazar la portada (heredado) | `PUT /business/profile/image` | `PUT /admin/clients/:id/image` |

- Con 5 fotos, agregar otra responde `400`.
- `order` exige **todos** los ids del negocio, sin repetir; el primero queda como portada.
- Al borrar una, las demás suben de lugar (si borras la portada, la siguiente la reemplaza).

## Cancha: solo la foto principal es obligatoria

- `REQUIRED_PHOTOS` pasó de `MAIN + SURFACE + LIGHTING` a solo `MAIN`: una cancha activa con foto
  principal ya es reservable (`isComplete = true`, `missingPhotos = []`).
- Al **crear** la cancha la app pide 2 fotos: la principal (`MAIN`, obligatoria) y una segunda
  opcional (iluminación, grama, etc. → `SURFACE`, `LIGHTING`, `EXTRA_1` o `EXTRA_2`).
- Después se pueden completar hasta 5 con `PUT /business/courts/:id/photos/:slot` (sin cambios).
- Las canchas que ya existen y tenían las 3 fotos no cambian.

## Prompt para la app Flutter

> En la pantalla Negocio, reemplaza la foto única por una galería de hasta 5 fotos. Lee `photos`
> (`id`, `url`) de `GET /business/profile`; la primera es la portada. Botón «Agregar foto»
> (deshabilitado con 5) → `POST /business/profile/photos` multipart `image`. Por foto: «Hacer
> portada» y mover (→ `PUT /business/profile/photos/order` con la lista completa de ids) y
> «Eliminar» (→ `DELETE /business/profile/photos/:id`). Cada llamada devuelve el negocio
> actualizado; refresca el estado con esa respuesta.
>
> En el formulario de crear cancha, deja solo 2 espacios de foto: «Foto principal» (obligatoria,
> slot `MAIN`) y «Segunda foto» (opcional: iluminación, grama, etc., slot `SURFACE` o `LIGHTING`).
> Quita la validación que exigía las 3 fotos y usa `isComplete` / `missingPhotos` del backend. En la
> edición de la cancha se pueden seguir agregando hasta 5 fotos.

## Link de reservas del negocio

El link `https://<api>/reservar/<slug>` existe desde que se crea el negocio (el `slug` lo genera la base
a partir del nombre). Está **activo** cuando se cumplen las tres cosas: reservas encendidas
(`enabled`), plan activo y **al menos una cancha activa con foto principal**.

`GET /business/profile` (y `PUT`) trae ahora:

```json
"bookingLink": {
  "enabled": true,
  "slug": "el-golazo",
  "url": "https://…/reservar/el-golazo",
  "bookingAvailable": false,
  "unavailableReason": "NO_COURTS"
}
```

`unavailableReason`: `NO_COURTS` (falta una cancha completa), `DISABLED` (el dueño apagó las
reservas), `PLAN_INACTIVE`, o `null` si ya está activo. Mientras no esté activo, la web pública y el
directorio no aceptan reservas en ese link. El dueño sigue usando `GET/PATCH /business/online-booking`
para encender/apagar y cambiar el slug. El super admin ve lo mismo en la ficha del cliente
(`ClientDetail.bookingLink`).

### Prompt para la app Flutter

> En la pantalla Negocio muestra una tarjeta «Link de reservas» con `bookingLink` de
> `GET /business/profile`. Siempre muestra el link (`url`) con botones Copiar y Compartir. Si
> `bookingAvailable` es true: chip verde «Activo». Si es false: chip gris «Pendiente» y el motivo:
> `NO_COURTS` → «Crea al menos una cancha activa con foto principal para activarlo» (botón a Crear
> cancha), `DISABLED` → «Reservas apagadas» (interruptor que llama `PATCH /business/online-booking`
> con `{enabled:true}`), `PLAN_INACTIVE` → «Tu plan está inactivo». Refresca el estado al crear o
> editar una cancha.

## Cuenta de jugador creada por el negocio

Al registrar un cliente **nuevo** (en una reserva con `customer`, o con `POST /customers`) se crea
también su cuenta de jugador, para que pueda entrar a `/reservar`:

- **Usuario:** su celular o su cédula. **Clave inicial:** su cédula (con o sin puntos).
- La cuenta nace con `mustChangePassword = true` y sin consentimiento de datos. La web lo lleva a
  `/reservar/bienvenida` para elegir una clave propia y aceptar la política antes de usar nada.
- Si el celular o la cédula **ya tienen cuenta**, solo se vincula el cliente a esa cuenta (su clave no
  cambia). Si el celular y la cédula son de cuentas distintas, la petición responde `409`.
- Solo aplica a clientes nuevos con cédula; los clientes que ya existían no reciben cuenta.
- Quien olvide la clave usa «Olvidé mi contraseña» (código por SMS al celular).

`PlayerDto` (login y `GET /player/me`) trae `mustChangePassword` y `needsDataConsent`. Endpoints:
`PUT /player/password` `{currentPassword, newPassword}` (400 si la actual no coincide o la nueva es la
cédula) y `POST /player/consent`.
