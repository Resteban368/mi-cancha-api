import { Injectable, NotFoundException } from '@nestjs/common';
import { isSubscriptionUsable, trialStatusOf } from '../common/trial.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BusinessAccountDto,
  PlanBenefitDto,
  SubscriptionDto,
} from './dto/account.dto.js';

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_NEGOCIO: 'Administrador del negocio',
  JUGADOR: 'Jugador',
};

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string): Promise<BusinessAccountDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        business: {
          include: {
            subscription: { include: { plan: true } },
            _count: { select: { courts: { where: { isActive: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('El usuario ya no existe');

    const subscription = user.business?.subscription;
    let subscriptionDto: SubscriptionDto | null = null;
    if (user.business && subscription) {
      const nextPlan = await this.prisma.plan.findFirst({
        where: { monthlyPrice: { gt: subscription.plan.monthlyPrice } },
        orderBy: [{ monthlyPrice: 'asc' }, { courtLimit: 'asc' }],
        select: { name: true },
      });
      subscriptionDto = {
        planName: subscription.plan.name,
        monthlyPrice: subscription.plan.monthlyPrice,
        since: subscription.since,
        nextPayment: subscription.nextPayment,
        courtLimit: subscription.plan.courtLimit,
        courtsInUse: user.business._count.courts,
        benefits: parseBenefits(subscription.plan.benefits),
        isActive: isSubscriptionUsable(subscription),
        autoBilling: subscription.autoBilling,
        ...trialStatusOf(subscription),
        nextPlanName: nextPlan?.name ?? null,
      };
    }

    return {
      admin: {
        fullName: user.displayName,
        email: user.email,
        phone: user.phone,
        roleLabel: ROLE_LABELS[user.role],
        verified: user.verified,
      },
      subscription: subscriptionDto,
    };
  }
}

/** Los beneficios se guardan como JSON; se descartan entradas mal formadas. */
function parseBenefits(value: unknown): PlanBenefitDto[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PlanBenefitDto =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as PlanBenefitDto).title === 'string' &&
      typeof (item as PlanBenefitDto).detail === 'string',
  );
}
