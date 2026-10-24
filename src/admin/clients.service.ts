import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { Page, pageArgs, PageQueryDto } from '../common/dto/page.dto.js';
import { publicApiUrl } from '../common/public-url.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import { toBookingLink } from '../businesses/booking-link.js';
import {
  profileImagesSelect,
  toBusinessPhotos,
} from '../businesses/business-photos.js';
import { REQUIRED_PHOTOS } from '../courts/courts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ClientDetailDto,
  ClientDto,
  CreateClientDto,
  UpdateClientDto,
  UpdateSubscriptionDto,
} from './dto/admin.dto.js';

const BCRYPT_ROUNDS = 12;
const SUBSCRIPTION_PERIOD_DAYS = 30;
const RECENT_ITEMS = 10;

const clientInclude = {
  owner: { select: { id: true, displayName: true, email: true, phone: true } },
  subscription: {
    include: { plan: { select: { id: true, name: true, monthlyPrice: true } } },
  },
  _count: { select: { courts: { where: { isActive: true } } } },
} satisfies Prisma.BusinessInclude;

type ClientRecord = Prisma.BusinessGetPayload<{
  include: typeof clientInclude;
}>;

const detailInclude = {
  owner: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      verified: true,
      createdAt: true,
    },
  },
  amenities: {
    select: { code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  },
  profileImages: profileImagesSelect,
  subscription: {
    include: {
      plan: {
        select: { id: true, name: true, monthlyPrice: true, courtLimit: true },
      },
    },
  },
  courts: {
    select: {
      id: true,
      name: true,
      sport: true,
      isCovered: true,
      currency: true,
      basePricePerHour: true,
      isActive: true,
      photos: { select: { slot: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  },
} satisfies Prisma.BusinessInclude;

@Injectable()
export class ClientsService {
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.publicApiUrl = publicApiUrl(config);
  }

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

  /** Ficha completa del cliente: negocio, responsable, plan, canchas y actividad. */
  async findOne(
    businessId: string,
    now = new Date(),
  ): Promise<ClientDetailDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: detailInclude,
    });
    if (!business) throw new NotFoundException('El cliente no existe');

    const last30Days = addDays(now, -30);
    const [
      reservationsTotal,
      reservationsLast30Days,
      upcomingReservations,
      approvedRevenue,
      pendingPayments,
      reservations,
      payments,
    ] = await Promise.all([
      this.prisma.reservation.count({ where: { businessId } }),
      this.prisma.reservation.count({
        where: { businessId, start: { gte: last30Days, lt: now } },
      }),
      this.prisma.reservation.count({
        where: {
          businessId,
          status: ReservationStatus.CONFIRMED,
          start: { gte: now },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.APPROVED,
          receivedAt: { gte: last30Days },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { businessId, status: PaymentStatus.PENDING },
      }),
      this.prisma.reservation.findMany({
        where: { businessId },
        orderBy: { start: 'desc' },
        take: RECENT_ITEMS,
        include: { court: { select: { name: true, currency: true } } },
      }),
      this.prisma.payment.findMany({
        where: { businessId },
        orderBy: { receivedAt: 'desc' },
        take: RECENT_ITEMS,
        include: { method: { select: { name: true } } },
      }),
    ]);

    const { owner, subscription } = business;
    const photos = toBusinessPhotos(this.publicApiUrl, business.profileImages);
    return {
      id: business.id,
      name: business.name,
      address: business.address,
      neighborhood: business.neighborhood,
      description: business.description,
      imageUrl: photos[0]?.url ?? null,
      photos,
      bookingLink: toBookingLink(this.publicApiUrl, {
        slug: business.slug,
        onlineBookingEnabled: business.onlineBookingEnabled,
        subscription: business.subscription,
        courts: business.courts.filter((c) => c.isActive),
      }),
      latitude: business.latitude,
      longitude: business.longitude,
      amenities: business.amenities,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      owner: {
        id: owner.id,
        fullName: owner.displayName,
        email: owner.email,
        phone: owner.phone,
        verified: owner.verified,
        createdAt: owner.createdAt,
      },
      subscription: subscription && {
        plan: subscription.plan,
        since: subscription.since,
        nextPayment: subscription.nextPayment,
        isActive: subscription.isActive,
        autoBilling: subscription.autoBilling,
      },
      courts: business.courts.map(({ photos, basePricePerHour, ...court }) => {
        const slots = new Set(photos.map((p) => p.slot));
        return {
          ...court,
          basePricePerHour: Number(basePricePerHour),
          isComplete: REQUIRED_PHOTOS.every((s) => slots.has(s)),
        };
      }),
      stats: {
        reservationsTotal,
        reservationsLast30Days,
        upcomingReservations,
        approvedRevenueLast30Days: Number(approvedRevenue._sum.amount ?? 0),
        pendingPayments,
      },
      recentReservations: reservations.map((r) => ({
        id: r.id,
        start: r.start,
        end: r.end,
        courtName: r.court.name,
        customerName: r.customerName,
        totalPrice: Number(r.totalPrice),
        currency: r.court.currency,
        status: r.status,
        cancellationReason: r.cancellationReason,
      })),
      recentPayments: payments.map((p) => ({
        id: p.id,
        receivedAt: p.receivedAt,
        customerName: p.customerName,
        amount: Number(p.amount),
        method: p.method.name,
        concept: p.concept,
        status: p.status,
      })),
    };
  }

  /** Lanza 404 si el cliente (negocio) no existe. */
  async requireClient(businessId: string): Promise<void> {
    const count = await this.prisma.business.count({
      where: { id: businessId },
    });
    if (!count) throw new NotFoundException('El cliente no existe');
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

  /** Actualiza datos del negocio, dirección y georreferenciación (lat/lng). */
  async update(
    businessId: string,
    dto: UpdateClientDto,
  ): Promise<ClientDetailDto> {
    await this.requireClient(businessId);
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if ((dto.latitude === null) !== (dto.longitude === null)) {
        throw new ConflictException(
          'Debes enviar latitud y longitud juntos, o ambos en null',
        );
      }
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.neighborhood !== undefined && {
          neighborhood: dto.neighborhood,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      },
    });

    return this.findOne(businessId);
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
