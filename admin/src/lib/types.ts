// Tipos de las respuestas de la API (/api/v1).

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_NEGOCIO' | 'JUGADOR';

export interface AuthUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Dashboard {
  clients: { total: number; active: number; newLast30Days: number };
  users: { total: number; superAdmins: number; businessAdmins: number; players: number };
  activeCourts: number;
  reservationsLast30Days: number;
  monthlyRecurringRevenue: number;
  clientsByPlan: { label: string; count: number }[];
  signupsByMonth: { month: string; clients: number; players: number }[];
}

export interface Client {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  createdAt: string;
  owner: { id: string; fullName: string; email: string | null; phone: string | null };
  plan: { id: string; name: string; monthlyPrice: number } | null;
  subscriptionActive: boolean;
  nextPayment: string | null;
  activeCourts: number;
}

export type Sport = 'FUTBOL' | 'PADEL' | 'BALONCESTO' | 'VOLEIBOL';
export type ReservationStatus = 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentConcept = 'ANTICIPO' | 'SALDO' | 'TOTAL';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type CourtPhotoSlot = 'MAIN' | 'SURFACE' | 'LIGHTING' | 'EXTRA_1' | 'EXTRA_2';

export interface CourtSchedule {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface CourtRate {
  name: string;
  pricePerHour: number;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
}

export interface Court {
  id: string;
  name: string;
  sport: Sport;
  isCovered: boolean;
  isActive: boolean;
  isComplete: boolean;
  isBookable: boolean;
  missingPhotos: CourtPhotoSlot[];
  currency: string;
  basePricePerHour: number;
  slotDuration: number;
  schedules: CourtSchedule[];
  rates: CourtRate[];
  photos: { slot: CourtPhotoSlot; url: string }[];
}

export interface ClientDetail {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  description: string | null;
  imageUrl: string | null;
  amenities: { code: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    verified: boolean;
    createdAt: string;
  };
  subscription: {
    plan: { id: string; name: string; monthlyPrice: number; courtLimit: number };
    since: string;
    nextPayment: string;
    isActive: boolean;
    autoBilling: boolean;
  } | null;
  courts: {
    id: string;
    name: string;
    sport: Sport;
    isCovered: boolean;
    currency: string;
    basePricePerHour: number;
    isActive: boolean;
    isComplete: boolean;
  }[];
  stats: {
    reservationsTotal: number;
    reservationsLast30Days: number;
    upcomingReservations: number;
    approvedRevenueLast30Days: number;
    pendingPayments: number;
  };
  recentReservations: {
    id: string;
    start: string;
    end: string;
    courtName: string;
    customerName: string;
    totalPrice: number;
    currency: string;
    status: ReservationStatus;
  }[];
  recentPayments: {
    id: string;
    receivedAt: string;
    customerName: string;
    amount: number;
    method: string;
    concept: PaymentConcept;
    status: PaymentStatus;
  }[];
}

export interface AdminUser {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  verified: boolean;
  createdAt: string;
  businessName: string | null;
  authProviders: string[];
}

export interface PlanBenefit {
  title: string;
  detail: string;
}

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  courtLimit: number;
  benefits: PlanBenefit[];
  subscriptions: number;
}

export interface Amenity {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount: number;
}

export interface PaymentMethod extends Amenity {
  requiresReference: boolean;
}

export interface SystemEnum {
  name: string;
  description: string;
  values: string[];
}
