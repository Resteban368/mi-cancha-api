import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { AuditCategory, UserRole } from '../generated/prisma/enums.js';
import { otpSecret } from '../otp/otp.module.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit.dto.js';

describe('AuditService', () => {
  let prisma: PrismaMock;
  let service: AuditService;
  const config = new ConfigService({
    APP_UTC_OFFSET: '-05:00',
    JWT_SECRET: 'a'.repeat(32),
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuditService(prisma as unknown as PrismaService, config);
  });

  describe('log', () => {
    it('guarda el evento con la IP como HMAC (la misma de los códigos SMS), nunca la IP', async () => {
      await service.log({
        category: AuditCategory.SECURITY,
        action: 'player.login_failed',
        success: false,
        actor: { label: '3001234567' },
        entityType: 'User',
        metadata: { status: 401 },
        ip: '203.0.113.9',
      });

      const { data } = prisma.auditLog.create.mock.calls[0][0];
      expect(data).toMatchObject({
        category: AuditCategory.SECURITY,
        action: 'player.login_failed',
        success: false,
        actorId: null,
        actorLabel: '3001234567',
        entityType: 'User',
        metadata: { status: 401 },
      });
      expect(data.ipHash).toBe(
        createHmac('sha256', otpSecret(config)).update('ip:203.0.113.9').digest('hex'),
      );
      expect(JSON.stringify(data)).not.toContain('203.0.113.9');
    });

    it('si hay cuenta pero no nombre, busca el nombre de la cuenta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        displayName: 'Super Admin',
        email: 'a@b.co',
        phone: null,
      });

      await service.log({
        category: AuditCategory.ADMIN,
        action: 'client.created',
        actor: { id: 'u-1', role: UserRole.SUPER_ADMIN },
      });

      const { data } = prisma.auditLog.create.mock.calls[0][0];
      expect(data).toMatchObject({
        actorId: 'u-1',
        actorRole: UserRole.SUPER_ADMIN,
        actorLabel: 'Super Admin',
        success: true,
      });
    });

    it('nunca lanza: si falla la base, la operación auditada sigue', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('base caída'));

      await expect(
        service.log({ category: AuditCategory.ADMIN, action: 'plan.created' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    const query = (extra: Partial<AuditQueryDto> = {}) =>
      Object.assign(new AuditQueryDto(), extra);

    beforeEach(() => {
      prisma.auditLog.count.mockResolvedValue(1);
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a-1',
          category: AuditCategory.SECURITY,
          action: 'player.login_failed',
          success: false,
          actorId: null,
          actorRole: null,
          actorLabel: '3001234567',
          entityType: 'User',
          entityId: null,
          metadata: { status: 401 },
          ipHash: 'abcdef1234567890',
          createdAt: new Date('2026-10-19T15:00:00Z'),
        },
      ]);
    });

    it('lista del más reciente al más antiguo, paginado, sin exponer el hash completo de la IP', async () => {
      const page = await service.list(query({ page: 2, pageSize: 10 }));

      const args = prisma.auditLog.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect(args).toMatchObject({ skip: 10, take: 10 });
      expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
      expect(page.items[0]).toMatchObject({
        id: 'a-1',
        source: 'abcdef12',
        metadata: { status: 401 },
      });
      expect(page.items[0]).not.toHaveProperty('ipHash');
    });

    it('filtra por categoría, acción, resultado, fechas (hora de Colombia) y texto', async () => {
      await service.list(
        query({
          category: AuditCategory.SECURITY,
          action: 'player.login_failed',
          success: false,
          from: '2026-10-10',
          to: '2026-10-12',
          search: ' Pedro ',
        }),
      );

      const { where } = prisma.auditLog.findMany.mock.calls[0][0];
      expect(where).toMatchObject({
        category: AuditCategory.SECURITY,
        action: 'player.login_failed',
        success: false,
        createdAt: {
          gte: new Date('2026-10-10T05:00:00Z'),
          // "hasta el 12" incluye todo el día 12.
          lt: new Date('2026-10-13T05:00:00Z'),
        },
      });
      expect(where.OR).toEqual([
        { actorLabel: { contains: 'Pedro', mode: 'insensitive' } },
        { actorId: 'Pedro' },
        { entityId: 'Pedro' },
      ]);
    });

    it('sin filtros no restringe nada', async () => {
      await service.list(query());
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({});
    });
  });
});
