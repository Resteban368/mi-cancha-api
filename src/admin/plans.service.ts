import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Plan } from '../generated/prisma/client.js';
import {
  courtPriceTable,
  MAX_PRICED_COURTS,
  salesModuleListPrice,
} from '../common/plan-pricing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BillingSettingsDto,
  CreatePlanDto,
  PlanBenefitInputDto,
  PlanDto,
  UpdateBillingSettingsDto,
  UpdatePlanDto,
} from './dto/admin.dto.js';

type PlanWithCount = Plan & { _count: { subscriptions: number } };

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      orderBy: { monthlyPrice: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
    return plans.map(toPlanDto);
  }

  async create(dto: CreatePlanDto): Promise<PlanDto> {
    await this.assertNameFree(dto.name);
    const plan = await this.prisma.plan.create({
      data: { ...dto, benefits: toJson(dto.benefits) },
      include: { _count: { select: { subscriptions: true } } },
    });
    return toPlanDto(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanDto> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El plan no existe');
    if (dto.name && dto.name !== existing.name) {
      await this.assertNameFree(dto.name);
    }
    const { courtPrices, ...fields } = dto;
    if (courtPrices) {
      if (!existing.pricedByCourts) {
        throw new ConflictException(
          `El plan ${existing.name} no se contrata por cantidad de canchas`,
        );
      }
      assertPricesDoNotDrop(courtPrices);
    }
    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...fields,
        courtPrices,
        // En el plan por canchas, el precio «desde» y el límite siempre salen de la tabla.
        ...(existing.pricedByCourts && {
          monthlyPrice: (courtPrices ?? existing.courtPrices)[0],
          courtLimit: MAX_PRICED_COURTS,
        }),
        benefits: dto.benefits ? toJson(dto.benefits) : undefined,
      },
      include: { _count: { select: { subscriptions: true } } },
    });
    return toPlanDto(plan);
  }

  async remove(id: string): Promise<void> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException('El plan no existe');
    if (plan.pricedByCourts) {
      throw new ConflictException('El plan principal no se puede eliminar');
    }
    if (plan._count.subscriptions > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${plan._count.subscriptions} cliente(s) usan este plan`,
      );
    }
    await this.prisma.plan.delete({ where: { id } });
  }

  async billingSettings(): Promise<BillingSettingsDto> {
    const [salesModulePrice, salesModuleClients] = await Promise.all([
      salesModuleListPrice(this.prisma),
      this.prisma.business.count({ where: { salesModuleEnabled: true } }),
    ]);
    return { salesModulePrice, salesModuleClients };
  }

  async updateBillingSettings(
    dto: UpdateBillingSettingsDto,
  ): Promise<BillingSettingsDto> {
    await this.prisma.billingSettings.upsert({
      where: { id: 1 },
      create: { id: 1, salesModulePrice: dto.salesModulePrice },
      update: { salesModulePrice: dto.salesModulePrice },
    });
    return this.billingSettings();
  }

  private async assertNameFree(name: string): Promise<void> {
    const existing = await this.prisma.plan.findUnique({ where: { name } });
    if (existing) throw new ConflictException(`Ya existe el plan ${name}`);
  }
}

/** Más canchas nunca cuestan menos: una bajada en la tabla es casi siempre un error de digitación. */
function assertPricesDoNotDrop(courtPrices: number[]): void {
  const drop = courtPrices.findIndex((price, i) => price < courtPrices[i - 1]);
  if (drop !== -1) {
    throw new BadRequestException(
      `El precio de ${drop + 1} canchas no puede ser menor que el de ${drop}`,
    );
  }
}

function toJson(benefits: PlanBenefitInputDto[]) {
  return benefits.map(({ title, detail }) => ({ title, detail }));
}

function toPlanDto(plan: PlanWithCount): PlanDto {
  const benefits = Array.isArray(plan.benefits)
    ? (plan.benefits as unknown as PlanBenefitInputDto[])
    : [];
  return {
    id: plan.id,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    courtLimit: plan.courtLimit,
    pricedByCourts: plan.pricedByCourts,
    courtPrices: plan.pricedByCourts ? courtPriceTable(plan.courtPrices) : [],
    benefits,
    subscriptions: plan._count.subscriptions,
  };
}
