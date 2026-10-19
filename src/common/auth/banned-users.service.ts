import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export const ACCOUNT_BANNED_CODE = 'ACCOUNT_BANNED';
export const ACCOUNT_BANNED_MESSAGE =
  'Tu cuenta está bloqueada. Contacta a soporte.';

/** 403 con código estable para que las apps cierren la sesión y avisen. */
export function accountBanned(): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code: ACCOUNT_BANNED_CODE,
    message: ACCOUNT_BANNED_MESSAGE,
  });
}

/** Lanza ACCOUNT_BANNED si la cuenta está bloqueada. */
export function assertNotBanned(user: { bannedAt: Date | null }): void {
  if (user.bannedAt) throw accountBanned();
}

/** Cuánto se recuerda el estado de una cuenta: es el máximo retraso entre instancias del servidor. */
const CACHE_TTL_MS = 15_000;
const CACHE_MAX_ENTRIES = 5_000;

/**
 * Dice si una cuenta está bloqueada, para cortar también las sesiones ya iniciadas.
 * Se consulta en cada petición autenticada, así que recuerda la respuesta unos
 * segundos en vez de ir a la base cada vez.
 */
@Injectable()
export class BannedUsersService {
  private readonly cache = new Map<string, { banned: boolean; until: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async isBanned(userId: string, now = Date.now()): Promise<boolean> {
    const cached = this.cache.get(userId);
    if (cached && cached.until > now) return cached.banned;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true },
    });
    const banned = Boolean(user?.bannedAt);
    if (this.cache.size >= CACHE_MAX_ENTRIES) this.cache.clear();
    this.cache.set(userId, { banned, until: now + CACHE_TTL_MS });
    return banned;
  }

  /** Olvida lo que sabe de la cuenta: se llama al bloquearla o desbloquearla. */
  forget(userId: string): void {
    this.cache.delete(userId);
  }
}
