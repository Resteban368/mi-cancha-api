import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessesService } from '../businesses/businesses.service.js';
import { businessImageUrl, publicApiUrl } from '../common/public-url.js';
import { localDate } from '../courts/court-time.js';
import {
  courtInclude,
  CourtsService,
  REQUIRED_PHOTOS,
} from '../courts/courts.service.js';
import type { Prisma, SlotHold } from '../generated/prisma/client.js';
import type { Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MAX_GROUP_COURTS,
  ReservationDto,
  SportAvailabilityDto,
} from '../reservations/dto/reservation.dto.js';
import {
  ReservationsService,
  type WebBookingRules,
  type WebSlotsInput,
} from '../reservations/reservations.service.js';
import {
  CurrentHoldDto,
  OnlineBookingSettingsDto,
  PublicBusinessDto,
  PublicCourtDto,
  SlotHoldDto,
  UpdateOnlineBookingDto,
  WEB_HOLD_MINUTES,
  WEB_MAX_SLOTS,
  WebHoldDto,
  WebReservationDto,
} from './dto/online-booking.dto.js';
import { PlayerAuthService } from './player-auth.service.js';

/** Reglas de las reservas web (iguales para todos los negocios por ahora). */
export const WEB_RULES: WebBookingRules = {
  minAdvanceMinutes: 60,
  maxDaysAhead: 30,
  maxReservationsPerDay: 2,
  maxSlots: WEB_MAX_SLOTS,
  holdMinutes: WEB_HOLD_MINUTES,
};
const DAY_MS = 24 * 60 * 60 * 1000;

