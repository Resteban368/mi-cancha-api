import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { localDate } from '../courts/court-time.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  OtpDailyDto,
  OtpStatsDto,
  OtpTopPhoneDto,
  OtpTopSourceDto,
  OtpTopUserDto,
} from './dto/otp-stats.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const TOP_PHONES = 10;
const TOP_SOURCES = 5;

/**
 * Cuántos códigos SMS se han enviado y quién los pide. Cada fila de otp_codes es un
 * código enviado (si el SMS falla, la fila se borra), así que contarlas es contar envíos.
 */
@Injectable()
export class OtpStatsService {
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  async stats(days = DEFAULT_DAYS, now = new Date()): Promise<OtpStatsDto> {
    const today = localDate(now, this.utcOffset);
    // Días calendario de Colombia: el período empieza a las 00:00 de su primer día.
    const dates = Array.from({ length: days }, (_, i) =>
      localDate(new Date(now.getTime() - (days - 1 - i) * DAY_MS), this.utcOffset),
    );
    const since = this.startOfDay(dates[0]);
    const offsetMinutes = toOffsetMinutes(this.utcOffset);

    const [
      todayCount,
      last7Days,
      last30Days,
      all,
      periodRequests,
      periodVerified,
      dailyRows,
      phoneRows,
      sourceRows,
    ] = await Promise.all([
      this.prisma.otpCode.count({
        where: { createdAt: { gte: this.startOfDay(today) } },
      }),
      this.prisma.otpCode.count({
        where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      }),
      this.prisma.otpCode.count({
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
      this.prisma.otpCode.count(),
      this.prisma.otpCode.count({ where: { createdAt: { gte: since } } }),
      this.prisma.otpCode.count({
        where: { createdAt: { gte: since }, usedAt: { not: null } },
      }),
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT to_char(created_at + make_interval(mins => ${offsetMinutes}::int), 'YYYY-MM-DD') AS date,
               count(*)::int AS count
        FROM otp_codes WHERE created_at >= ${since} GROUP BY 1`,
      this.prisma.otpCode.groupBy({
        by: ['phone'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: [{ _count: { phone: 'desc' } }, { phone: 'asc' }],
        take: TOP_PHONES,
      }),
      this.prisma.$queryRaw<
        { ip_hash: string; requests: number; phones: number }[]
      >`
        SELECT ip_hash, count(*)::int AS requests, count(DISTINCT phone)::int AS phones
        FROM otp_codes WHERE created_at >= ${since} AND ip_hash IS NOT NULL
        GROUP BY ip_hash ORDER BY requests DESC, ip_hash LIMIT ${TOP_SOURCES}`,
    ]);

    const perDay = new Map(dailyRows.map((r) => [r.date, r.count]));
    const daily: OtpDailyDto[] = dates.map((date) => ({
      date,
      count: perDay.get(date) ?? 0,
    }));

    return {
      days,
      totals: { today: todayCount, last7Days, last30Days, all },
      period: { requests: periodRequests, verified: periodVerified },
      daily,
      topPhones: await this.topPhones(phoneRows, since),
      topSources: sourceRows.map(
        (r): OtpTopSourceDto => ({
          source: r.ip_hash.slice(0, 8),
          requests: r.requests,
          phones: r.phones,
        }),
      ),
    };
  }

  /** Completa el ranking con los códigos verificados y la cuenta dueña de cada celular. */
  private async topPhones(
    rows: { phone: string; _count: { _all: number }; _max: { createdAt: Date | null } }[],
    since: Date,
  ): Promise<OtpTopPhoneDto[]> {
    if (!rows.length) return [];
    const phones = rows.map((r) => r.phone);
    const [verifiedRows, users] = await Promise.all([
      this.prisma.otpCode.groupBy({
        by: ['phone'],
        where: {
          phone: { in: phones },
          createdAt: { gte: since },
          usedAt: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { phone: { in: phones } },
        select: { id: true, displayName: true, role: true, phone: true },
      }),
    ]);

    const verified = new Map(verifiedRows.map((r) => [r.phone, r._count._all]));
    // Un celular puede estar en un jugador y en un negocio: se prefiere el jugador.
    const owners = new Map<string, OtpTopUserDto>();
    for (const u of users) {
      const current = owners.get(u.phone!);
      if (!current || (u.role === UserRole.JUGADOR && current.role !== UserRole.JUGADOR)) {
        owners.set(u.phone!, { id: u.id, displayName: u.displayName, role: u.role });
      }
    }

    return rows.map((r) => ({
      phone: r.phone,
      requests: r._count._all,
      verified: verified.get(r.phone) ?? 0,
      lastRequestAt: r._max.createdAt!,
      user: owners.get(r.phone) ?? null,
    }));
  }

  /** Las 00:00 de un día calendario de Colombia, como instante. */
  private startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00${this.utcOffset}`);
  }
}

/** "-05:00" → -300. */
function toOffsetMinutes(utcOffset: string): number {
  const sign = utcOffset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = utcOffset.slice(1).split(':').map(Number);
  return sign * (hours * 60 + (minutes || 0));
}
