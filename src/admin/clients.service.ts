import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Page, pageArgs, PageQueryDto } from '../common/dto/page.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ClientDto,
  CreateClientDto,
  UpdateSubscriptionDto,
} from './dto/admin.dto.js';

const BCRYPT_ROUNDS = 12;
const SUBSCRIPTION_PERIOD_DAYS = 30;

const clientInclude = {
  owner: { select: { id: true, displayName: true, email: true, phone: true } },
  subscription: {
    include: { plan: { select: { id: true, name: true, monthlyPrice: true } } },
  },
  _count: { select: { courts: { where: { active: true } } } },
} satisfies Prisma.BusinessInclude;

type ClientRecord = Prisma.BusinessGetPayload<{
  include: typeof clientInclude;
}>;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PageQueryDto): Promise<Page<ClientDto>> {
    const search = query.search?.trim();
    const where: Prisma.BusinessWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { neighborhood: { contains: search, mode: 'insensitive' } },
            {
              owner: { displayName: { contains: search, mode: 'insensitive' } },
            },
            { owner: { email: { contains: search, mode: 'insensitive' } } },
            { owner: { phone: { contains: search } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include: clientInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.business.count({ where }),
    ]);
    return {
      items: items.map(toClientDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Crea el usuario de negocio, su negocio y la suscripción al plan elegido. */
  async create(dto: CreateClientDto): Promise<ClientDto> {
    const email = dto.email.toLowerCase();
    const [existing, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (existing) throw new ConflictException('El email ya está registrado');
    if (!plan) throw new NotFoundException('El plan no existe');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const business = await this.prisma.business.create({
      data: {
        name: dto.businessName,
        address: dto.address,
        neighborhood: dto.neighborhood,
        owner: {
          create: {
            email,
            passwordHash,
            displayName: dto.fullName,
            phone: dto.phone,
            role: UserRole.ADMIN_NEGOCIO,
            verified: true,
          },
        },
        subscription: {
          create: {
            planId: plan.id,
            nextPayment: addDays(new Date(), SUBSCRIPTION_PERIOD_DAYS),
            autoBilling: plan.monthlyPrice > 0,
          },
        },
      },
      include: clientInclude,
    });
    return toClientDto(business);
  }

  /** Cambia el plan o activa/suspende la suscripción del cliente. */
  async updateSubscription(
    businessId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<ClientDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true },
    });
    if (!business) throw new NotFoundException('El cliente no existe');

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan) throw new NotFoundException('El plan no existe');
    }

    if (business.subscription) {
      await this.prisma.subscription.update({
        where: { businessId },
        data: { planId: dto.planId, isActive: dto.isActive },
      });
    } else {
      if (!dto.planId) {
        throw new ConflictException(
          'El cliente no tiene plan: indica planId para asignarle uno',
        );
      }
      await this.prisma.subscription.create({
        data: {
          businessId,
          planId: dto.planId,
          isActive: dto.isActive ?? true,
          nextPayment: addDays(new Date(), SUBSCRIPTION_PERIOD_DAYS),
        },
      });
    }

    const updated = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: clientInclude,
    });
    return toClientDto(updated);
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toClientDto(b: ClientRecord): ClientDto {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    neighborhood: b.neighborhood,
    createdAt: b.createdAt,
    owner: {
      id: b.owner.id,
      fullName: b.owner.displayName,
      email: b.owner.email,
      phone: b.owner.phone,
    },
    plan: b.subscription?.plan ?? null,
    subscriptionActive: b.subscription?.isActive ?? false,
    nextPayment: b.subscription?.nextPayment ?? null,
    activeCourts: b._count.courts,
  };
}
