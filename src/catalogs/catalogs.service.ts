import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Amenity, PaymentMethod } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminAmenityDto,
  AdminPaymentMethodDto,
  AmenityDto,
  CatalogsDto,
  CreateAmenityDto,
  CreatePaymentMethodDto,
  PaymentMethodDto,
  UpdateAmenityDto,
  UpdatePaymentMethodDto,
} from './dto/catalog.dto.js';

const catalogOrder = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogos activos, para la app. */
  async findActive(): Promise<CatalogsDto> {
    const [amenities, paymentMethods] = await Promise.all([
      this.prisma.amenity.findMany({
        where: { active: true },
        orderBy: catalogOrder,
      }),
      this.prisma.paymentMethod.findMany({
        where: { active: true },
        orderBy: catalogOrder,
      }),
    ]);
    return {
      amenities: amenities.map(toAmenityDto),
      paymentMethods: paymentMethods.map(toPaymentMethodDto),
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

  private async assertCodeFree(
    catalog: 'amenity' | 'paymentMethod',
    code: string,
  ): Promise<void> {
    const existing =
      catalog === 'amenity'
        ? await this.prisma.amenity.findUnique({ where: { code } })
        : await this.prisma.paymentMethod.findUnique({ where: { code } });
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
