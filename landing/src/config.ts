// Enlaces de la landing. Si un valor queda vacío, el botón se muestra deshabilitado.

/** Panel web del negocio: ahí inicia sesión el dueño después de registrarse. */
export const PANEL_URL = 'https://negocio.micanchaapp.com';

/** WhatsApp para pedir planes o soporte, con el número en formato internacional sin "+". */
export const WHATSAPP_URL = '';

/** Página de reservas de ejemplo que los jugadores ven (la web pública del negocio). */
export const EXAMPLE_BOOKING_URL = 'https://app.micanchaapp.com/reservar';

/**
 * Base de la API (registro de negocios y catálogos de departamentos y ciudades). En
 * desarrollo se puede apuntar a una API local con VITE_API_URL=http://localhost:3000/api/v1.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://app.micanchaapp.com/api/v1';

/** Política de tratamiento de datos (la publica la web de reservas). */
export const POLICY_URL = 'https://app.micanchaapp.com/reservar/politica-de-datos';
