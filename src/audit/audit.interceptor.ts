import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, from, map, mergeMap, Observable, throwError } from 'rxjs';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { AuditCategory, UserRole } from '../generated/prisma/enums.js';
import { clientIp } from '../otp/client-ip.js';
import { API_PREFIX } from '../setup-app.js';
import {
  ADMIN_ENTITY_BY_RESOURCE,
  AUDIT_RULES,
  AuditRule,
  DEFAULT_FAILURES,
  FALLBACK_ADMIN_ACTION,
} from './audit-rules.js';
import { AUDIT_SKIP } from './audit-skip.decorator.js';
import { AuditService } from './audit.service.js';

type AuditedRequest = Request & { user?: AuthPayload };
type Body = Record<string, unknown>;

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const SENSITIVE_KEY = /password|passwd|token|secret|authorization|otp|hash/i;
const MAX_TEXT = 200;
const MAX_KEYS = 20;
const MAX_ITEMS = 10;
const MAX_DEPTH = 2;

/**
 * Registra en la auditoría lo que hace el super admin en el panel y los eventos de
 * seguridad (ingresos, registros, recuperación de clave). Está aquí, y no en cada
 * controlador, para que ninguna acción nueva quede sin registrar por olvido.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuditedRequest>();
    const route = routeOf(req);
    if (!route) return next.handle();

    const key = `${req.method} ${route}`;
    const rule = AUDIT_RULES[key] ?? adminFallback(req, route);
    if (!rule) return next.handle();
    if (this.reflector.get<boolean>(AUDIT_SKIP, context.getHandler())) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap((result) =>
        from(this.onSuccess(rule, key, req, result)).pipe(map(() => result)),
      ),
      catchError((error: unknown) =>
        from(this.onFailure(rule, key, req, error)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  private async onSuccess(
    rule: AuditRule,
    key: string,
    req: AuditedRequest,
    result: unknown,
  ): Promise<void> {
    if (!rule.success) return;
    const body = bodyOf(req);
    const identifier = identifierOf(rule, body);
    const actor =
      rule.actor === 'response'
        ? actorFromResponse(result)
        : {
            id: req.user?.sub,
            role: req.user?.role,
            // Sin sesión (p. ej. pedir un código) se muestra lo que escribió.
            label: req.user ? undefined : identifier,
          };
    const entityId =
      rule.actor === 'response'
        ? actor.id
        : (paramOf(req, rule.entityParam ?? 'id') ?? idOf(result));

    const metadata: Body = { route: key };
    if (rule.category === AuditCategory.ADMIN) {
      const params = { ...req.params };
      if (Object.keys(params).length) metadata.params = params;
      const changes = sanitize(body);
      if (changes && Object.keys(changes as Body).length) {
        metadata.changes = changes;
      }
    } else if (rule.fieldNames) {
      metadata.fields = Object.keys(body);
    }

    await this.audit.log({
      category: rule.category,
      action: rule.success,
      actor,
      entityType: rule.entityType,
      entityId,
      metadata,
      ip: clientIp(req),
    });
  }

  private async onFailure(
    rule: AuditRule,
    key: string,
    req: AuditedRequest,
    error: unknown,
  ): Promise<void> {
    if (!rule.failure) return;
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (!(rule.failureStatuses ?? DEFAULT_FAILURES).includes(status)) return;
    const identifier = identifierOf(rule, bodyOf(req));

    await this.audit.log({
      category: rule.category,
      action: rule.failure,
      success: false,
      actor: {
        id: req.user?.sub ?? null,
        role: req.user?.role ?? null,
        label: identifier ?? null,
      },
      entityType: rule.entityType,
      metadata: {
        route: key,
        status,
        message: messageOf(error),
        ...(identifier ? { identifier } : {}),
      },
      ip: clientIp(req),
    });
  }
}

/** Ruta del controlador (con :params) sin el prefijo de la API; null si no hay. */
function routeOf(req: AuditedRequest): string | null {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof path !== 'string') return null;
  const prefix = `/${API_PREFIX}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** Cualquier otra acción que cambie algo desde el panel del super admin. */
function adminFallback(req: AuditedRequest, route: string): AuditRule | null {
  if (
    req.user?.role !== UserRole.SUPER_ADMIN ||
    READ_METHODS.includes(req.method) ||
    !route.startsWith('/admin/')
  ) {
    return null;
  }
  const resource = route.split('/')[2];
  return {
    category: AuditCategory.ADMIN,
    success: FALLBACK_ADMIN_ACTION,
    entityType: ADMIN_ENTITY_BY_RESOURCE[resource],
    actor: 'request',
  };
}

function bodyOf(req: AuditedRequest): Body {
  const body: unknown = req.body;
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Body)
    : {};
}

function identifierOf(rule: AuditRule, body: Body): string | undefined {
  const value = rule.identifier ? body[rule.identifier] : undefined;
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 100)
    : undefined;
}

function paramOf(req: AuditedRequest, name: string): string | undefined {
  const value = (req.params as Record<string, string | undefined>)?.[name];
  return value || undefined;
}

function idOf(result: unknown): string | undefined {
  const id = (result as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : undefined;
}

/** Quién ingresó o se registró, según la respuesta (negocio: `user`, jugador: `player`). */
function actorFromResponse(result: unknown): {
  id?: string;
  role?: UserRole;
  label?: string;
} {
  const res = result as {
    user?: { id?: string; role?: UserRole; displayName?: string };
    player?: { id?: string; fullName?: string };
  } | null;
  if (res?.user) {
    return { id: res.user.id, role: res.user.role, label: res.user.displayName };
  }
  if (res?.player) {
    return { id: res.player.id, role: UserRole.JUGADOR, label: res.player.fullName };
  }
  return {};
}

function messageOf(error: unknown): string {
  if (!(error instanceof HttpException)) return 'Error inesperado';
  const response = error.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : (response as { message?: string | string[] }).message;
  const text = Array.isArray(message) ? message.join('. ') : message;
  return (text ?? error.message).slice(0, MAX_TEXT);
}

/**
 * Copia acotada de lo que envió el cliente para guardarla como detalle: oculta
 * contraseñas y tokens, recorta textos largos y limita la profundidad.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.slice(0, MAX_TEXT);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => sanitize(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Body)
      .slice(0, MAX_KEYS)
      .map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[oculto]' : sanitize(v, depth + 1)]),
  );
}
