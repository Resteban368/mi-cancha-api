import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { citySelect, toCityRef } from '../catalogs/dto/location.dto.js';
import { bookingStateOf } from '../businesses/booking-link.js';
import {
  profileImagesSelect,
  toBusinessPhotos,
} from '../businesses/business-photos.js';
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
  DirectoryBusinessDto,
  DirectoryCityDto,
  DirectoryMapPointDto,
  DirectoryPageDto,
  DirectoryQueryDto,
  OnlineBookingSettingsDto,
  PlayerBusinessDto,
  PublicAmenityDto,
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
  city: citySelect,
  subscription: { select: { isActive: true } },
  profileImages: profileImagesSelect,
  amenities: {
    where: { active: true },
    select: { code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  },
  courts: {
    where: { isActive: true },
    select: {
      sport: true,
      currency: true,
      basePricePerHour: true,
      photos: { select: { slot: true } },
    },
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
    const photos = toBusinessPhotos(this.publicApiUrl, business.profileImages);
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
      imageUrl: photos[0]?.url ?? null,
      photos: photos.map((p) => p.url),
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

  // ---------- Directorio general (/reservar) ----------

  /**
   * Sedes que reciben reservas en línea. Sin lat y lng salen por nombre; con
   * ellas, por cercanía (las que no tienen punto van al final). Se pagina después de ordenar.
   */
  async directory(query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    if ((query.lat === undefined) !== (query.lng === undefined)) {
      throw new BadRequestException('Envía lat y lng juntos');
    }
    if (query.radiusKm !== undefined && query.lat === undefined) {
      throw new BadRequestException('radiusKm necesita lat y lng');
    }
    const origin =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : null;
    const page = query.page ?? 1;
    const limit = query.limit ?? DIRECTORY_PAGE_SIZE;

    // Solo id y punto: el detalle se pide únicamente para la página que se ve.
    const candidates = await this.prisma.business.findMany({
      where: directoryWhere(query),
      select: { id: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    });
    const ranked = candidates
      .map((b) => ({
        id: b.id,
        distance: origin ? distanceKm(origin, b) : null,
      }))
      .filter(
        (b) =>
          query.radiusKm === undefined ||
          (b.distance !== null && b.distance <= query.radiusKm),
      )
      .sort(byDistance);

    const pageItems = ranked.slice((page - 1) * limit, page * limit);
    const rows = await this.prisma.business.findMany({
      where: { id: { in: pageItems.map((r) => r.id) } },
      include: businessInclude,
    });
    const byId = new Map(rows.map((b) => [b.id, b]));
    return {
      url: `${this.publicApiUrl}/reservar`,
      total: ranked.length,
      page,
      limit,
      businesses: pageItems.flatMap(({ id, distance }) => {
        const business = byId.get(id);
        return business
          ? [toDirectoryBusiness(this.publicApiUrl, business, distance)]
          : [];
      }),
    };
  }

  /** Ciudades que ya tienen sedes reservables (no todo el catálogo de Colombia), con cuántas. */
  async directoryCities(): Promise<DirectoryCityDto[]> {
    const groups = await this.prisma.business.groupBy({
      by: ['cityId'],
      where: { ...directoryWhere({}), cityId: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map(groups.map((g) => [g.cityId!, g._count._all]));
    const cities = await this.prisma.city.findMany({
      where: { id: { in: [...counts.keys()] } },
      select: {
        id: true,
        name: true,
        department: { select: { id: true, name: true } },
      },
    });
    return cities
      .map((c) => ({ ...c, businessCount: counts.get(c.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /** Ubicación de todas las sedes que reciben reservas, para el mapa del directorio. */
  async directoryMap(): Promise<DirectoryMapPointDto[]> {
    const rows = await this.prisma.business.findMany({
      where: {
        ...directoryWhere({}),
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { name: true, slug: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((b) => ({
      name: b.name,
      slug: b.slug!,
      latitude: b.latitude!,
      longitude: b.longitude!,
    }));
  }

  /** Servicios activos para filtrar el directorio. */
  async publicAmenities(): Promise<PublicAmenityDto[]> {
    return this.prisma.amenity.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ---------- Jugador ----------

  /** Sedes donde el jugador ya es cliente (lo es desde su primera reserva en ella). */
  async myBusinesses(playerId: string): Promise<PlayerBusinessDto[]> {
    const rows = await this.prisma.customer.findMany({
      where: { userId: playerId, business: { slug: { not: null } } },
      select: {
        createdAt: true,
        business: {
          select: {
            name: true,
            slug: true,
            address: true,
            neighborhood: true,
            profileImages: { ...profileImagesSelect, take: 1 },
          },
        },
      },
      orderBy: { business: { name: 'asc' } },
    });
    return rows.map(({ createdAt, business }) => ({
      slug: business.slug!,
      name: business.name,
      address: business.address,
      neighborhood: business.neighborhood,
      imageUrl: business.profileImages[0]
        ? businessImageUrl(this.publicApiUrl, business.profileImages[0].id)
        : null,
      clientSince: createdAt,
    }));
  }

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
      if (RESERVED_SLUGS.includes(dto.slug)) {
        throw new BadRequestException(
          'Ese link está reservado para la web de reservas; elige otro',
        );
      }
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

/** Canchas con todas sus fotos obligatorias (las únicas que se reservan en línea). */
function bookableCourts(business: PublicBusiness) {
  return business.courts.filter((c) =>
    REQUIRED_PHOTOS.every((slot) => c.photos.some((p) => p.slot === slot)),
  );
}

function bookableSports(business: PublicBusiness): Sport[] {
  return [...new Set(bookableCourts(business).map((c) => c.sport))];
}

const DIRECTORY_PAGE_SIZE = 12;

/** Rutas fijas de la web de reservas: ningún negocio puede usarlas como link. */
export const RESERVED_SLUGS = [
  'ingresar',
  'registro',
  'recuperar',
  'perfil',
  'reservas',
  'bienvenida',
  'map',
  'mis-sedes',
  'politica-de-datos',
];

/** Sedes con reservas activas y al menos una cancha reservable, con los filtros pedidos. */
function directoryWhere(query: DirectoryQueryDto): Prisma.BusinessWhereInput {
  const q = query.q?.trim();
  const court: Prisma.CourtWhereInput = {
    isActive: true,
    AND: REQUIRED_PHOTOS.map((slot) => ({ photos: { some: { slot } } })),
    ...(query.sport ? { sport: query.sport } : {}),
  };
  return {
    onlineBookingEnabled: true,
    subscription: { is: { isActive: true } },
    courts: { some: court },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { neighborhood: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.cityId ? { cityId: query.cityId } : {}),
    ...(query.amenity
      ? { amenities: { some: { code: query.amenity, active: true } } }
      : {}),
  };
}

/** Distancia en km (fórmula de Haversine); null si la sede no tiene punto. */
function distanceKm(
  from: { lat: number; lng: number },
  to: { latitude: number | null; longitude: number | null },
): number | null {
  if (to.latitude === null || to.longitude === null) return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.latitude - from.lat);
  const dLng = rad(to.longitude - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Más cerca primero; sin punto al final. El orden por nombre se conserva en empates. */
function byDistance(
  a: { distance: number | null },
  b: { distance: number | null },
): number {
  if (a.distance === b.distance) return 0;
  if (a.distance === null) return 1;
  if (b.distance === null) return -1;
  return a.distance - b.distance;
}

function toDirectoryBusiness(
  origin: string,
  business: PublicBusiness,
  distance: number | null,
): DirectoryBusinessDto {
  const courts = bookableCourts(business);
  const prices = courts.map((c) => Number(c.basePricePerHour));
  return {
    name: business.name,
    slug: business.slug!,
    address: business.address,
    neighborhood: business.neighborhood,
    imageUrl: business.profileImages[0]
      ? businessImageUrl(origin, business.profileImages[0].id)
      : null,
    latitude: business.latitude,
    longitude: business.longitude,
    sports: bookableSports(business),
    courtCount: courts.length,
    amenities: business.amenities,
    fromPricePerHour: prices.length ? Math.min(...prices) : null,
    currency: courts[0]?.currency ?? 'COP',
    city: toCityRef(business.city ?? null),
    distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
  };
}

function bookingState(business: PublicBusiness) {
  return bookingStateOf(business);
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
