import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuditCategory, UserRole } from '../generated/prisma/enums.js';
import { otpSecret } from '../otp/otp.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageArgs } from '../common/dto/page.dto.js';
import { AuditLogDto, AuditPageDto, AuditQueryDto } from './dto/audit.dto.js';

export interface AuditEntry {
  category: AuditCategory;
  /** Código de AUDIT_ACTIONS. */
  action: string;
  /** false en intentos rechazados. Por defecto true. */
  success?: boolean;
  actor?: {
    id?: string | null;
    role?: UserRole | null;
    /** Si falta y hay id, se busca el nombre de la cuenta. */
    label?: string | null;
  };
  entityType?: string | null;
  entityId?: string | null;
  /** Nunca contraseñas, códigos ni tokens. */
  metadata?: Record<string, unknown> | null;
  /** IP del cliente; se guarda solo su HMAC. */
  ip?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly secret: string;
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // El mismo secreto de los códigos SMS: así un origen es el mismo hash en ambos lados.
    this.secret = otpSecret(config);
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  /** Registra un evento. Nunca lanza: la auditoría no puede tumbar la operación auditada. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      const actorId = entry.actor?.id ?? null;
      const actorLabel =
        entry.actor?.label ?? (actorId ? await this.accountLabel(actorId) : null);
      await this.prisma.auditLog.create({
        data: {
          category: entry.category,
          action: entry.action,
          success: entry.success ?? true,
          actorId,
          actorRole: entry.actor?.role ?? null,
          actorLabel,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          ipHash: entry.ip
            ? createHmac('sha256', this.secret).update(`ip:${entry.ip}`).digest('hex')
            : null,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${entry.action}: ${(error as Error).message}`,
      );
    }
  }

  async list(query: AuditQueryDto): Promise<AuditPageDto> {
    const where = this.where(query);
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private where(query: AuditQueryDto): Prisma.AuditLogWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.category ? { category: query.category } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.success !== undefined ? { success: query.success } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: this.startOfDay(query.from) } : {}),
              // "hasta" incluye el día completo.
              ...(query.to
                ? { lt: new Date(this.startOfDay(query.to).getTime() + DAY_MS) }
                : {}),
            },
          }
        : {}),
      // Quién lo hizo (nombre, correo o celular) o sobre qué actuó (id).
      ...(search
        ? {
            OR: [
              { actorLabel: { contains: search, mode: 'insensitive' } },
              { actorId: search },
              { entityId: search },
            ],
          }
        : {}),
    };
  }

  private startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00${this.utcOffset}`);
  }

  /** Nombre visible de una cuenta (nombre, o correo/celular si no tiene). */
  private async accountLabel(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, phone: true },
    });
    return user ? user.displayName || user.email || user.phone : null;
  }
}

function toDto(row: {
  id: string;
  category: AuditCategory;
  action: string;
  success: boolean;
  actorId: string | null;
  actorRole: UserRole | null;
  actorLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  ipHash: string | null;
  createdAt: Date;
}): AuditLogDto {
  return {
    id: row.id,
    category: row.category,
    action: row.action,
    success: row.success,
    actorId: row.actorId,
    actorRole: row.actorRole,
    actorLabel: row.actorLabel,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    source: row.ipHash ? row.ipHash.slice(0, 8) : null,
    createdAt: row.createdAt,
  };
}
