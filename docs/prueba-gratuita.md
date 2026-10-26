# Prueba gratuita de 15 días

Un negocio que se registra por su cuenta recibe el plan **Prueba** (precio 0, hasta 2 canchas activas) durante 15 días. Pasado ese plazo queda como un negocio sin plan activo: puede consultar su información, pero no crear ni modificar nada hasta que Mi Cancha le asigne un plan de pago desde el panel admin.

## Registro (formulario de la página web)

`POST /api/v1/auth/business/signup` (público). Crea el usuario, el negocio y la suscripción de prueba en una sola transacción y devuelve la sesión (igual que el login: `accessToken` y `user`).

```json
{
  "fullName": "Andrés Gómez",
  "email": "admin@golazo.co",
  "password": "mínimo 8 caracteres",
  "phone": "+57 300 123 4567",
  "businessName": "Cancha El Golazo",
  "address": "Calle 10 # 5-20",
  "neighborhood": "Centro",
  "cityId": "uuid de GET /catalogs/departments/:id/cities"
}
```

Errores: `409` si el correo ya está registrado, `400` si la ciudad no existe o faltan datos.

## Qué ve cada parte

- **Panel admin**: en Clientes y en la ficha aparece «En prueba · quedan N días» (o «Prueba vencida»). Al elegir un plan de pago en el selector de plan, la prueba termina y el próximo cobro cuenta 30 días desde ese momento. Elegir «Prueba» de nuevo reinicia los 15 días.
- **App del negocio** (`GET /account`): `subscription` trae `trialEndsAt`, `trialDaysLeft` (0 si vence hoy; `null` si no está en prueba) y `trialExpired`. `isActive` es `false` cuando la prueba venció.
- **Link de reservas** (`bookingLink.unavailableReason`): nuevo valor `TRIAL_EXPIRED`. Con la prueba vencida el link y el directorio dejan de aceptar reservas.

## Bloqueo al vencer

Con la prueba vencida toda escritura del dueño responde `403` con `code: "TRIAL_EXPIRED"` (las lecturas siguen funcionando). Habilitar una cancha responde igual. La app debe mostrar «Tu prueba terminó: compra un plan» con el contacto de Mi Cancha. No hay tarea programada: el vencimiento se evalúa en cada petición.
