import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pageArgs } from '../common/dto/page.dto.js';
import { ReservationStatus, Sport } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PlayerReservationFilter,
  type PlayerReservationPageDto,
  type PlayerReservationsQueryDto,
  type PlayerStatsDto,
} from './dto/player-history.dto.js';
import { reservationInclude, toReservationDto } from './reservations.service.js';

/** Tope de reservas que se leen por jugador (más que suficiente para una persona). */
const HISTORY_CAP = 2000;
const MONTHS = 6;
const HOUR_MS = 3_600_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Historial y estadísticas del jugador en todas las sedes. */
@Injectable()
export class PlayerHistoryService {
  private readonly utcOffsetMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.utcOffsetMs = offsetMs(config.getOrThrow<string>('APP_UTC_OFFSET'));
  }

  /** Todas las reservas del jugador, con filtros; una reserva de varias canchas sale una sola vez. */
  async list(
    playerId: string,
    query: PlayerReservationsQueryDto,
    now = new Date(),
  ): Promise<PlayerReservationPageDto> {
    const rows = await this.prisma.reservation.findMany({
      where: this.where(playerId, query, now),
      include: { ...reservationInclude, business: { select: { name: true, slug: true } } },
      orderBy: [
        { start: query.status === PlayerReservationFilter.UPCOMING ? 'asc' : 'desc' },
        { id: 'asc' },
      ],
      take: HISTORY_CAP,
    });
    const seen = new Set<string>();
    const games = rows.filter((r) => {
      if (!r.groupId) return true;
      if (seen.has(r.groupId)) return false;
      seen.add(r.groupId);
      return true;
    });
    const { skip, take } = pageArgs(query);
    return {
      items: games.slice(skip, skip + take).map((r) => ({
        ...toReservationDto(r),
        businessName: r.business.name,
        businessSlug: r.business.slug ?? '',
      })),
      total: games.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async stats(playerId: string, now = new Date()): Promise<PlayerStatsDto> {
    const rows = await this.prisma.reservation.findMany({
      where: this.owner(playerId),
      select: {
        groupId: true,
        status: true,
        start: true,
        end: true,
        totalPrice: true,
        court: { select: { name: true, sport: true, currency: true } },
        business: { select: { name: true, slug: true } },
      },
      orderBy: { start: 'desc' },
      take: HISTORY_CAP,
    });

    // Un partido por reserva; las de varias canchas suman sus montos.
    const games = new Map<string, (typeof rows)[number] & { price: number }>();
    for (const row of rows) {
      const key = row.groupId ?? `${row.start.toISOString()}-${row.court.name}-${games.size}`;
      const price = Number(row.totalPrice);
      const known = games.get(key);
      if (known) known.price += price;
      else games.set(key, { ...row, price });
    }

    const stats: PlayerStatsDto = {
      total: games.size,
      played: 0,
      upcoming: 0,
      cancelled: 0,
      noShow: 0,
      hoursPlayed: 0,
      spent: 0,
      currency: rows[0]?.court.currency ?? 'COP',
      favoriteSport: null,
      topBusiness: null,
      bySport: [],
      byMonth: [],
      next: null,
    };
    const bySport = new Map<Sport, number>();
    const byBusiness = new Map<string, { name: string; slug: string; played: number }>();
    const byMonth = new Map<string, number>(this.lastMonths(now).map((m) => [m, 0]));
    let hours = 0;

    for (const g of games.values()) {
      if (g.status === ReservationStatus.CANCELLED) stats.cancelled++;
      else if (g.status === ReservationStatus.NO_SHOW) stats.noShow++;
      else if (g.status === ReservationStatus.CONFIRMED && g.end > now) {
        stats.upcoming++;
        if (!stats.next || g.start < stats.next.start) {
          stats.next = {
            start: g.start,
            end: g.end,
            businessName: g.business.name,
            businessSlug: g.business.slug ?? '',
            courtName: g.court.name,
          };
        }
      } else {
        // COMPLETED, o CONFIRMED que ya pasó.
        stats.played++;
        hours += (g.end.getTime() - g.start.getTime()) / HOUR_MS;
        stats.spent += g.price;
        bySport.set(g.court.sport, (bySport.get(g.court.sport) ?? 0) + 1);
        const slug = g.business.slug ?? g.business.name;
        const b = byBusiness.get(slug) ?? { name: g.business.name, slug: g.business.slug ?? '', played: 0 };
        b.played++;
        byBusiness.set(slug, b);
        const month = this.monthOf(g.start);
        if (byMonth.has(month)) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      }
    }

    stats.hoursPlayed = Math.round(hours * 10) / 10;
    stats.spent = round2(stats.spent);
    stats.bySport = [...bySport].map(([sport, played]) => ({ sport, played })).sort((a, b) => b.played - a.played);
    stats.favoriteSport = stats.bySport[0]?.sport ?? null;
    stats.topBusiness = [...byBusiness.values()].sort((a, b) => b.played - a.played)[0] ?? null;
    stats.byMonth = [...byMonth].map(([month, played]) => ({ month, played }));
    return stats;
  }

  /** Reservas hechas por el jugador (por la web) o a su nombre como cliente de una sede. */
  private owner(playerId: string): Prisma.ReservationWhereInput {
    return { OR: [{ playerId }, { customer: { userId: playerId } }] };
  }

  private where(
    playerId: string,
    query: PlayerReservationsQueryDto,
    now: Date,
  ): Prisma.ReservationWhereInput {
    const and: Prisma.ReservationWhereInput[] = [this.owner(playerId)];
    switch (query.status) {
      case PlayerReservationFilter.UPCOMING:
        and.push({ status: ReservationStatus.CONFIRMED, end: { gt: now } });
        break;
      case PlayerReservationFilter.PLAYED:
        and.push({
          OR: [
            { status: ReservationStatus.COMPLETED },
            { status: ReservationStatus.CONFIRMED, end: { lte: now } },
          ],
        });
        break;
      case PlayerReservationFilter.CANCELLED:
        and.push({ status: ReservationStatus.CANCELLED });
        break;
      case PlayerReservationFilter.NO_SHOW:
        and.push({ status: ReservationStatus.NO_SHOW });
        break;
    }
    if (query.sport) and.push({ court: { sport: query.sport } });
    if (query.business) and.push({ business: { slug: query.business } });
    return { AND: and };
  }

  /** YYYY-MM de un instante en la hora del negocio. */
  private monthOf(date: Date): string {
    return new Date(date.getTime() + this.utcOffsetMs).toISOString().slice(0, 7);
  }

  /** Los últimos MONTHS meses, del más antiguo al actual. */
  private lastMonths(now: Date): string[] {
    const local = new Date(now.getTime() + this.utcOffsetMs);
    return Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (MONTHS - 1 - i), 1));
      return d.toISOString().slice(0, 7);
    });
  }
}

/** "-05:00" → milisegundos de desfase. */
function offsetMs(offset: string): number {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return sign * (h * 60 + (m || 0)) * 60_000;
}