const businessInclude = {
  subscription: { select: { isActive: true } },
  profileImage: { select: { id: true } },
  amenities: {
    where: { active: true },
    select: { code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  },
  courts: {
    where: { isActive: true },
    select: { sport: true, currency: true, photos: { select: { slot: true } } },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.BusinessInclude;

type PublicBusiness = Prisma.BusinessGetPayload<{
  include: typeof businessInclude;
}>;

@Injectable()
export class OnlineBookingService {
  private readonly publicApiUrl: string;
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly players: PlayerAuthService,
    private readonly businesses: BusinessesService,
    private readonly courts: CourtsService,
    config: ConfigService,
  ) {
    this.publicApiUrl = publicApiUrl(config);
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  // ---------- Página pública ----------

  async publicBusiness(slug: string): Promise<PublicBusinessDto> {
    const business = await this.findBySlug(slug);
    const { available, reason } = bookingState(business);
    const courts = available ? await this.publicCourts(business.id) : [];
    const point =
      business.latitude !== null && business.longitude !== null
        ? `${business.latitude},${business.longitude}`
        : `${business.address}, ${business.neighborhood}`;
    return {
      name: business.name,
      slug: business.slug!,
      address: business.address,
      neighborhood: business.neighborhood,
      description: business.description,
      amenities: business.amenities,
      imageUrl: business.profileImage
        ? businessImageUrl(this.publicApiUrl, business.profileImage.id)
        : null,
      latitude: business.latitude,
      longitude: business.longitude,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`,
      sports: bookableSports(business),
      currency: business.courts[0]?.currency ?? 'COP',
      rules: {
        ...WEB_RULES,
        maxCourts: MAX_GROUP_COURTS,
        paymentMethod: 'EFECTIVO',
      },
      courts,
      bookingAvailable: available,
      unavailableReason: reason,
    };
  }

  /**
   * Turnos de un deporte para la web: los que empiezan antes de la anticipación
   * mínima se marcan UNAVAILABLE, y solo se consulta de hoy a 30 días.
   */
  async availability(
    slug: string,
    sport: Sport,
    date: string,
    now = new Date(),
  ): Promise<SportAvailabilityDto> {
    const business = await this.requireBookable(slug);
    const today = localDate(now, this.utcOffset);
    const last = localDate(
      new Date(now.getTime() + WEB_RULES.maxDaysAhead * DAY_MS),
      this.utcOffset,
    );
    if (date < today || date > last) {
      throw new BadRequestException(
        `Elige una fecha entre hoy y ${WEB_RULES.maxDaysAhead} días adelante`,
      );
    }

    const result = await this.reservations.sportAvailability(
      business.id,
      sport,
      date,
      now,
      { withHolds: true },
    );
    const earliest = now.getTime() + WEB_RULES.minAdvanceMinutes * 60_000;
    return {
      ...result,
      courts: result.courts.map((c) => {
        const slots = c.slots.map((s) =>
          s.status === 'AVAILABLE' && s.start.getTime() < earliest
            ? { ...s, status: 'UNAVAILABLE' as const }
            : s,
        );
        return {
          ...c,
          slots,
          availableCount: slots.filter((s) => s.status === 'AVAILABLE').length,
        };
      }),
    };
  }

  // ---------- Jugador ----------

  async book(
    slug: string,
    playerId: string,
    dto: WebReservationDto,
  ): Promise<ReservationDto> {
    const business = await this.requireBookable(slug);
    const player = await this.players.requirePlayer(playerId);
    return this.reservations.createWebReservation(
      business.id,
      player,
      { ...webSlots(dto), notes: dto.notes },
      WEB_RULES,
    );
  }

  /** Aparta los turnos mientras el jugador confirma (reemplaza el anterior). */
  async hold(
    slug: string,
    playerId: string,
    dto: WebHoldDto,
  ): Promise<SlotHoldDto> {
    const business = await this.requireBookable(slug);
    await this.players.requirePlayer(playerId);
    const rows = await this.reservations.holdWebSlots(
      business.id,
      playerId,
      webSlots(dto),
      WEB_RULES,
    );
    return toHoldDto(rows);
  }

  async currentHold(slug: string, playerId: string): Promise<CurrentHoldDto> {
    const business = await this.findBySlug(slug);
    const rows = await this.reservations.currentHold(business.id, playerId);
    return { hold: rows.length ? toHoldDto(rows) : null };
  }

  async releaseHold(slug: string, playerId: string): Promise<void> {
    const business = await this.findBySlug(slug);
    await this.reservations.releaseHold(business.id, playerId);
  }

  async myReservations(
    slug: string,
    playerId: string,
  ): Promise<ReservationDto[]> {
    const business = await this.findBySlug(slug);
    return this.reservations.listForPlayer(business.id, playerId);
  }

  // ---------- Configuración del negocio ----------

  async settings(ownerId: string): Promise<OnlineBookingSettingsDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.settingsFor(businessId);
  }

  /** Configuración del link de un negocio por su id (también la usa el super admin). */
  async settingsFor(businessId: string): Promise<OnlineBookingSettingsDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: businessInclude,
    });
    if (!business) throw new NotFoundException('El cliente no existe');
    return this.toSettings(business);
  }

  async updateSettings(
    ownerId: string,
    dto: UpdateOnlineBookingDto,
  ): Promise<OnlineBookingSettingsDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.updateSettingsFor(businessId, dto);
  }

  async updateSettingsFor(
    businessId: string,
    dto: UpdateOnlineBookingDto,
  ): Promise<OnlineBookingSettingsDto> {
    if (dto.slug) {
      const taken = await this.prisma.business.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });
      if (taken && taken.id !== businessId) {
        throw new ConflictException('Ese link ya lo usa otro negocio');
      }
    }
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { onlineBookingEnabled: dto.enabled, slug: dto.slug },
      include: businessInclude,
    });
    return this.toSettings(business);
  }

  private toSettings(business: PublicBusiness): OnlineBookingSettingsDto {
    const { available, reason } = bookingState(business);
    return {
      enabled: business.onlineBookingEnabled,
      slug: business.slug!,
      url: `${this.publicApiUrl}/reservar/${business.slug}`,
      bookingAvailable: available,
      unavailableReason: reason,
    };
  }

  /** Canchas que reciben reservas, con fotos, medidas, horario y tarifas. */
  private async publicCourts(businessId: string): Promise<PublicCourtDto[]> {
    const courts = await this.prisma.court.findMany({
      where: { businessId, isActive: true },
      include: courtInclude,
      orderBy: { name: 'asc' },
    });
    return courts
      .map((c) => this.courts.toDto(c))
      .filter((c) => c.isBookable)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sport: c.sport,
        isCovered: c.isCovered,
        currency: c.currency,
        basePricePerHour: c.basePricePerHour,
        slotDuration: c.slotDuration,
        surface: c.surface,
        lengthMeters: c.lengthMeters,
        widthMeters: c.widthMeters,
        playersPerSide: c.playersPerSide,
        schedules: c.schedules,
        rates: c.rates,
        photos: c.photos,
      }));
  }

  private async findBySlug(slug: string): Promise<PublicBusiness> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      include: businessInclude,
    });
    if (!business)
      throw new NotFoundException('Este link de reservas no existe');
    return business;
  }

  private async requireBookable(slug: string): Promise<PublicBusiness> {
    const business = await this.findBySlug(slug);
    const { available, reason } = bookingState(business);
    if (!available) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: reason,
        message:
          'Esta sede no está recibiendo reservas en línea en este momento',
      });
    }
    return business;
  }
}

function bookableSports(business: PublicBusiness): Sport[] {
  const sports = business.courts
    .filter((c) =>
      REQUIRED_PHOTOS.every((slot) => c.photos.some((p) => p.slot === slot)),
    )
    .map((c) => c.sport);
  return [...new Set(sports)];
}

function bookingState(business: PublicBusiness): {
  available: boolean;
  reason: string | null;
} {
  if (!business.onlineBookingEnabled) {
    return { available: false, reason: 'DISABLED' };
  }
  if (!business.subscription?.isActive) {
    return { available: false, reason: 'PLAN_INACTIVE' };
  }
  if (!bookableSports(business).length) {
    return { available: false, reason: 'NO_COURTS' };
  }
  return { available: true, reason: null };
}

/** Las filas del apartado (una por cancha) comparten franja y vencimiento. */
function toHoldDto(rows: SlotHold[]): SlotHoldDto {
  const [first] = rows;
  return {
    courtIds: rows.map((r) => r.courtId),
    start: first.start,
    end: first.end,
    slots: first.slots,
    expiresAt: first.expiresAt,
  };
}

/** `courtIds` o, por compatibilidad, `courtId`. */
function webSlots(dto: WebHoldDto): WebSlotsInput {
  const courtIds = dto.courtIds ?? (dto.courtId ? [dto.courtId] : []);
  if (!courtIds.length || (dto.courtIds && dto.courtId)) {
    throw new BadRequestException(
      'Envía courtIds (1 a 3 canchas) o courtId (una cancha), uno de los dos',
    );
  }
  return { courtIds, start: dto.start, slots: dto.slots };
}
