export class AdminProfileDto {
  fullName: string;
  email: string | null;
  phone: string | null;
  roleLabel: string;
  verified: boolean;
}

export class PlanBenefitDto {
  title: string;
  detail: string;
}

export class SubscriptionDto {
  planName: string;
  /** Precio mensual en COP. */
  monthlyPrice: number;
  since: Date;
  nextPayment: Date;
  courtLimit: number;
  /** Canchas activas en este momento. */
  courtsInUse: number;
  benefits: PlanBenefitDto[];
  isActive: boolean;
  autoBilling: boolean;
}

export class BusinessAccountDto {
  admin: AdminProfileDto;
  /** null si el negocio aún no tiene plan. */
  subscription: SubscriptionDto | null;
}
