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
