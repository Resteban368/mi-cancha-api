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
    paymentMethod: string;
  };
  bookingAvailable: boolean;
  unavailableReason: 'DISABLED' | 'PLAN_INACTIVE' | 'NO_COURTS' | null;
}

export interface Slot {
  start: string;
  end: string;
  status: 'AVAILABLE' | 'BOOKED' | 'PAST' | 'UNAVAILABLE';
  price: number;
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
}
