import type { UserRole } from '../../generated/prisma/enums.js';

/** Contenido del JWT emitido por la API. */
export interface AuthPayload {
  sub: string;
  role: UserRole;
}
