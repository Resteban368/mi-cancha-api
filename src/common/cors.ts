import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

/** Cualquier puerto de localhost: Vite, `flutter run -d chrome`, etc. */
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ORIGIN = /^https?:\/\/[^/\s]+$/;

/**
 * Qué sitios web pueden llamar a la API desde el navegador.
 *
 * El panel de admin y la web de reservas se sirven desde el mismo dominio que la
 * API, y la app de Flutter en el celular no pasa por CORS, así que ninguno necesita
 * estar en la lista. Solo hace falta para otro dominio que use la API desde el
 * navegador (p. ej. la app de Flutter compilada para web): agrégalo a CORS_ORIGINS.
 *
 * En desarrollo se permite además cualquier puerto de localhost.
 */
export function corsOptions(
  corsOrigins: string | undefined,
  nodeEnv: string,
): CorsOptions {
  const allowed = (corsOrigins ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const invalid = allowed.filter((o) => !ORIGIN.test(o));
  if (invalid.length) {
    throw new Error(
      `CORS_ORIGINS tiene orígenes inválidos: ${invalid.join(', ')} (usa p. ej. https://micancha.co, sin rutas)`,
    );
  }

  const allowLocalhost = nodeEnv !== 'production';
  return {
    origin: (origin, callback) => {
      // Sin cabecera Origin: no viene de un navegador (app móvil, curl) o es del
      // mismo dominio. CORS no aplica.
      if (!origin) return callback(null, true);
      callback(
        null,
        allowed.includes(origin) || (allowLocalhost && LOCALHOST.test(origin)),
      );
    },
  };
}
