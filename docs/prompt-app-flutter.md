# Prompt único para la app Flutter (negocio)

Pégalo en la sesión de `../mi_cancha`. Reúne todos los cambios de la API que la app aún no usa.

```
Contexto: la API (mi_cancha_api) cambió varias cosas que la app del negocio debe usar. Mantén la
arquitectura actual (BLoC + get_it + go_router) y el estilo del código existente. Responde y
comenta en español. Trabaja por partes (una por feature), con tests y `flutter analyze` limpio en
cada una, y deja commits locales separados. No publiques ni hagas push.

Todas las rutas son /api/v1/... con el token del dueño (ADMIN_NEGOCIO), salvo que diga otra cosa.

==================================================================
0) DIRECCIÓN BASE (dominio nuevo)
==================================================================
La API ahora vive en https://app.micanchaapp.com. Cambia la dirección base a
https://app.micanchaapp.com/api/v1 (en el entorno de producción; deja configurable la de desarrollo).
El dominio anterior (mi-cancha-api.vercel.app) sigue funcionando, así que no hay urgencia de
compatibilidad, pero las URLs de fotos y links que devuelve la API ya vienen con el dominio nuevo.

==================================================================
1) CIUDAD Y DEPARTAMENTO DEL NEGOCIO (Colombia)
==================================================================
Catálogo nuevo (datos fijos del DANE; cachéalos en memoria durante la sesión):
- GET /catalogs/departments -> [{ "id", "code", "name" }]   (33, incluye "Bogotá, D.C.")
- GET /catalogs/departments/:id/cities -> [{ "id", "code", "name" }]   (ordenadas; hasta ~125)

GET y PUT /business/profile ahora devuelven:
  "city": { "id", "name", "department": { "id", "name" } }   o null en negocios anteriores.
PUT /business/profile acepta "cityId" (id de la CIUDAD, no del departamento):
- Al CREAR el negocio es obligatorio: sin él responde 400 "Elige el departamento y la ciudad del negocio".
- Al ACTUALIZAR es opcional: si no lo envías se conserva la actual.

Cambios en la app:
- Modelo del negocio: agrega `City? city` (id, name, departmentId, departmentName); parseo tolerante a null.
- Crear negocio: dos selectores dependientes antes de Dirección y Barrio: «Departamento» y «Ciudad»
  (deshabilitada hasta elegir departamento; se limpia si cambia el departamento). Ambos obligatorios.
  Usa selector con búsqueda (bottom sheet con filtro), no dropdown plano. Estados de carga y de error
  con «Reintentar». Envía `cityId`.
- Editar negocio: precarga departamento y ciudad. Si `city` viene null, muestra «Completa tu ciudad».
- Ficha del negocio: muestra «Ciudad, Departamento» o «Sin ciudad» con acceso a editarla.

==================================================================
2) FOTOS DEL NEGOCIO: HASTA 5 (la primera es la portada)
==================================================================
Antes el negocio tenía una sola foto (imageUrl). Ahora GET/PUT /business/profile devuelven además:
  "photos": [{ "id", "url" }]
La primera es la PORTADA (la del directorio web). imageUrl sigue existiendo y es igual a photos[0].url.

Endpoints (todos devuelven el negocio completo actualizado; refresca el estado con esa respuesta):
- Agregar:  POST   /business/profile/photos        multipart, campo "image" (JPG o PNG, máx. 4 MB)
- Quitar:   DELETE /business/profile/photos/:photoId
- Ordenar:  PUT    /business/profile/photos/order   body {"ids": ["id1","id2",...]}
  -> debe traer TODOS los ids del negocio, sin repetir, en el orden deseado; el primero es la portada.
- La sexta foto responde 400. Los PUT/DELETE /business/profile/image siguen vivos pero ya no los uses.

UI: galería de hasta 5 fotos en la pantalla Negocio: foto grande con «Portada» en la primera,
miniaturas, «Agregar foto» (deshabilitado con 5), y por foto «Hacer portada», mover izquierda/derecha
y «Eliminar» (con confirmación). Muestra «N de 5 fotos · la primera es la portada». Valida JPG/PNG
y 4 MB antes de subir. Shimmer mientras carga cada imagen y manejo de error de carga.

==================================================================
3) CANCHAS: AL CREAR, SOLO 2 FOTOS
==================================================================
Antes se exigían 3 fotos (MAIN, SURFACE, LIGHTING). Ahora SOLO `MAIN` es obligatoria: una cancha
activa con foto principal ya es reservable (isComplete = true, missingPhotos = []).
- Formulario de CREAR cancha: solo 2 espacios de foto: «Foto principal» (MAIN, obligatoria) y
  «Segunda foto» (opcional: iluminación, grama, etc.; slot SURFACE o LIGHTING, por defecto SURFACE).
  Quita la validación local que exigía las 3.
- Subida: PUT /business/courts/:id/photos/:slot (multipart "image"), igual que hoy.
- Decide «cancha incompleta» con `isComplete` / `missingPhotos` del backend, no con una lista fija.
- EDITAR cancha: sigue permitiendo hasta 5 fotos (MAIN, SURFACE, LIGHTING, EXTRA_1, EXTRA_2).

==================================================================
4) LINK DE RESERVAS DEL NEGOCIO
==================================================================
El link existe desde que se crea el negocio. GET/PUT /business/profile traen ahora:
  "bookingLink": { "enabled", "slug", "url", "bookingAvailable", "unavailableReason" }
unavailableReason: NO_COURTS | DISABLED | PLAN_INACTIVE | null. Está activo (bookingAvailable=true)
cuando hay reservas encendidas, plan activo y al menos una cancha activa con foto principal.

Tarjeta «Link de reservas» en la pantalla Negocio: siempre muestra `url` con Copiar y Compartir.
- bookingAvailable true: chip verde «Activo».
- false: chip gris «Pendiente» + motivo:
  NO_COURTS -> «Crea al menos una cancha activa con foto principal para activarlo» (botón a Crear cancha);
  DISABLED -> «Reservas apagadas» con interruptor que llama PATCH /business/online-booking {"enabled":true};
  PLAN_INACTIVE -> «Tu plan está inactivo».
Refresca el estado al crear o editar una cancha. El dueño también puede cambiar el slug con
PATCH /business/online-booking {"slug":"..."} (409 si ya lo usa otro negocio).

==================================================================
5) CAMBIAR CONTRASEÑA DEL DUEÑO
==================================================================
PUT /auth/password body {"currentPassword","newPassword"} -> 204 sin cuerpo.
Errores 400 con "message" (actual incorrecta, nueva igual a la actual, formato): muéstralos en el
formulario; NO los trates como sesión vencida (por eso no es 401).
UI: en Perfil/Cuenta, pantalla o diálogo con 3 campos (actual, nueva mín. 8 y máx. 72, repetir nueva,
validando que coincidan antes de enviar) con mostrar/ocultar, botón deshabilitado mientras envía,
snackbar «Contraseña actualizada» al éxito.

==================================================================
6) MARCA Y MODO CLARO / OSCURO
==================================================================
Colores: verde esmeralda #00C853, negro azulado #0B1F28, blanco #F8FAFC. Soporta modo claro y
oscuro que siga al sistema, con opción manual en Perfil (Claro / Sistema / Oscuro, guardada en
SharedPreferences, manejada por un cubit y `themeMode`).
- CLARO: scaffold #F8FAFC, surface #FFFFFF, surfaceVariant #EDF2F1, outline #D9E3E1, onSurface #0B1F28,
  onSurfaceVariant #3C5360, primary #00C853 con onPrimary #0B1F28; texto verde (links, chips) #007A33;
  error #C62828.
- OSCURO: scaffold #0B1F28, surface #102B37, surfaceVariant #163845, outline #1F4352, onSurface #F8FAFC,
  onSurfaceVariant #BFD0D8, primary #00C853 con onPrimary #0B1F28; error #FF8A80.
Define ThemeData claro y oscuro con ColorScheme explícito (no fromSeed) y reemplaza colores sueltos
por los del tema. Tipografía: Montserrat (google_fonts) en títulos y en el nombre de la marca.
Icono de la app: usa https://app.micanchaapp.com/reservar/brand/icon.png (1024x1024) con
flutter_launcher_icons; en splash y login usa logo-light.png / logo-dark.png (misma carpeta brand/)
según el tema. Revisa contraste en ambos modos.

==================================================================
7) (INFORMATIVO) CLIENTES NUEVOS Y SU CUENTA DE JUGADOR
==================================================================
Sin cambios de contrato: al crear una reserva con un cliente nuevo (`customer`) o crear un cliente
(POST /customers), la API crea además su cuenta de jugador con la cédula como clave inicial (debe
cambiarla al primer ingreso en la web). Puede responder 409 si el celular y la cédula ya pertenecen
a cuentas de jugador distintas: muestra el mensaje al usuario tal cual.

==================================================================
Pruebas y entrega
==================================================================
- Tests unitarios del parseo de modelos (con y sin los campos nuevos: city, photos, bookingLink) y de
  los blocs/cubits nuevos (galería de fotos, selectores de ciudad, contraseña, tema).
- `flutter analyze` y tests sin warnings nuevos. Commits locales por feature; sin push.
```

## Notas

- La ubicación «¿Desde dónde buscas?» es del jugador en la web de reservas; la app del negocio no la usa.
- El detalle de cada contrato está en `docs/fotos-negocio-y-canchas.md` y `docs/marca-y-temas.md`.
