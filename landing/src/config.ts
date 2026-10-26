// Enlaces de la landing. Si un valor queda vacío, el botón se muestra deshabilitado.

/** Panel web del negocio: ahí inicia sesión el dueño después de registrarse. */
export const PANEL_URL = 'https://negocio.micanchaapp.com';

/** Ingreso de jugadores: la web de reservas, con sus reservas y su perfil. */
export const PLAYER_LOGIN_URL = 'https://www.micanchaapp.com/reservar/ingresar';

/** WhatsApp de Mi Cancha para planes, registro y soporte, en formato internacional sin "+". */
export const WHATSAPP_NUMERO = '573203515491';

/** El mismo número, para mostrarlo en pantalla. */
export const WHATSAPP_TELEFONO = '+57 320 351 5491';

/** Enlace a WhatsApp con un mensaje ya escrito, para saber desde dónde nos escriben. */
export const whatsapp = (mensaje: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;

/** Enlace general de contacto por WhatsApp. */
export const WHATSAPP_URL = whatsapp('Hola, quiero información sobre Mi Cancha.');

/** Página de reservas de ejemplo que los jugadores ven (la web pública del negocio). */
export const EXAMPLE_BOOKING_URL = 'https://app.micanchaapp.com/reservar';

/**
 * Base de la API (registro de negocios y catálogos de departamentos y ciudades). En
 * desarrollo se puede apuntar a una API local con VITE_API_URL=http://localhost:3000/api/v1.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://app.micanchaapp.com/api/v1';

/** Política de privacidad y tratamiento de datos (página /privacidad/ de esta landing). */
export const POLICY_URL = '/privacidad/';
