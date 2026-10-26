import { AuditCategory } from '../generated/prisma/enums.js';

export interface AuditActionInfo {
  code: string;
  category: AuditCategory;
  /** Texto para mostrar en el panel. */
  label: string;
}

const admin = (code: string, label: string): AuditActionInfo => ({
  code,
  category: AuditCategory.ADMIN,
  label,
});
const security = (code: string, label: string): AuditActionInfo => ({
  code,
  category: AuditCategory.SECURITY,
  label,
});

/** Todas las acciones que se registran: el panel las usa para filtrar y mostrar etiquetas. */
export const AUDIT_ACTIONS: AuditActionInfo[] = [
  admin('client.created', 'Cliente creado'),
  admin('client.updated', 'Datos del cliente editados'),
  admin('client.owner_updated', 'Responsable del cliente editado'),
  admin('client.deleted', 'Cliente eliminado'),
  admin('client.image_set', 'Foto del cliente cambiada'),
  admin('client.image_removed', 'Foto del cliente eliminada'),
  admin('client.subscription_updated', 'Plan o estado del cliente cambiado'),
  admin('client.online_booking_updated', 'Link de reservas del cliente cambiado'),
  admin('court.updated', 'Cancha editada'),
  admin('reservation.created', 'Reserva creada por el admin'),
  admin('reservation.cancelled', 'Reserva cancelada por el admin'),
  admin('customer.created', 'Cliente del negocio creado'),
  admin('customer.updated', 'Cliente del negocio editado'),
  admin('plan.created', 'Plan creado'),
  admin('plan.updated', 'Plan editado'),
  admin('plan.deleted', 'Plan eliminado'),
  admin('user.banned', 'Usuario bloqueado'),
  admin('user.unbanned', 'Usuario desbloqueado'),
  admin('notification.broadcast', 'Aviso enviado a negocios'),
  admin('admin.action', 'Otra acción del panel'),

  security('business.login', 'Ingreso de negocio'),
  security('business.login_failed', 'Ingreso de negocio fallido'),
  security('business.registered', 'Negocio registrado'),
  security('player.login', 'Ingreso de jugador'),
  security('player.login_failed', 'Ingreso de jugador fallido'),
  security('player.registered', 'Jugador registrado'),
  security('player.social_login', 'Ingreso con Google o Apple'),
  security('player.social_login_failed', 'Ingreso con Google o Apple fallido'),
  security('player.password_reset_requested', 'Recuperación de clave solicitada'),
  security('player.password_reset', 'Clave de jugador cambiada'),
  security('player.password_reset_failed', 'Cambio de clave fallido'),
  security('player.profile_updated', 'Perfil de jugador editado'),
  security('otp.rate_limited', 'Límite de códigos SMS alcanzado'),
];

export const AUDIT_ACTION_CODES = new Set(AUDIT_ACTIONS.map((a) => a.code));
