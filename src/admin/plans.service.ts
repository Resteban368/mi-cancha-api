import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Plan } from '../generated/prisma/client.js';
import { courtPriceTable } from '../common/plan-pricing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePlanDto,
  PlanBenefitInputDto,
  PlanDto,
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
    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...dto,
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

  private async assertNameFree(name: string): Promise<void> {
    const existing = await this.prisma.plan.findUnique({ where: { name } });
    if (existing) throw new ConflictException(`Ya existe el plan ${name}`);
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
    courtPrices: plan.pricedByCourts ? courtPriceTable() : [],
    benefits,
    subscriptions: plan._count.subscriptions,
  };
}
