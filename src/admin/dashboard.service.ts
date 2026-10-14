import { Injectable } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardDto, MonthlySignupsDto } from './dto/admin.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_MONTHS = 6;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(now = new Date()): Promise<DashboardDto> {
    const last30Days = new Date(now.getTime() - 30 * DAY_MS);
    const months = lastMonths(now, SIGNUP_MONTHS);
    const since = new Date(`${months[0]}-01T00:00:00Z`);

    const [
      totalClients,
      activeClients,
      newClients,
      usersByRole,
      activeCourts,
      recentReservations,
      activeSubscriptions,
      plans,
      clientSignups,
      playerSignups,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.subscription.count({ where: { isActive: true } }),
      this.prisma.business.count({ where: { createdAt: { gte: last30Days } } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.court.count({ where: { active: true } }),
      this.prisma.reservation.count({
        where: { createdAt: { gte: last30Days } },
      }),
      this.prisma.subscription.findMany({
        where: { isActive: true },
        select: { plan: { select: { monthlyPrice: true } } },
      }),
      this.prisma.plan.findMany({
        orderBy: { monthlyPrice: 'asc' },
        select: { name: true, _count: { select: { subscriptions: true } } },
      }),
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, count(*)::int AS count
        FROM "Business" WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, count(*)::int AS count
        FROM "User" WHERE "createdAt" >= ${since} AND role = 'JUGADOR' GROUP BY 1`,
    ]);

    const roleCount = (role: UserRole) =>
      usersByRole.find((r) => r.role === role)?._count._all ?? 0;
    const byMonth = (rows: { month: string; count: number }[]) =>
      new Map(rows.map((r) => [r.month, r.count]));
    const clientsByMonth = byMonth(clientSignups);
    const playersByMonth = byMonth(playerSignups);

    return {
      clients: {
        total: totalClients,
        active: activeClients,
        newLast30Days: newClients,
      },
      users: {
        total: usersByRole.reduce((sum, r) => sum + r._count._all, 0),
        superAdmins: roleCount(UserRole.SUPER_ADMIN),
        businessAdmins: roleCount(UserRole.ADMIN_NEGOCIO),
        players: roleCount(UserRole.JUGADOR),
      },
      activeCourts,
      reservationsLast30Days: recentReservations,
      monthlyRecurringRevenue: activeSubscriptions.reduce(
        (sum, s) => sum + s.plan.monthlyPrice,
        0,
      ),
      clientsByPlan: plans.map((p) => ({
        label: p.name,
        count: p._count.subscriptions,
      })),
      signupsByMonth: months.map((month): MonthlySignupsDto => ({
        month,
        clients: clientsByMonth.get(month) ?? 0,
        players: playersByMonth.get(month) ?? 0,
      })),
    };
  }
}

/** Los últimos `count` meses (YYYY-MM, UTC), del más antiguo al actual. */
export function lastMonths(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1),
    );
    return d.toISOString().slice(0, 7);
  });
}
