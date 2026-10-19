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
