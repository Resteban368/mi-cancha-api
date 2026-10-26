// Enlaces de la landing. Si un valor queda vacío, el botón se muestra deshabilitado.

/** Panel web del negocio: ahí inicia sesión el dueño después de registrarse. */
export const PANEL_URL = 'https://negocio.micanchaapp.com';

/** Ingreso de jugadores: la web de reservas, con sus reservas y su perfil. */
export const PLAYER_LOGIN_URL = 'https://www.micanchaapp.com/reservar/ingresar';

/** WhatsApp para pedir planes o soporte, con el número en formato internacional sin "+". */
export const WHATSAPP_URL = '';

/** Página de reservas de ejemplo que los jugadores ven (la web pública del negocio). */
export const EXAMPLE_BOOKING_URL = 'https://app.micanchaapp.com/reservar';

/**
 * Base de la API (registro de negocios y catálogos de departamentos y ciudades). En
 * desarrollo se puede apuntar a una API local con VITE_API_URL=http://localhost:3000/api/v1.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://app.micanchaapp.com/api/v1';

/** Política de privacidad y tratamiento de datos (página /privacidad/ de esta landing). */
export const POLICY_URL = '/privacidad/';
