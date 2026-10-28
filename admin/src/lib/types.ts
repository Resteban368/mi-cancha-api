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

/** Ciudad de un negocio con su departamento (catálogo DANE). */
export interface CityRef {
  id: string;
  name: string;
  department: { id: string; name: string };
}

export interface Client {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  /** null en negocios anteriores que aún no la completan. */
  city: CityRef | null;
  createdAt: string;
  owner: { id: string; fullName: string; email: string | null; phone: string | null };
  plan: { id: string; name: string; monthlyPrice: number } | null;
  subscriptionActive: boolean;
  nextPayment: string | null;
  /** Fin de la prueba gratuita; null si el plan es de pago. */
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  activeCourts: number;
}

export type Sport = 'FUTBOL' | 'PADEL' | 'BALONCESTO' | 'VOLEIBOL';
export type ReservationStatus = 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export type PaymentConcept = 'ANTICIPO' | 'SALDO' | 'TOTAL' | 'VENTA';

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
  surface: { code: string; name: string } | null;
  lengthMeters: number | null;
  widthMeters: number | null;
  playersPerSide: number | null;
  schedules: CourtSchedule[];
  rates: CourtRate[];
  photos: { slot: CourtPhotoSlot; url: string }[];
}

export interface ClientDetail {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: CityRef | null;
  description: string | null;
  imageUrl: string | null;
  /** Fotos del negocio (hasta 5); la primera es la portada. */
  photos: { id: string; url: string }[];
  /** Link de reservas y si ya está activo. */
  bookingLink: {
    enabled: boolean;
    slug: string;
    url: string;
    bookingAvailable: boolean;
    unavailableReason: 'DISABLED' | 'PLAN_INACTIVE' | 'NO_COURTS' | null;
  };
  latitude: number | null;
  longitude: number | null;
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
    trialEndsAt: string | null;
    trialDaysLeft: number | null;
    trialExpired: boolean;
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
    cancellationReason: string | null;
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

export interface CourtSurface extends Amenity {
  /** Vacío = todos los deportes. */
  sports: Sport[];
}

export interface SystemEnum {
  name: string;
  description: string;
  values: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  documentId: string;
  preferredSport: Sport | null;
  notes: string | null;
  createdAt: string;
}

export type CustomerLevel = 'NEW' | 'RECURRENT' | 'FREQUENT' | 'VIP';
export type CustomerSegment = 'ALL' | 'LOYAL' | 'WITH_BALANCE' | 'NEW';
export type CustomerSort =
  | 'MOST_RESERVATIONS'
  | 'TOP_SPENDERS'
  | 'LAST_VISIT'
  | 'HIGHEST_BALANCE'
  | 'NAME'
  | 'NEWEST';

export interface CustomerMetrics {
  reservations: number;
  level: CustomerLevel;
  attendancePct: number | null;
  totalSpent: number;
  balance: number;
  lastVisit: { date: string; courtName: string } | null;
  favoriteSport: Sport | null;
}

export interface CustomerSummary extends Customer {
  metrics: CustomerMetrics;
}

export interface CustomersOverview {
  totalCustomers: number;
  newThisMonth: number;
  newVsLastMonthPct: number | null;
  loyalCustomers: number;
  loyalPct: number;
  totalReservations: number;
  pendingBalance: number;
  currency: string;
}

export interface CustomerPage extends Page<CustomerSummary> {
  overview: CustomersOverview;
}

export interface CustomerStats {
  totalReservations: number;
  confirmedReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  totalSpent: number;
  pendingPayments: number;
  totalRefunded: number;
}

export interface CustomerPaymentItem {
  id: string;
  amount: number;
  method: string;
  concept: PaymentConcept;
  status: PaymentStatus;
  reference: string | null;
  note: string | null;
  rejectionReason: string | null;
  registeredByBusiness: boolean;
  receivedAt: string;
  reservationId: string | null;
  courtName: string | null;
  reservationStart: string | null;
  reservationEnd: string | null;
  refund: {
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
    createdBy: string | null;
  } | null;
}

export interface CustomerRefundItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string | null;
}

export interface CustomerReservationItem {
  id: string;
  courtId: string;
  courtName: string;
  sport: Sport;
  currency: string;
  start: string;
  end: string;
  customerName: string;
  customerDetail: string | null;
  phone: string;
  contactNote: string | null;
  tag: string | null;
  isRecurring: boolean;
  subtotal: number;
  discount: number;
  totalPrice: number;
  status: ReservationStatus;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  createdAt: string;
  payments: CustomerPaymentItem[];
  refunds: CustomerRefundItem[];
}

export interface CustomerDetail {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  documentId: string;
  preferredSport: Sport | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: CustomerMetrics;
  stats: CustomerStats;
  reservations: CustomerReservationItem[];
  payments: CustomerPaymentItem[];
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  status: 'AVAILABLE' | 'BOOKED' | 'PAST';
  price: number;
}

export interface Availability {
  date: string;
  courtId: string;
  slotDuration: number;
  currency: string;
  maxSlots: number;
  slots: AvailabilitySlot[];
}

export interface SportAvailability {
  date: string;
  sport: Sport;
  maxSlots: number;
  courts: {
    court: {
      id: string;
      name: string;
      sport: Sport;
      isCovered: boolean;
      slotDuration: number;
      currency: string;
      photoUrl: string | null;
    };
    availableCount: number;
    slots: AvailabilitySlot[];
  }[];
}

export interface Refund {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
  createdBy: string | null;
  reservation: { id: string; courtName: string; start: string; end: string };
  payment: { id: string; method: string; methodName: string; concept: PaymentConcept; reference: string | null; receivedAt: string };
  customer: { id: string; name: string; phone: string; documentId: string } | null;
}

export interface Catalogs {
  amenities: { code: string; name: string }[];
  paymentMethods: { code: string; name: string; requiresReference: boolean }[];
  courtSurfaces: { code: string; name: string; sports: Sport[] }[];
}
