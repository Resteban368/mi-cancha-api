import { Throttle } from '@nestjs/throttler';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Límite general por IP para toda la API. Generoso: una app o un panel normales
 * no se acercan, pero corta a quien la recorra de forma automatizada.
 */
export const DEFAULT_RATE_LIMIT = { name: 'default', ttl: MINUTE, limit: 120 };

/**
 * Inicios de sesión: 5 intentos por minuto por IP. Frena la fuerza bruta de
 * contraseñas sin molestar a quien se equivoca un par de veces.
 */
export const LoginRateLimit = () =>
  Throttle({ default: { ttl: MINUTE, limit: 5 } });

/** Registros de cuentas: 5 por hora por IP, para frenar la creación masiva. */
export const RegisterRateLimit = () =>
  Throttle({ default: { ttl: HOUR, limit: 5 } });
