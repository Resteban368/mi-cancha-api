import type { UserRole } from '../../generated/prisma/enums.js';

/** Contenido del JWT emitido por la API. */
export interface AuthPayload {
  sub: string;
  role: UserRole;
  /**
   * Versión de las sesiones del usuario al emitir el token (User.tokenVersion).
   * Si el usuario cierra todas sus sesiones, la versión sube y el token deja de
   * valer. Los tokens emitidos antes de existir este campo cuentan como 0.
   */
  ver?: number;
}
