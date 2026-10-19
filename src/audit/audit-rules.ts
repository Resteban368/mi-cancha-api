import { AuditCategory } from '../generated/prisma/enums.js';

/** Cómo se audita una ruta de la API (la ruta es la del controlador, sin el prefijo /api/v1). */
export interface AuditRule {
  category: AuditCategory;
  /** Acción si la petición sale bien; null = no registrar los éxitos. */
  success: string | null;
  /** Acción si la rechazan (según failureStatuses); sin ella no se registran los fallos. */
  failure?: string;
  /** Códigos HTTP que cuentan como rechazo. Por defecto 401, 403, 409 y 429. */
  failureStatuses?: number[];
  entityType?: string;
  /** Parámetro de la ruta que identifica el objeto afectado. Por defecto `id`. */
  entityParam?: string;
  /** De dónde sale quién actuó: del token de la petición o de la respuesta (login/registro). */
  actor: 'request' | 'response';
  /** Campo del cuerpo con lo que escribió quien intenta ingresar (correo o celular). */
  identifier?: 'email' | 'identifier' | 'phone';
  /** Solo se anotan los nombres de los campos enviados, no sus valores. */
  fieldNames?: boolean;
}

const DEFAULT_FAILURES = [401, 403, 409, 429];

const admin = (success: string, entityType: string, entityParam?: string): AuditRule => ({
  category: AuditCategory.ADMIN,
  success,
  entityType,
  entityParam,
  actor: 'request',
});

/** Rutas con nombre propio. El resto de acciones del super admin cae en `admin.action`. */
export const AUDIT_RULES: Record<string, AuditRule> = {
  'POST /admin/clients': admin('client.created', 'Business'),
  'PATCH /admin/clients/:id': admin('client.updated', 'Business'),
  'PUT /admin/clients/:id/image': admin('client.image_set', 'Business'),
  'DELETE /admin/clients/:id/image': admin('client.image_removed', 'Business'),
  'PATCH /admin/clients/:id/subscription': admin('client.subscription_updated', 'Business'),
  'PATCH /admin/clients/:id/online-booking': admin('client.online_booking_updated', 'Business'),
  'PATCH /admin/clients/:id/courts/:courtId': admin('court.updated', 'Court', 'courtId'),
  'POST /admin/clients/:id/reservations': admin('reservation.created', 'Business'),
  'POST /admin/clients/:id/reservations/:reservationId/cancel': admin('reservation.cancelled', 'Reservation', 'reservationId'),
  'POST /admin/clients/:id/customers': admin('customer.created', 'Business'),
  'PATCH /admin/clients/:id/customers/:customerId': admin('customer.updated', 'Customer', 'customerId'),
  'POST /admin/plans': admin('plan.created', 'Plan'),
  'PATCH /admin/plans/:id': admin('plan.updated', 'Plan'),
  'DELETE /admin/plans/:id': admin('plan.deleted', 'Plan'),

  'POST /auth/business/login': {
    category: AuditCategory.SECURITY,
    success: 'business.login',
    failure: 'business.login_failed',
    entityType: 'User',
    actor: 'response',
    identifier: 'email',
  },
  'POST /auth/business/register': {
    category: AuditCategory.SECURITY,
    success: 'business.registered',
    entityType: 'User',
    actor: 'response',
  },
  'POST /auth/google': {
    category: AuditCategory.SECURITY,
    success: 'player.social_login',
    failure: 'player.social_login_failed',
    entityType: 'User',
    actor: 'response',
  },
  'POST /auth/apple': {
    category: AuditCategory.SECURITY,
    success: 'player.social_login',
    failure: 'player.social_login_failed',
    entityType: 'User',
    actor: 'response',
  },
  'POST /public/auth/login': {
    category: AuditCategory.SECURITY,
    success: 'player.login',
    failure: 'player.login_failed',
    entityType: 'User',
    actor: 'response',
    identifier: 'identifier',
  },
  'POST /public/auth/register': {
    category: AuditCategory.SECURITY,
    success: 'player.registered',
    entityType: 'User',
    actor: 'response',
  },
  'POST /public/auth/password/code': {
    category: AuditCategory.SECURITY,
    success: 'player.password_reset_requested',
    failure: 'otp.rate_limited',
    failureStatuses: [429],
    actor: 'request',
    identifier: 'phone',
  },
  'POST /public/auth/password/reset': {
    category: AuditCategory.SECURITY,
    success: 'player.password_reset',
    failure: 'player.password_reset_failed',
    entityType: 'User',
    actor: 'response',
    identifier: 'phone',
  },
  'PATCH /player/me': {
    category: AuditCategory.SECURITY,
    success: 'player.profile_updated',
    entityType: 'User',
    actor: 'request',
    fieldNames: true,
  },
  // Solo interesa cuando se alcanza el límite: los envíos normales ya se cuentan aparte.
  'POST /public/auth/register/code': {
    category: AuditCategory.SECURITY,
    success: null,
    failure: 'otp.rate_limited',
    failureStatuses: [429],
    actor: 'request',
    identifier: 'phone',
  },
  'POST /public/auth/otp/request': {
    category: AuditCategory.SECURITY,
    success: null,
    failure: 'otp.rate_limited',
    failureStatuses: [429],
    actor: 'request',
    identifier: 'phone',
  },
};

export const FALLBACK_ADMIN_ACTION = 'admin.action';
export { DEFAULT_FAILURES };

/** Tipo de objeto según el primer tramo de /admin/<recurso>. */
export const ADMIN_ENTITY_BY_RESOURCE: Record<string, string> = {
  clients: 'Business',
  plans: 'Plan',
  users: 'User',
  catalogs: 'Catalog',
};
