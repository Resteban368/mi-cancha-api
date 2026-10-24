import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { SocialTokenVerifier } from './social-token.verifier.js';

const baseUser = {
  id: 'user-1',
  email: 'admin@golazo.co',
  passwordHash: null as string | null,
  displayName: 'Andrés',
  phone: null,
  role: UserRole.ADMIN_NEGOCIO as UserRole,
  verified: false,
  googleSub: null,
  appleSub: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  const social = { verifyGoogle: vi.fn(), verifyApple: vi.fn() };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };

  beforeEach(async () => {
    prisma = createPrismaMock();
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: SocialTokenVerifier, useValue: social },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'vieja12345', newPassword: 'nueva12345' };

    it('guarda la nueva contraseña hasheada cuando la actual es correcta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('vieja12345', 4),
      });

      await service.changePassword('user-1', dto);

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.passwordHash).not.toBe('nueva12345');
      await expect(
        bcrypt.compare('nueva12345', data.passwordHash),
      ).resolves.toBe(true);
    });

    it('rechaza (400, no 401) una contraseña actual incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('otra-distinta', 4),
      });

      await expect(service.changePassword('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza una nueva igual a la actual', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('vieja12345', 4),
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'vieja12345',
          newPassword: 'vieja12345',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuentas sin contraseña', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      await expect(service.changePassword('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('registerBusinessAdmin', () => {
    it('rechaza un email ya registrado', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      await expect(
        service.registerBusinessAdmin({
          fullName: 'Andrés',
          email: 'ADMIN@golazo.co',
          password: 'secreta123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('guarda el email en minúsculas y la contraseña hasheada', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) => ({
        ...baseUser,
        ...data,
      }));

      const result = await service.registerBusinessAdmin({
        fullName: 'Andrés',
        email: 'ADMIN@golazo.co',
        password: 'secreta123',
      });

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.email).toBe('admin@golazo.co');
      expect(data.role).toBe(UserRole.ADMIN_NEGOCIO);
      expect(await bcrypt.compare('secreta123', data.passwordHash)).toBe(true);
      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('loginBusiness', () => {
    it('rechaza una contraseña incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('correcta1', 4),
      });
      await expect(
        service.loginBusiness({ email: baseUser.email, password: 'otra' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza a un jugador aunque la contraseña coincida', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        role: UserRole.JUGADOR,
        passwordHash: await bcrypt.hash('correcta1', 4),
      });
      await expect(
        service.loginBusiness({ email: baseUser.email, password: 'correcta1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('emite un token con el id y el rol', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('correcta1', 4),
      });
      const result = await service.loginBusiness({
        email: baseUser.email,
        password: 'correcta1',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        role: UserRole.ADMIN_NEGOCIO,
      });
      expect(result.user).toEqual({
        id: 'user-1',
        displayName: 'Andrés',
        role: UserRole.ADMIN_NEGOCIO,
      });
    });

    it('rechaza a una cuenta bloqueada aunque la contraseña coincida, sin emitir token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        bannedAt: new Date(),
        passwordHash: await bcrypt.hash('correcta1', 4),
      });
      await expect(
        service.loginBusiness({ email: baseUser.email, password: 'correcta1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('una contraseña incorrecta sigue siendo 401 aunque la cuenta esté bloqueada (no revela el bloqueo)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        bannedAt: new Date(),
        passwordHash: await bcrypt.hash('correcta1', 4),
      });
      await expect(
        service.loginBusiness({ email: baseUser.email, password: 'otra' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signInWithGoogle', () => {
    const identity = {
      sub: 'google-123',
      email: 'Jugador@gmail.com',
      emailVerified: true,
      name: 'Laura',
    };

    it('crea un jugador nuevo cuando no existe', async () => {
      social.verifyGoogle.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) => ({
        ...baseUser,
        ...data,
      }));

      await service.signInWithGoogle({ idToken: 'token' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          googleSub: 'google-123',
          email: 'jugador@gmail.com',
          displayName: 'Laura',
          role: UserRole.JUGADOR,
          verified: true,
        }),
      });
    });

    it('vincula la cuenta de jugador existente con el mismo email', async () => {
      social.verifyGoogle.mockResolvedValue(identity);
      const player = { ...baseUser, id: 'player-1', role: UserRole.JUGADOR };
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(player);
      prisma.user.update.mockResolvedValue({
        ...player,
        googleSub: 'google-123',
      });

      await service.signInWithGoogle({ idToken: 'token' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'player-1' },
        data: { googleSub: 'google-123' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('no deja entrar con Google a una cuenta bloqueada', async () => {
      social.verifyGoogle.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        role: UserRole.JUGADOR,
        googleSub: 'google-123',
        bannedAt: new Date(),
      });

      await expect(
        service.signInWithGoogle({ idToken: 'token' }),
      ).rejects.toThrow(ForbiddenException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('no vincula Google a una cuenta bloqueada con el mismo email', async () => {
      social.verifyGoogle.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...baseUser,
        role: UserRole.JUGADOR,
        bannedAt: new Date(),
      });

      await expect(
        service.signInWithGoogle({ idToken: 'token' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('no vincula un email que pertenece a un negocio', async () => {
      social.verifyGoogle.mockResolvedValue(identity);
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseUser);

      await expect(
        service.signInWithGoogle({ idToken: 'token' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
