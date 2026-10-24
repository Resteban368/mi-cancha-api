import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PlayerAuthService } from './player-auth.service.js';

const jwt = { signAsync: vi.fn().mockResolvedValue('token') };

function player(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    role: 'JUGADOR',
    displayName: 'Laura Gómez',
    email: null,
    phone: '+573115550001',
    documentId: '1075111222',
    birthDate: null,
    favoriteSport: null,
    passwordHash: null as string | null,
    mustChangePassword: true,
    dataConsentAt: null,
    bannedAt: null,
    ...overrides,
  };
}

describe('PlayerAuthService (cuenta creada por un negocio)', () => {
  let prisma: PrismaMock;
  let service: PlayerAuthService;
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('1075111222', 4);
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PlayerAuthService(
      prisma as unknown as PrismaService,
      jwt as never,
      {} as never,
    );
    prisma.user.update.mockImplementation(({ data }) => ({
      ...player({ passwordHash: hash }),
      ...data,
    }));
  });

  describe('login', () => {
    it('entra con la cédula como clave, con o sin puntos, y avisa que debe cambiarla', async () => {
      prisma.user.findFirst.mockResolvedValue(player({ passwordHash: hash }));

      for (const password of ['1075111222', '1.075.111.222']) {
        const session = await service.login({
          identifier: '311 555 0001',
          password,
        });
        expect(session.player).toMatchObject({
          mustChangePassword: true,
          needsDataConsent: true,
        });
      }
    });

    it('la cédula con puntos no sirve si la cuenta ya cambió su clave', async () => {
      prisma.user.findFirst.mockResolvedValue(
        player({ passwordHash: hash, mustChangePassword: false }),
      );

      await expect(
        service.login({ identifier: '3115550001', password: '1.075.111.222' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(player({ passwordHash: hash }));
    });

    it('guarda la nueva clave y quita la obligación de cambiarla', async () => {
      const result = await service.changePassword('user-1', {
        currentPassword: '1075111222',
        newPassword: 'MiClaveNueva1',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      await expect(
        bcrypt.compare('MiClaveNueva1', data.passwordHash),
      ).resolves.toBe(true);
      expect(data.mustChangePassword).toBe(false);
      expect(result.mustChangePassword).toBe(false);
    });

    it('rechaza (400) la clave actual incorrecta', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'otra',
          newPassword: 'MiClaveNueva1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza una nueva igual a la cédula', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: '1075111222',
          newPassword: '1.075.111.222',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('acceptDataPolicy registra la aceptación y la versión de la política', async () => {
    prisma.user.findUnique.mockResolvedValue(player());

    const result = await service.acceptDataPolicy('user-1');

    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.dataConsentAt).toBeInstanceOf(Date);
    expect(data.dataConsentVersion).toBeTruthy();
    expect(result.needsDataConsent).toBe(false);
  });
});
