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
