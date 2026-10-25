import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Amenity,
  CourtSurface,
  PaymentMethod,
} from '../generated/prisma/client.js';
import type { Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CityDto, DepartmentDto } from './dto/location.dto.js';
import {
  AdminAmenityDto,
  AdminCourtSurfaceDto,
  AdminPaymentMethodDto,
  AmenityDto,
  CatalogsDto,
  CourtSurfaceDto,
  CreateAmenityDto,
  CreateCourtSurfaceDto,
  CreatePaymentMethodDto,
  PaymentMethodDto,
  UpdateAmenityDto,
  UpdateCourtSurfaceDto,
  UpdatePaymentMethodDto,
} from './dto/catalog.dto.js';

const catalogOrder = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Departamentos de Colombia (DANE) en orden alfabético. */
  async departments(): Promise<DepartmentDto[]> {
    return this.prisma.department.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Ciudades (municipios) de un departamento en orden alfabético. */
  async cities(departmentId: string): Promise<CityDto[]> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('El departamento no existe');
    return this.prisma.city.findMany({
      where: { departmentId },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Catálogos activos, para la app. */
  async findActive(): Promise<CatalogsDto> {
    const [amenities, paymentMethods, courtSurfaces] = await Promise.all([
      this.prisma.amenity.findMany({
        where: { active: true },
        orderBy: catalogOrder,
      }),
      this.prisma.paymentMethod.findMany({
        where: { active: true },
        orderBy: catalogOrder,
      }),
      this.prisma.courtSurface.findMany({
        where: { active: true },
        orderBy: catalogOrder,
      }),
    ]);
    return {
      amenities: amenities.map(toAmenityDto),
      paymentMethods: paymentMethods.map(toPaymentMethodDto),
      courtSurfaces: courtSurfaces.map(toCourtSurfaceDto),
    };
  }

  /**
   * Convierte códigos de servicios en ids; rechaza códigos inexistentes o
   * desactivados para que un negocio no pueda guardar valores fuera del catálogo.
   */
  async resolveAmenityIds(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const amenities = await this.prisma.amenity.findMany({
      where: { code: { in: codes }, active: true },
      select: { id: true, code: true },
    });
    const found = new Set(amenities.map((a) => a.code));
    const invalid = codes.filter((code) => !found.has(code));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Servicios no válidos: ${invalid.join(', ')}`,
      );
    }
    return amenities.map((a) => a.id);
  }

  async resolvePaymentMethod(code: string): Promise<PaymentMethod> {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { code },
    });
    if (!method?.active) {
      throw new BadRequestException(`Método de pago no válido: ${code}`);
    }
    return method;
  }

  /**
   * Convierte el código de una superficie en su id. Debe existir, aplicar al
   * deporte y estar activa; [currentId] es la que ya tiene la cancha, que se
   * puede conservar aunque se haya desactivado después.
   */
  async resolveCourtSurfaceId(
    code: string,
    sport: Sport,
    currentId?: string | null,
  ): Promise<string> {
    const surface = await this.prisma.courtSurface.findUnique({
      where: { code },
    });
    if (!surface || (!surface.active && surface.id !== currentId)) {
      throw new BadRequestException(`Superficie no válida: ${code}`);
    }
    if (surface.sports.length > 0 && !surface.sports.includes(sport)) {
      throw new BadRequestException(
        `La superficie ${surface.name} no aplica a este deporte`,
      );
    }
    return surface.id;
  }

  // --- Administración (SUPER_ADMIN) ---

  async findAllAmenities(): Promise<AdminAmenityDto[]> {
    const amenities = await this.prisma.amenity.findMany({
      orderBy: catalogOrder,
      include: { _count: { select: { businesses: true } } },
    });
    return amenities.map((a) => ({
      ...toAmenityDto(a),
      usageCount: a._count.businesses,
    }));
  }

  async createAmenity(dto: CreateAmenityDto): Promise<AmenityDto> {
    await this.assertCodeFree('amenity', dto.code);
    const last = await this.prisma.amenity.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const amenity = await this.prisma.amenity.create({
      data: { ...dto, sortOrder: dto.sortOrder ?? (last?.sortOrder ?? 0) + 1 },
    });
    return toAmenityDto(amenity);
  }

  async updateAmenity(id: string, dto: UpdateAmenityDto): Promise<AmenityDto> {
    const exists = await this.prisma.amenity.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('El servicio no existe');
    const amenity = await this.prisma.amenity.update({
      where: { id },
      data: dto,
    });
    return toAmenityDto(amenity);
  }

  async findAllPaymentMethods(): Promise<AdminPaymentMethodDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      orderBy: catalogOrder,
      include: { _count: { select: { payments: true } } },
    });
    return methods.map((m) => ({
      ...toPaymentMethodDto(m),
      usageCount: m._count.payments,
    }));
  }

  async createPaymentMethod(
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    await this.assertCodeFree('paymentMethod', dto.code);
    const last = await this.prisma.paymentMethod.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const method = await this.prisma.paymentMethod.create({
      data: { ...dto, sortOrder: dto.sortOrder ?? (last?.sortOrder ?? 0) + 1 },
    });
    return toPaymentMethodDto(method);
  }

  async updatePaymentMethod(
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    const exists = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('El método de pago no existe');
    const method = await this.prisma.paymentMethod.update({
      where: { id },
      data: dto,
    });
    return toPaymentMethodDto(method);
  }

  async findAllCourtSurfaces(): Promise<AdminCourtSurfaceDto[]> {
    const surfaces = await this.prisma.courtSurface.findMany({
      orderBy: catalogOrder,
      include: { _count: { select: { courts: true } } },
    });
    return surfaces.map((s) => ({
      ...toCourtSurfaceDto(s),
      usageCount: s._count.courts,
    }));
  }

  async createCourtSurface(
    dto: CreateCourtSurfaceDto,
  ): Promise<CourtSurfaceDto> {
    await this.assertCodeFree('courtSurface', dto.code);
    const last = await this.prisma.courtSurface.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const surface = await this.prisma.courtSurface.create({
      data: { ...dto, sortOrder: dto.sortOrder ?? (last?.sortOrder ?? 0) + 1 },
    });
    return toCourtSurfaceDto(surface);
  }

  /** Quitar un deporte no cambia las canchas que ya usan la superficie. */
  async updateCourtSurface(
    id: string,
    dto: UpdateCourtSurfaceDto,
  ): Promise<CourtSurfaceDto> {
    const exists = await this.prisma.courtSurface.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('La superficie no existe');
    const surface = await this.prisma.courtSurface.update({
      where: { id },
      data: dto,
    });
    return toCourtSurfaceDto(surface);
  }

  private async assertCodeFree(
    catalog: 'amenity' | 'paymentMethod' | 'courtSurface',
    code: string,
  ): Promise<void> {
    const existing =
      catalog === 'amenity'
        ? await this.prisma.amenity.findUnique({ where: { code } })
        : catalog === 'paymentMethod'
          ? await this.prisma.paymentMethod.findUnique({ where: { code } })
          : await this.prisma.courtSurface.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Ya existe un valor con el código ${code}`);
    }
  }
}

function toAmenityDto(a: Amenity): AmenityDto {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    active: a.active,
    sortOrder: a.sortOrder,
  };
}

function toPaymentMethodDto(m: PaymentMethod): PaymentMethodDto {
  return { ...toAmenityDto(m), requiresReference: m.requiresReference };
}

function toCourtSurfaceDto(s: CourtSurface): CourtSurfaceDto {
  return { ...toAmenityDto(s), sports: s.sports };
}
