// Tipos de las respuestas de /api/v1/admin/security.

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_NEGOCIO' | 'JUGADOR';

/** Campos de bloqueo que la API agrega a cada usuario del listado. */
export interface BanFields {
  bannedAt: string | null;
  bannedReason: string | null;
}

/** Qué pasaría al bloquear una cuenta. */
export interface BanPreview extends BanFields {
  id: string;
  displayName: string;
  role: UserRole;
  /** Negocio que administra (si es ADMIN_NEGOCIO). */
  businessName: string | null;
  /** Reservas confirmadas futuras que se cancelarían. */
  futureReservations: number;
}

export interface BanResult {
  id: string;
  bannedAt: string;
  cancelledReservations: number;
  /** Reservas que se quisieron cancelar y no se pudo. */
  failedCancellations: number;
}

export type AuditCategory = 'ADMIN' | 'SECURITY';

/** Acción que se registra, con su etiqueta para mostrar (viene de la API). */
export interface AuditAction {
  code: string;
  category: AuditCategory;
  label: string;
}

export interface AuditEntry {
  id: string;
  category: AuditCategory;
  action: string;
  /** false en intentos rechazados (ingreso fallido, límite de códigos). */
  success: boolean;
  actorId: string | null;
  actorRole: UserRole | null;
  /** Nombre, correo o celular de quien lo hizo, como se veía en ese momento. */
  actorLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  /** Primeros 8 caracteres del hash de la IP. */
  source: string | null;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OtpStats {
  /** Días del período del gráfico y los rankings. */
  days: number;
  totals: { today: number; last7Days: number; last30Days: number; all: number };
  /** Códigos enviados y verificados dentro del período. */
  period: { requests: number; verified: number };
  daily: { date: string; count: number }[];
  topPhones: {
    phone: string;
    requests: number;
    verified: number;
    lastRequestAt: string;
    /** Cuenta con ese celular; null si nadie se registró con él. */
    user: { id: string; displayName: string; role: UserRole } | null;
  }[];
  topSources: { source: string; requests: number; phones: number }[];
}

/** Negocio al que se le puede enviar un aviso. */
export interface BroadcastRecipient {
  businessId: string;
  name: string;
  ownerName: string;
  /** Navegadores con los avisos activados; 0 = no recibiría nada. */
  devices: number;
  banned: boolean;
}

export interface BroadcastResult {
  businesses: number;
  reachable: number;
  delivered: number;
}

/** Un aviso ya enviado, con a cuántos llegó. */
export interface BroadcastHistoryItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
  scope: 'ALL' | 'SELECTED';
  sentByLabel: string | null;
  targeted: number;
  reachable: number;
  delivered: number;
  /** Dueños que ya lo leyeron en su bandeja. */
  read: number;
  createdAt: string;
}

export interface BroadcastHistoryPage {
  items: BroadcastHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Imagen subida para un aviso, lista para enviarla con su id. */
export interface UploadedNotificationImage {
  id: string;
  url: string;
}
