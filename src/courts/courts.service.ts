import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { courtPhotoUrl, publicApiUrl } from '../common/public-url.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CourtPhotoSlot, Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAYS, rateErrors, scheduleErrors } from './court-time.js';
import {
  CourtDto,
  CourtRateDto,
  CourtScheduleDto,
  CreateCourtDto,
  UpdateCourtDto,
} from './dto/court.dto.js';

/** Fotos sin las que la cancha no puede recibir reservas: solo la principal. */
export const REQUIRED_PHOTOS: CourtPhotoSlot[] = [CourtPhotoSlot.MAIN];
const PHOTO_ORDER = Object.values(CourtPhotoSlot);
const DEFAULT_CURRENCY = 'COP';
const DEFAULT_SLOT_DURATION = 60;

export const courtInclude = {
  schedules: true,
  rates: { orderBy: { sortOrder: 'asc' } },
  photos: { select: { id: true, slot: true } },
  surface: { select: { code: true, name: true } },
} satisfies Prisma.CourtInclude;

export type CourtWithDetails = Prisma.CourtGetPayload<{
  include: typeof courtInclude;
}>;

@Injectable()
export class CourtsService {
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly catalogs: CatalogsService,
    config: ConfigService,
  ) {
    this.publicApiUrl = publicApiUrl(config);
  }

  async findAll(ownerId: string): Promise<CourtDto[]> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.listForBusiness(businessId);
  }

  /** Canchas de un negocio por su id (también lo usa el super admin). */
  async listForBusiness(businessId: string): Promise<CourtDto[]> {
    const courts = await this.prisma.court.findMany({
      where: { businessId },
      include: courtInclude,
      orderBy: { name: 'asc' },
    });
    return courts.map((c) => this.toDto(c));
  }

  async findOne(ownerId: string, courtId: string): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.toDto(await this.findOwnedCourt(businessId, courtId));
  }

  async create(ownerId: string, dto: CreateCourtDto): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    assertValidTimes(dto.schedules, dto.rates);
    assertValidDimensions(dto.lengthMeters, dto.widthMeters);
    const isActive = dto.isActive ?? true;
    await this.assertPlanAllows(businessId, isActive);
    const surfaceId = dto.surface
      ? await this.catalogs.resolveCourtSurfaceId(dto.surface, dto.sport)
      : null;

    const court = await this.prisma.court.create({
      data: {
        businessId,
        name: dto.name,
        sport: dto.sport,
        isCovered: dto.isCovered,
        isActive,
        currency: dto.currency ?? DEFAULT_CURRENCY,
        basePricePerHour: dto.basePricePerHour,
        slotDuration: dto.slotDuration ?? DEFAULT_SLOT_DURATION,
        surfaceId,
        lengthMeters: dto.lengthMeters ?? null,
        widthMeters: dto.widthMeters ?? null,
        playersPerSide: dto.playersPerSide ?? null,
        schedules: { create: dto.schedules.map(scheduleData) },
        rates: { create: (dto.rates ?? []).map(rateData) },
      },
      include: courtInclude,
    });
    return this.toDto(court);
  }

  async update(
    ownerId: string,
    courtId: string,
    dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.updateForBusiness(businessId, courtId, dto);
  }

  /** Edita una cancha de un negocio por su id (también lo usa el super admin). */
  async updateForBusiness(
    businessId: string,
    courtId: string,
    dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    const court = await this.findOwnedCourt(businessId, courtId);
    assertValidTimes(dto.schedules, dto.rates);
    assertValidDimensions(
      dto.lengthMeters !== undefined ? dto.lengthMeters : court.lengthMeters,
      dto.widthMeters !== undefined ? dto.widthMeters : court.widthMeters,
    );
    if (dto.isActive && !court.isActive) {
      await this.assertPlanAllows(businessId, true);
    }

    const { schedules, rates, surface, ...fields } = dto;
    const surfaceId = await this.surfaceForUpdate(court, surface, dto.sport);
    const updated = await this.prisma.court.update({
      where: { id: court.id },
      data: {
        ...fields,
        ...(surfaceId !== undefined && { surfaceId }),
        ...(schedules && {
          schedules: { deleteMany: {}, create: schedules.map(scheduleData) },
        }),
        ...(rates && {
          rates: { deleteMany: {}, create: rates.map(rateData) },
        }),
      },
      include: courtInclude,
    });
    return this.toDto(updated);
  }

  /** Desactiva la cancha; se conserva para el historial de reservas. */
  async deactivate(ownerId: string, courtId: string): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const court = await this.findOwnedCourt(businessId, courtId);
    const updated = await this.prisma.court.update({
      where: { id: court.id },
      data: { isActive: false },
      include: courtInclude,
    });
    return this.toDto(updated);
  }

  /**
   * Superficie a guardar al editar; undefined = no cambia. Si solo cambia el
   * deporte, la superficie actual tiene que seguir aplicando al nuevo.
   */
  private async surfaceForUpdate(
    court: CourtWithDetails,
    surface: string | null | undefined,
    sport: Sport | undefined,
  ): Promise<string | null | undefined> {
    if (surface === null) return null;
    const code = surface ?? (sport ? court.surface?.code : undefined);
    if (!code) return undefined;
    return this.catalogs.resolveCourtSurfaceId(
      code,
      sport ?? court.sport,
      court.surfaceId,
    );
  }

  async findOwnedCourt(
    businessId: string,
    courtId: string,
  ): Promise<CourtWithDetails> {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, businessId },
      include: courtInclude,
    });
    if (!court) throw new NotFoundException('La cancha no existe');
    return court;
  }

  toDto(court: CourtWithDetails): CourtDto {
    const slots = new Set(court.photos.map((p) => p.slot));
    const missingPhotos = REQUIRED_PHOTOS.filter((s) => !slots.has(s));
    const isComplete = missingPhotos.length === 0;
    return {
      id: court.id,
      name: court.name,
      sport: court.sport,
      isCovered: court.isCovered,
      isActive: court.isActive,
      isComplete,
      isBookable: court.isActive && isComplete,
      missingPhotos,
      currency: court.currency,
      basePricePerHour: Number(court.basePricePerHour),
      slotDuration: court.slotDuration,
      surface: court.surface,
      lengthMeters: toMeters(court.lengthMeters),
      widthMeters: toMeters(court.widthMeters),
      playersPerSide: court.playersPerSide,
      schedules: [...court.schedules]
        .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek))
        .map((s) => ({
          dayOfWeek: s.dayOfWeek,
          isOpen: s.isOpen,
          openTime: s.openTime,
          closeTime: s.closeTime,
        })),
      rates: court.rates.map((r) => ({
        name: r.name,
        pricePerHour: Number(r.pricePerHour),
        days: r.days,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      photos: [...court.photos]
        .sort(
          (a, b) => PHOTO_ORDER.indexOf(a.slot) - PHOTO_ORDER.indexOf(b.slot),
        )
        .map((p) => ({
          slot: p.slot,
          url: courtPhotoUrl(this.publicApiUrl, p.id),
        })),
    };
  }

  /**
   * Las canchas activas no pueden superar el límite del plan. Con el límite
   * alcanzado se permite una sola cancha inactiva, para dejarla preparada.
   */
  private async assertPlanAllows(
    businessId: string,
    activating: boolean,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (activating && !subscription?.isActive) {
      throw planError(
        'PLAN_INACTIVE',
        'Necesitas un plan activo para habilitar canchas',
      );
    }
    const limit = subscription?.isActive ? subscription.plan.courtLimit : 0;
    const activeCourts = await this.prisma.court.count({
      where: { businessId, isActive: true },
    });
    if (activeCourts < limit) return;

    const planName = subscription?.plan.name ?? 'actual';
    if (activating) {
      throw planError(
        'PLAN_LIMIT_REACHED',
        `Tu plan ${planName} permite ${limit} cancha(s) activa(s)`,
      );
    }
    const inactiveCourts = await this.prisma.court.count({
      where: { businessId, isActive: false },
    });
    if (inactiveCourts > 0) {
      throw planError(
        'PLAN_LIMIT_REACHED',
        `Tu plan ${planName} ya no permite más canchas: activa o edita la cancha inactiva que tienes`,
      );
    }
  }
}

function planError(code: string, message: string): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code,
    message,
  });
}

function assertValidTimes(
  schedules: CourtScheduleDto[] | undefined,
  rates: CourtRateDto[] | undefined,
): void {
  const errors = [
    ...(schedules ? scheduleErrors(schedules) : []),
    ...(rates ? rateErrors(rates) : []),
  ];
  if (errors.length) throw new BadRequestException(errors);
}

/** Las medidas van las dos o ninguna. */
function assertValidDimensions(length: unknown, width: unknown): void {
  if ((length == null) !== (width == null)) {
    throw new BadRequestException([
      'lengthMeters y widthMeters van juntos: envía las dos medidas o ninguna',
    ]);
  }
}

function toMeters(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function scheduleData(s: CourtScheduleDto) {
  return {
    dayOfWeek: s.dayOfWeek,
    isOpen: s.isOpen,
    openTime: s.isOpen ? s.openTime : null,
    closeTime: s.isOpen ? s.closeTime : null,
  };
}

function rateData(r: CourtRateDto, index: number) {
  return { ...r, sortOrder: index };
}
