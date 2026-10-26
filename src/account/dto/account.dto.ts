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
  /** false si está suspendido o si su prueba gratuita ya venció. */
  isActive: boolean;
  autoBilling: boolean;
  /** Fin de la prueba gratuita; null si el plan es de pago. */
  trialEndsAt: Date | null;
  /** Días que le quedan de prueba (0 si vence hoy); null si no está en prueba. */
  trialDaysLeft: number | null;
  /** La prueba ya venció: debe comprar un plan para seguir operando. */
  trialExpired: boolean;
}

export class BusinessAccountDto {
  admin: AdminProfileDto;
  /** null si el negocio aún no tiene plan. */
  subscription: SubscriptionDto | null;
}
