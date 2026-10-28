import { ConflictException, Injectable } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service.js';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import { Prisma, type CashSession } from '../generated/prisma/client.js';
import { PaymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CashCurrentDto,
  CashMethodDto,
  CashSessionDto,
  CashSessionsQueryDto,
  CloseCashDto,
  OpenCashDto,
} from './dto/cash.dto.js';

/** Código del catálogo que cuenta como efectivo en la caja. */
export const CASH_METHOD = 'EFECTIVO';

/**
 * Turnos de caja del negocio: abrir con una base, ver lo cobrado por método
 * y cerrar contando el efectivo (arqueo). Una sola caja abierta a la vez.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async current(ownerId: string, now = new Date()): Promise<CashCurrentDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const [open, lastClosed] = await Promise.all([
      this.prisma.cashSession.findFirst({
        where: { businessId, closedAt: null },
      }),
      this.prisma.cashSession.findFirst({
        where: { businessId, closedAt: { not: null } },
        orderBy: { closedAt: 'desc' },
      }),
    ]);
    return {
      session: open
        ? toDto(open, await this.methods(businessId, open.openedAt, now))
        : null,
      lastClosed: lastClosed ? toDto(lastClosed) : null,
    };
  }

  async open(ownerId: string, dto: OpenCashDto): Promise<CashSessionDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const name = await this.userName(ownerId);
    const open = await this.prisma.cashSession.findFirst({
      where: { businessId, closedAt: null },
      select: { id: true },
    });
    if (open) throw new ConflictException('Ya hay una caja abierta');
    // El índice único parcial cubre dos aperturas al mismo tiempo (P2002 → 409).
    const session = await this.prisma.cashSession.create({
      data: {
        businessId,
        openingCash: dto.openingCash,
        openingNote: dto.note || null,
        openedById: ownerId,
        openedByName: name,
      },
    });
    return toDto(session, []);
  }

  async close(ownerId: string, dto: CloseCashDto): Promise<CashSessionDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const name = await this.userName(ownerId);
    const open = await this.prisma.cashSession.findFirst({
      where: { businessId, closedAt: null },
    });
    if (!open) throw new ConflictException('No hay una caja abierta');

    const closedAt = new Date();
    const methods = await this.methods(businessId, open.openedAt, closedAt);
    const expected = expectedCash(Number(open.openingCash), methods);
    // updateMany con closedAt null en el filtro evita cerrar dos veces.
    const { count } = await this.prisma.cashSession.updateMany({
      where: { id: open.id, closedAt: null },
      data: {
        closedAt,
        closedById: ownerId,
        closedByName: name,
        expectedCash: expected,
        countedCash: dto.countedCash,
        difference: round2(dto.countedCash - expected),
        closingNote: dto.note || null,
        summary: methods as unknown as Prisma.InputJsonValue,
      },
    });
    if (count === 0) throw new ConflictException('La caja ya fue cerrada');
    const closed = await this.prisma.cashSession.findUniqueOrThrow({
      where: { id: open.id },
    });
    return toDto(closed);
  }

  async history(
    ownerId: string,
    query: CashSessionsQueryDto,
  ): Promise<Page<CashSessionDto>> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const where = { businessId, closedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.cashSession.count({ where }),
    ]);
    return {
      items: items.map((s) => toDto(s)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Pagos aprobados recibidos en [from, to), por método, de mayor a menor. */
  private async methods(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<CashMethodDto[]> {
    const rows = await this.prisma.$queryRaw<CashMethodDto[]>(Prisma.sql`
      SELECT pm."code", pm."name", COUNT(*)::int AS "count",
        SUM(p."amount")::float8 AS "amount"
      FROM "Payment" p
      JOIN "PaymentMethod" pm ON pm."id" = p."methodId"
      WHERE p."businessId" = ${businessId}
        AND p."status" = ${PaymentStatus.APPROVED}::"PaymentStatus"
        AND p."receivedAt" >= ${from} AND p."receivedAt" < ${to}
      GROUP BY pm."code", pm."name"
      ORDER BY "amount" DESC, pm."name"`);
    return rows.map((r) => ({ ...r, amount: round2(r.amount) }));
  }

  private async userName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function expectedCash(
  openingCash: number,
  methods: CashMethodDto[],
): number {
  const cash = methods.find((m) => m.code === CASH_METHOD)?.amount ?? 0;
  return round2(openingCash + cash);
}

/** Con [live] (caja abierta) los totales son hasta ahora; si no, los del cierre. */
function toDto(s: CashSession, live?: CashMethodDto[]): CashSessionDto {
  const methods =
    live ?? (s.summary as unknown as CashMethodDto[] | null) ?? [];
  const openingCash = Number(s.openingCash);
  return {
    id: s.id,
    openingCash,
    openingNote: s.openingNote,
    openedAt: s.openedAt,
    openedByName: s.openedByName,
    closedAt: s.closedAt,
    closedByName: s.closedByName,
    closingNote: s.closingNote,
    expectedCash:
      s.expectedCash !== null
        ? Number(s.expectedCash)
        : expectedCash(openingCash, methods),
    countedCash: s.countedCash === null ? null : Number(s.countedCash),
    difference: s.difference === null ? null : Number(s.difference),
    methods,
    collected: round2(methods.reduce((sum, m) => sum + m.amount, 0)),
  };
}
