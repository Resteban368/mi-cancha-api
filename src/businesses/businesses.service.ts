import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessDto, SaveBusinessDto } from './dto/business.dto.js';

const SUBSCRIPTION_PERIOD_DAYS = 30;

const businessInclude = {
  amenities: { select: { code: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.BusinessInclude;

type BusinessWithAmenities = Prisma.BusinessGetPayload<{
  include: typeof businessInclude;
}>;

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogs: CatalogsService,
  ) {}

  async findMine(ownerId: string): Promise<BusinessDto> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
      include: businessInclude,
    });
    if (!business) throw notCreatedYet();
    return toBusinessDto(business);
  }

  /**
   * Crea o actualiza el negocio del administrador. Al crearlo se le asigna el
   * plan gratuito (si existe) para que pueda registrar su primera cancha.
   */
  async save(ownerId: string, dto: SaveBusinessDto): Promise<BusinessDto> {
    const amenityIds = await this.catalogs.resolveAmenityIds(
      dto.amenities ?? [],
    );
    const data = {
      name: dto.name,
      address: dto.address,
      neighborhood: dto.neighborhood,
      description: dto.description ?? null,
    };
    const amenityRefs = amenityIds.map((id) => ({ id }));

    const business = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.business.findUnique({ where: { ownerId } });
      if (existing) {
        return tx.business.update({
          where: { ownerId },
          data: { ...data, amenities: { set: amenityRefs } },
          include: businessInclude,
        });
      }

      const created = await tx.business.create({
        data: { ...data, ownerId, amenities: { connect: amenityRefs } },
        include: businessInclude,
      });
      const freePlan = await tx.plan.findFirst({
        where: { monthlyPrice: 0 },
        orderBy: { courtLimit: 'desc' },
      });
      if (freePlan) {
        await tx.subscription.create({
          data: {
            businessId: created.id,
            planId: freePlan.id,
            nextPayment: addDays(new Date(), SUBSCRIPTION_PERIOD_DAYS),
            autoBilling: false,
          },
        });
      }
      return created;
    });

    return toBusinessDto(business);
  }

  /** Id del negocio del administrador; lanza 404 si aún no lo ha creado. */
  async requireBusinessId(ownerId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!business) throw notCreatedYet();
    return business.id;
  }
}

function notCreatedYet(): NotFoundException {
  return new NotFoundException('Aún no has registrado tu negocio');
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function toBusinessDto(business: BusinessWithAmenities): BusinessDto {
  return {
    id: business.id,
    name: business.name,
    address: business.address,
    neighborhood: business.neighborhood,
    description: business.description,
    amenities: business.amenities.map((a) => a.code),
  };
}
