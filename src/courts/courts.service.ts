import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { Court } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CourtDto, CreateCourtDto, UpdateCourtDto } from './dto/court.dto.js';

@Injectable()
export class CourtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findAll(ownerId: string): Promise<CourtDto[]> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const courts = await this.prisma.court.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
    return courts.map(toCourtDto);
  }

  async create(ownerId: string, dto: CreateCourtDto): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.assertCourtSlotAvailable(businessId);
    const court = await this.prisma.court.create({
      data: { ...dto, businessId },
    });
    return toCourtDto(court);
  }

  async update(
    ownerId: string,
    courtId: string,
    dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const court = await this.findOwnedCourt(businessId, courtId);
    if (dto.active && !court.active) {
      await this.assertCourtSlotAvailable(businessId);
    }
    const updated = await this.prisma.court.update({
      where: { id: court.id },
      data: dto,
    });
    return toCourtDto(updated);
  }

  /** Desactiva la cancha; se conserva para el historial de reservas. */
  async deactivate(ownerId: string, courtId: string): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const court = await this.findOwnedCourt(businessId, courtId);
    const updated = await this.prisma.court.update({
      where: { id: court.id },
      data: { active: false },
    });
    return toCourtDto(updated);
  }

  private async findOwnedCourt(businessId: string, courtId: string) {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, businessId },
    });
    if (!court) throw new NotFoundException('La cancha no existe');
    return court;
  }

  private async assertCourtSlotAvailable(businessId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (!subscription?.isActive) {
      throw new ForbiddenException(
        'Necesitas un plan activo para habilitar canchas',
      );
    }
    const activeCourts = await this.prisma.court.count({
      where: { businessId, active: true },
    });
    if (activeCourts >= subscription.plan.courtLimit) {
      throw new ForbiddenException(
        `Tu plan ${subscription.plan.name} permite ${subscription.plan.courtLimit} cancha(s) activa(s)`,
      );
    }
  }
}

function toCourtDto(court: Court): CourtDto {
  return {
    id: court.id,
    name: court.name,
    sport: court.sport,
    hourlyPrice: court.hourlyPrice,
    active: court.active,
  };
}
