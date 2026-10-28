import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { publicApiUrl } from '../common/public-url.js';
import { createTrialSubscription } from '../common/trial.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  citySelect,
  requireCity,
  toCityRef,
} from '../catalogs/dto/location.dto.js';
import { toBookingLink } from './booking-link.js';
import { profileImagesSelect, toBusinessPhotos } from './business-photos.js';
import { BusinessDto, SaveBusinessDto } from './dto/business.dto.js';

const businessInclude = {
  amenities: { select: { code: true }, orderBy: { sortOrder: 'asc' } },
  profileImages: profileImagesSelect,
  subscription: { select: { isActive: true, trialEndsAt: true } },
  city: citySelect,
  courts: {
    where: { isActive: true },
    select: { photos: { select: { slot: true } } },
  },
} satisfies Prisma.BusinessInclude;

type BusinessWithAmenities = Prisma.BusinessGetPayload<{
  include: typeof businessInclude;
}>;

@Injectable()
export class BusinessesService {
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogs: CatalogsService,
    config: ConfigService,
  ) {
    this.publicApiUrl = publicApiUrl(config);
  }

  async findMine(ownerId: string): Promise<BusinessDto> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
      include: businessInclude,
    });
    if (!business) throw notCreatedYet();
    return this.toDto(business);
  }

  /**
   * Crea o actualiza el negocio del administrador. Al crearlo se le asigna el
   * plan gratuito (si existe) para que pueda registrar su primera cancha.
   */
  async save(ownerId: string, dto: SaveBusinessDto): Promise<BusinessDto> {
    if ((dto.latitude == null) !== (dto.longitude == null)) {
      throw new BadRequestException(
        'Envía latitude y longitude juntas, o ninguna de las dos',
      );
    }
    if (dto.cityId) await requireCity(this.prisma, dto.cityId);
    const amenityIds = await this.catalogs.resolveAmenityIds(
      dto.amenities ?? [],
    );
    const data = {
      name: dto.name,
      address: dto.address,
      neighborhood: dto.neighborhood,
      description: dto.description ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    };
    const amenityRefs = amenityIds.map((id) => ({ id }));

    const business = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.business.findUnique({ where: { ownerId } });
      if (existing) {
        return tx.business.update({
          where: { ownerId },
          // Sin cityId se conserva la ciudad actual (los negocios anteriores pueden no tenerla).
          data: {
            ...data,
            ...(dto.cityId && { cityId: dto.cityId }),
            amenities: { set: amenityRefs },
          },
          include: businessInclude,
        });
      }

      if (!dto.cityId) {
        throw new BadRequestException(
          'Elige el departamento y la ciudad del negocio',
        );
      }
      const created = await tx.business.create({
        data: {
          ...data,
          cityId: dto.cityId,
          ownerId,
          amenities: { connect: amenityRefs },
        },
        include: businessInclude,
      });
      await createTrialSubscription(tx, created.id);
      return created;
    });

    return this.toDto(business);
  }

  /**
   * Id del negocio si tiene activo el módulo de Ventas; si no, 403 con
   * `code: MODULE_DISABLED` (lo activa el super admin).
   */
  async requireSalesModule(ownerId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
      select: { id: true, salesModuleEnabled: true },
    });
    if (!business) throw notCreatedYet();
    if (!business.salesModuleEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'MODULE_DISABLED',
        message:
          'El módulo de Ventas e inventario no está activo para tu negocio. Pídelo a Mi Cancha.',
      });
    }
    return business.id;
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

  private toDto(business: BusinessWithAmenities): BusinessDto {
    const photos = toBusinessPhotos(this.publicApiUrl, business.profileImages);
    return {
      id: business.id,
      name: business.name,
      address: business.address,
      neighborhood: business.neighborhood,
      description: business.description,
      amenities: business.amenities.map((a) => a.code),
      imageUrl: photos[0]?.url ?? null,
      photos,
      city: toCityRef(business.city),
      bookingLink: toBookingLink(this.publicApiUrl, business),
      latitude: business.latitude,
      longitude: business.longitude,
    };
  }
}

function notCreatedYet(): NotFoundException {
  return new NotFoundException('Aún no has registrado tu negocio');
}
