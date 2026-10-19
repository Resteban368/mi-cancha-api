import {
  createPrismaMock,
  PrismaMock,
} from '../../../test/support/prisma-mock.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  ACCOUNT_BANNED_CODE,
  assertNotBanned,
  BannedUsersService,
} from './banned-users.service.js';

describe('BannedUsersService', () => {
  let prisma: PrismaMock;
  let service: BannedUsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BannedUsersService(prisma as unknown as PrismaService);
  });

  it('dice si la cuenta está bloqueada y recuerda la respuesta unos segundos', async () => {
    prisma.user.findUnique.mockResolvedValue({ bannedAt: new Date() });

    expect(await service.isBanned('u-1', 1_000)).toBe(true);
    expect(await service.isBanned('u-1', 10_000)).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Pasados los 15 s vuelve a preguntar a la base.
    prisma.user.findUnique.mockResolvedValue({ bannedAt: null });
    expect(await service.isBanned('u-1', 17_000)).toBe(false);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it('al bloquear o desbloquear se olvida lo recordado, sin esperar los 15 s', async () => {
    prisma.user.findUnique.mockResolvedValue({ bannedAt: null });
    expect(await service.isBanned('u-1', 1_000)).toBe(false);

    prisma.user.findUnique.mockResolvedValue({ bannedAt: new Date() });
    service.forget('u-1');
    expect(await service.isBanned('u-1', 2_000)).toBe(true);
  });

  it('una cuenta que ya no existe no cuenta como bloqueada', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await service.isBanned('fantasma')).toBe(false);
  });

  it('assertNotBanned lanza 403 con código ACCOUNT_BANNED solo si está bloqueada', () => {
    expect(() => assertNotBanned({ bannedAt: null })).not.toThrow();
    try {
      assertNotBanned({ bannedAt: new Date() });
      expect.unreachable();
    } catch (error) {
      const e = error as { getStatus(): number; getResponse(): { code: string; message: string } };
      expect(e.getStatus()).toBe(403);
      expect(e.getResponse()).toMatchObject({
        code: ACCOUNT_BANNED_CODE,
        message: 'Tu cuenta está bloqueada. Contacta a soporte.',
      });
    }
  });
});
