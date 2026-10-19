import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditCategory, UserRole } from '../generated/prisma/enums.js';
import { SkipAudit } from './audit-skip.decorator.js';
import { AuditInterceptor, sanitize } from './audit.interceptor.js';
import type { AuditService } from './audit.service.js';

const admin = { sub: 'sa-1', role: UserRole.SUPER_ADMIN };

describe('AuditInterceptor', () => {
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const interceptor = new AuditInterceptor(
    audit as unknown as AuditService,
    new Reflector(),
  );

  beforeEach(() => audit.log.mockClear());

  /** Ejecuta la petición simulada; devuelve lo que respondió el handler. */
  function run(
    req: {
      method: string;
      path: string;
      user?: { sub: string; role: UserRole };
      body?: unknown;
      params?: Record<string, string>;
    },
    handle: () => ReturnType<CallHandler['handle']>,
    handler: () => void = () => undefined,
  ) {
    const request = {
      method: req.method,
      route: { path: `/api/v1${req.path}` },
      user: req.user,
      body: req.body,
      params: req.params ?? {},
      headers: { 'x-forwarded-for': '203.0.113.9' },
    };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
    } as unknown as ExecutionContext;
    return lastValueFrom(interceptor.intercept(context, { handle }));
  }

  describe('acciones del super admin', () => {
    it('registra una acción con nombre propio: quién, sobre qué y qué cambió, sin contraseñas', async () => {
      await run(
        {
          method: 'PATCH',
          path: '/admin/clients/:id',
          user: admin,
          params: { id: 'biz-1' },
          body: { name: 'Nuevo nombre', password: 'secreta123', nested: { token: 'xyz' } },
        },
        () => of({ id: 'biz-1' }),
      );

      expect(audit.log).toHaveBeenCalledTimes(1);
      const entry = audit.log.mock.calls[0][0];
      expect(entry).toMatchObject({
        category: AuditCategory.ADMIN,
        action: 'client.updated',
        actor: { id: 'sa-1', role: UserRole.SUPER_ADMIN },
        entityType: 'Business',
        entityId: 'biz-1',
        ip: '203.0.113.9',
        metadata: {
          route: 'PATCH /admin/clients/:id',
          params: { id: 'biz-1' },
          changes: {
            name: 'Nuevo nombre',
            password: '[oculto]',
            nested: { token: '[oculto]' },
          },
        },
      });
      expect(JSON.stringify(entry)).not.toContain('secreta123');
    });

    it('toma como objeto afectado el parámetro de la regla (la cancha, no el cliente)', async () => {
      await run(
        {
          method: 'PATCH',
          path: '/admin/clients/:id/courts/:courtId',
          user: admin,
          params: { id: 'biz-1', courtId: 'court-9' },
          body: { name: 'Cancha 2' },
        },
        () => of({}),
      );

      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'court.updated',
        entityType: 'Court',
        entityId: 'court-9',
      });
    });

    it('en un alta toma el id del objeto creado de la respuesta', async () => {
      await run(
        { method: 'POST', path: '/admin/plans', user: admin, body: { name: 'Pro' } },
        () => of({ id: 'plan-1' }),
      );

      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'plan.created',
        entityType: 'Plan',
        entityId: 'plan-1',
      });
    });

    it('cualquier otra acción que cambie algo se registra como admin.action', async () => {
      await run(
        {
          method: 'POST',
          path: '/admin/catalogs/amenities',
          user: admin,
          body: { code: 'SAUNA', name: 'Sauna' },
        },
        () => of({ id: 'am-1' }),
      );

      expect(audit.log.mock.calls[0][0]).toMatchObject({
        category: AuditCategory.ADMIN,
        action: 'admin.action',
        entityType: 'Catalog',
        entityId: 'am-1',
        metadata: { route: 'POST /admin/catalogs/amenities' },
      });
    });

    it('las lecturas no se registran', async () => {
      await run({ method: 'GET', path: '/admin/clients', user: admin }, () => of([]));
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('un endpoint que registra su propio evento no se duplica', async () => {
      class Controller {
        @SkipAudit()
        ban() {}
      }
      await run(
        {
          method: 'POST',
          path: '/admin/users/:id/ban',
          user: admin,
          params: { id: 'u-1' },
        },
        () => of({}),
        Controller.prototype.ban,
      );

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('si el handler falla no registra la acción y propaga el error', async () => {
      const error = new BadRequestException('inválido');
      await expect(
        run(
          { method: 'PATCH', path: '/admin/clients/:id', user: admin, params: { id: 'b' } },
          () => throwError(() => error),
        ),
      ).rejects.toBe(error);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('eventos de seguridad', () => {
    it('ingreso de jugador exitoso: la cuenta sale de la respuesta', async () => {
      await run(
        {
          method: 'POST',
          path: '/public/auth/login',
          body: { identifier: '3001234567', password: 'clave1234' },
        },
        () => of({ accessToken: 't', player: { id: 'p-1', fullName: 'Pedro Jugador' } }),
      );

      const entry = audit.log.mock.calls[0][0];
      expect(entry).toMatchObject({
        category: AuditCategory.SECURITY,
        action: 'player.login',
        actor: { id: 'p-1', role: UserRole.JUGADOR, label: 'Pedro Jugador' },
        entityType: 'User',
        entityId: 'p-1',
      });
      expect(JSON.stringify(entry)).not.toContain('clave1234');
    });

    it('ingreso de negocio exitoso: la cuenta sale de `user`', async () => {
      await run(
        { method: 'POST', path: '/auth/business/login', body: { email: 'a@b.co', password: 'x' } },
        () => of({ accessToken: 't', user: { id: 'n-1', role: UserRole.ADMIN_NEGOCIO, displayName: 'Andrés' } }),
      );

      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'business.login',
        actor: { id: 'n-1', role: UserRole.ADMIN_NEGOCIO, label: 'Andrés' },
      });
    });

    it('ingreso fallido: guarda lo que escribió y el motivo, y vuelve a lanzar el error', async () => {
      const error = new UnauthorizedException('Credenciales inválidas');
      await expect(
        run(
          {
            method: 'POST',
            path: '/public/auth/login',
            body: { identifier: ' 3001234567 ', password: 'mala-clave' },
          },
          () => throwError(() => error),
        ),
      ).rejects.toBe(error);

      const entry = audit.log.mock.calls[0][0];
      expect(entry).toMatchObject({
        category: AuditCategory.SECURITY,
        action: 'player.login_failed',
        success: false,
        actor: { id: null, role: null, label: '3001234567' },
        metadata: {
          status: 401,
          message: 'Credenciales inválidas',
          identifier: '3001234567',
        },
      });
      expect(JSON.stringify(entry)).not.toContain('mala-clave');
    });

    it('un error de validación (400) en el ingreso no cuenta como intento fallido', async () => {
      await expect(
        run(
          { method: 'POST', path: '/public/auth/login', body: {} },
          () => throwError(() => new BadRequestException('falta el celular')),
        ),
      ).rejects.toThrow();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('pedir un código registra solo el límite alcanzado (429), no cada envío', async () => {
      await run(
        { method: 'POST', path: '/public/auth/register/code', body: { phone: '+573001112222' } },
        () => of({ message: 'ok' }),
      );
      expect(audit.log).not.toHaveBeenCalled();

      await expect(
        run(
          { method: 'POST', path: '/public/auth/register/code', body: { phone: '+573001112222' } },
          () => throwError(() => new HttpException('Espera 60 segundos', 429)),
        ),
      ).rejects.toThrow();
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'otp.rate_limited',
        success: false,
        actor: { label: '+573001112222' },
        metadata: { status: 429 },
      });
    });

    it('editar el perfil anota qué campos cambió, no sus valores', async () => {
      await run(
        {
          method: 'PATCH',
          path: '/player/me',
          user: { sub: 'p-1', role: UserRole.JUGADOR },
          body: { email: 'nuevo@correo.co', documentId: '123456' },
        },
        () => of({ id: 'p-1' }),
      );

      const entry = audit.log.mock.calls[0][0];
      expect(entry).toMatchObject({
        action: 'player.profile_updated',
        actor: { id: 'p-1', role: UserRole.JUGADOR },
        entityId: 'p-1',
        metadata: { fields: ['email', 'documentId'] },
      });
      expect(JSON.stringify(entry)).not.toContain('nuevo@correo.co');
    });
  });

  it('las rutas sin regla pasan sin tocar nada', async () => {
    const result = await run(
      { method: 'POST', path: '/public/businesses/:slug/x' },
      () => of('listo'),
    );
    expect(result).toBe('listo');
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('sanitize', () => {
  it('oculta contraseñas, tokens y secretos en cualquier nivel', () => {
    expect(
      sanitize({
        newPassword: 'a',
        accessToken: 'b',
        apiSecret: 'c',
        ok: 'visible',
        inner: { Authorization: 'Bearer x', n: 1 },
      }),
    ).toEqual({
      newPassword: '[oculto]',
      accessToken: '[oculto]',
      apiSecret: '[oculto]',
      ok: 'visible',
      inner: { Authorization: '[oculto]', n: 1 },
    });
  });

  it('recorta textos largos, listas largas y limita la profundidad', () => {
    const long = 'x'.repeat(500);
    const out = sanitize({
      text: long,
      list: Array.from({ length: 30 }, (_, i) => i),
      deep: { a: { b: { c: 1 } } },
    }) as Record<string, unknown>;

    expect((out.text as string).length).toBe(200);
    expect(out.list).toHaveLength(10);
    // Se conservan dos niveles; lo que está más adentro se resume.
    expect(out.deep).toEqual({ a: '[…]' });
  });
});
