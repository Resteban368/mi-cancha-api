import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import {
  CouponCardStatus,
  CouponRewardType,
} from '../../generated/prisma/enums.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCouponDto {
  /** @example Cliente frecuente */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /** Reservas jugadas y pagadas para ganar el bono. @example 10 */
  @IsInt()
  @Min(1)
  @Max(100)
  requiredReservations: number;

  @ApiProperty({ enum: CouponRewardType })
  @IsEnum(CouponRewardType)
  rewardType: CouponRewardType;

  /** Obligatorio si el premio es PERCENT. @example 20 */
  @ValidateIf((dto: CreateCouponDto) => dto.rewardType === 'PERCENT')
  @IsInt()
  @Min(1)
  @Max(100)
  percent?: number;

  /** @example Una hora gratis en cualquier cancha */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  rewardDescription: string;

  /** Último día válido (AAAA-MM-DD); null o sin valor, no vence. @example 2026-12-31 */
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'expiresOn debe tener el formato AAAA-MM-DD' })
  expiresOn?: string | null;

  /** Tope de bonos a redimir entre todos los clientes; null o sin valor, ilimitado. @example 50 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxRedemptions?: number | null;
}

/** El premio y las reservas no cambian: afectarían tarjetas ya empezadas. */
export class UpdateCouponDto extends PartialType(
  OmitType(CreateCouponDto, [
    'requiredReservations',
    'rewardType',
    'percent',
  ] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** ACTIVE suma y se redime; los demás no suman. INACTIVE aún redime lo ya ganado. */
export const COUPON_STATES = [
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
  'EXHAUSTED',
] as const;
export type CouponState = (typeof COUPON_STATES)[number];

export class CouponDto {
  id: string;
  name: string;
  requiredReservations: number;
  @ApiProperty({ enum: CouponRewardType })
  rewardType: CouponRewardType;
  percent: number | null;
  rewardDescription: string;
  /** null si no tiene imagen. */
  imageUrl: string | null;
  expiresAt: Date | null;
  /** null = ilimitado. */
  maxRedemptions: number | null;
  redeemedCount: number;
  @ApiProperty({ enum: COUPON_STATES })
  state: CouponState;
  isActive: boolean;
  createdAt: Date;
}

export class CouponStampDto {
  reservationId: string | null;
  /** Cuándo se jugó la reserva. */
  playedAt: Date;
  /** Cuándo se llenó esta casilla de la tarjeta. */
  stampedAt: Date;
  /** Canchas de esa reserva: ayuda a decidir qué regalar. */
  courts: number;
  courtNames: string[];
  amount: number;
}

export class CustomerCouponDto {
  coupon: CouponDto;
  /** null si el cliente aún no tiene reservas en este cupón. */
  cardId: string | null;
  @ApiProperty({ enum: CouponCardStatus })
  status: CouponCardStatus;
  completed: number;
  required: number;
  earnedAt: Date | null;
  stamps: CouponStampDto[];
}

export class CouponCardsQueryDto extends PageQueryDto {
  /** Sin valor, todas las tarjetas del cupón. */
  @IsOptional()
  @IsIn(Object.values(CouponCardStatus))
  status?: CouponCardStatus;
}

/** Tarjeta de un cliente con todo su historial. */
export class CouponCardDto {
  id: string;
  customer: { id: string; name: string; phone: string };
  @ApiProperty({ enum: CouponCardStatus })
  status: CouponCardStatus;
  completed: number;
  required: number;
  /** Cuándo se llenó la tarjeta. */
  earnedAt: Date | null;
  redeemedAt: Date | null;
  redeemedCourts: number | null;
  redeemedAmount: number | null;
  stamps: CouponStampDto[];
}

export class CouponCardPageDto {
  items: CouponCardDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class RedeemCouponDto {
  @IsUUID()
  cardId: string;

  /** Canchas a regalar, solo en cancha gratis; sin valor, todas las de la reserva. @example 2 */
  @IsOptional()
  @IsInt()
  @Min(1)
  courts?: number;
}

export class CouponRedemptionDto {
  cardId: string;
  /** Lo descontado de la reserva. */
  amount: number;
  /** Canchas regaladas; null si el premio es un porcentaje. */
  courts: number | null;
  /** Lo que queda por pagar de la reserva. */
  balance: number;
}

/** Lo que cualquiera ve de un cupón abierto en la página del negocio. */
export class PublicCouponDto {
  id: string;
  name: string;
  requiredReservations: number;
  rewardDescription: string;
  imageUrl: string | null;
  expiresAt: Date | null;
}

export class PlayerCouponDto {
  couponId: string;
  businessName: string;
  businessSlug: string | null;
  name: string;
  rewardDescription: string;
  imageUrl: string | null;
  @ApiProperty({ enum: CouponCardStatus })
  status: CouponCardStatus;
  completed: number;
  required: number;
  /** Reservas que faltan para ganar el bono; 0 si ya lo tiene. */
  remaining: number;
  expiresAt: Date | null;
  /** Sellos de la tarjeta, del primero al último. */
  stamps: { playedAt: Date }[];
}

export class PlayerCouponSummaryDto {
  /** Bonos que el jugador ya usó, en todas las sedes. */
  redeemed: number;
}
