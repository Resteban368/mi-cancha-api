// Tipos de las respuestas de la API (/api/v1/public y /api/v1/player).

export type Sport = 'FUTBOL' | 'PADEL' | 'BALONCESTO' | 'VOLEIBOL';

export interface PublicBusiness {
  name: string;
  slug: string;
  address: string;
  neighborhood: string;
  description: string | null;
  amenities: { code: string; name: string }[];
  imageUrl: string | null;
  /** Fotos de la sede (hasta 5); la primera es la portada. */
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
  sports: Sport[];
  currency: string;
  rules: {
    minAdvanceMinutes: number;
    maxDaysAhead: number;
    maxReservationsPerDay: number;
    maxSlots: number;
    /** Minutos que dura un apartado si no se confirma. */
    holdMinutes: number;
    /** Canchas que se pueden reservar a la vez en la misma franja. */
    maxCourts?: number;
    paymentMethod: string;
  };
  courts: PublicCourt[];
  bookingAvailable: boolean;
  unavailableReason: 'DISABLED' | 'PLAN_INACTIVE' | 'NO_COURTS' | null;
}

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Cancha reservable con sus fotos, medidas, horario y tarifas. */
export interface PublicCourt {
  id: string;
  name: string;
  sport: Sport;
  isCovered: boolean;
  currency: string;
  basePricePerHour: number;
  slotDuration: number;
  surface: { code: string; name: string } | null;
  lengthMeters: number | null;
  widthMeters: number | null;
  playersPerSide: number | null;
  schedules: { dayOfWeek: DayOfWeek; isOpen: boolean; openTime: string | null; closeTime: string | null }[];
  rates: { name: string; pricePerHour: number; days: DayOfWeek[]; startTime: string; endTime: string }[];
  photos: { slot: 'MAIN' | 'SURFACE' | 'LIGHTING' | 'EXTRA_1' | 'EXTRA_2'; url: string }[];
}

export interface Slot {
  start: string;
  end: string;
  /** HELD = otro jugador lo apartó mientras confirma (o es el apartado propio). */
  status: 'AVAILABLE' | 'BOOKED' | 'PAST' | 'UNAVAILABLE' | 'HELD';
  price: number;
}

/** Turnos apartados por el jugador mientras confirma. */
export interface SlotHold {
  /** Canchas apartadas, todas en la misma franja. */
  courtIds: string[];
  start: string;
  end: string;
  slots: number;
  expiresAt: string;
}

/** Ciudad con sedes que reciben reservas (selector del directorio). */
export interface DirectoryCity {
  id: string;
  name: string;
  department: { id: string; name: string };
  businessCount: number;
}

/** Sede del directorio general (/reservar). */
export interface DirectoryBusiness {
  name: string;
  slug: string;
  address: string;
  neighborhood: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  sports: Sport[];
  courtCount: number;
  amenities: { code: string; name: string }[];
  fromPricePerHour: number | null;
  currency: string;
  /** Solo si se pidió "cerca de mí". */
  /** Ciudad y departamento; null en sedes que aún no la completan. */
  city: { id: string; name: string; department: { id: string; name: string } } | null;
  distanceKm: number | null;
}

export interface DirectoryPage {
  url: string;
  total: number;
  page: number;
  limit: number;
  businesses: DirectoryBusiness[];
}

export interface PublicAmenity {
  code: string;
  name: string;
}

/** Sede donde el jugador ya es cliente (desde su primera reserva en ella). */
export interface PlayerBusiness {
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  imageUrl: string | null;
  clientSince: string;
}

export interface CourtSlots {
  court: {
    id: string;
    name: string;
    sport: Sport;
    isCovered: boolean;
    slotDuration: number;
    currency: string;
    photoUrl: string | null;
    surfaceName: string | null;
    lengthMeters: number | null;
    widthMeters: number | null;
    playersPerSide: number | null;
  };
  availableCount: number;
  slots: Slot[];
}

export interface SportAvailability {
  date: string;
  sport: Sport;
  maxSlots: number;
  courts: CourtSlots[];
}

export interface Player {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  birthDate: string | null;
  favoriteSport: Sport | null;
  /** La cuenta la creó una sede con la cédula como clave: debe cambiarla al ingresar. */
  mustChangePassword?: boolean;
  /** Aún no aceptó la política de tratamiento de datos. */
  needsDataConsent?: boolean;
}

export interface PlayerSession {
  accessToken: string;
  player: Player;
}

export interface Reservation {
  id: string;
  courtName: string;
  customerName: string;
  sport: Sport;
  start: string;
  end: string;
  contactNote: string | null;
  totalPrice: number;
  currency: string;
  amountPaid: number;
  balance: number;
  status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  source: 'BUSINESS' | 'WEB';
  cancellationReason: string | null;
  /** Reserva de varias canchas a la vez: el total y el saldo son los del grupo. */
  group: {
    id: string;
    courts: { reservationId: string; courtId: string; courtName: string }[];
    totalPrice: number;
    amountPaid: number;
    balance: number;
  } | null;
}

/** Reserva del jugador en cualquiera de sus sedes. */
export interface PlayerReservation extends Reservation {
  businessName: string;
  businessSlug: string;
}

export interface PlayerReservationPage {
  items: PlayerReservation[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReservationFilter = 'ALL' | 'UPCOMING' | 'PLAYED' | 'CANCELLED' | 'NO_SHOW';

/** Mi resumen: cuánto he jugado. Una reserva de varias canchas cuenta como un partido. */
export interface PlayerStats {
  total: number;
  played: number;
  upcoming: number;
  cancelled: number;
  noShow: number;
  hoursPlayed: number;
  spent: number;
  currency: string;
  favoriteSport: Sport | null;
  topBusiness: { name: string; slug: string; played: number } | null;
  bySport: { sport: Sport; played: number }[];
  /** Últimos 6 meses (YYYY-MM), del más antiguo al actual. */
  byMonth: { month: string; played: number }[];
  next: { start: string; end: string; businessName: string; businessSlug: string; courtName: string } | null;
}

/** Cupón que ofrece una sede. */
export interface PublicCoupon {
  id: string;
  name: string;
  requiredReservations: number;
  rewardDescription: string;
  expiresAt: string | null;
}

/** Mi tarjeta en un cupón de una sede. */
export interface PlayerCoupon {
  couponId: string;
  businessName: string;
  businessSlug: string | null;
  name: string;
  rewardDescription: string;
  status: 'IN_PROGRESS' | 'EARNED';
  completed: number;
  required: number;
  remaining: number;
  expiresAt: string | null;
}
