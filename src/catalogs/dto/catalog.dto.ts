import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Sport } from '../../generated/prisma/enums.js';

/** Códigos en MAYÚSCULAS_CON_GUION_BAJO; no se pueden cambiar una vez creados. */
export const CATALOG_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
const CODE_MESSAGE =
  'code debe estar en MAYÚSCULAS, sin espacios (letras, números y _), p. ej. PISCINA';

export class CreateAmenityDto {
  /** @example PISCINA */
  @Matches(CATALOG_CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;

  /** Nombre visible en la app. @example Piscina */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class UpdateAmenityDto extends PartialType(
  PickType(CreateAmenityDto, ['name', 'sortOrder'] as const),
) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePaymentMethodDto extends CreateAmenityDto {
  /** Si exige número de referencia o comprobante al registrar el pago. */
  @IsBoolean()
  requiresReference: boolean;
}

export class UpdatePaymentMethodDto extends UpdateAmenityDto {
  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;
}

export class CreateCourtSurfaceDto extends CreateAmenityDto {
  /** Deportes en los que se ofrece; vacío = todos. @example ["FUTBOL","PADEL"] */
  @ApiProperty({ enum: Sport, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(Sport, { each: true })
  sports: Sport[];
}

export class UpdateCourtSurfaceDto extends UpdateAmenityDto {
  @ApiProperty({ enum: Sport, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Sport, { each: true })
  sports?: Sport[];
}

export class AmenityDto {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export class PaymentMethodDto extends AmenityDto {
  requiresReference: boolean;
}

export class CourtSurfaceDto extends AmenityDto {
  /** Deportes en los que se ofrece; vacío = todos. */
  @ApiProperty({ enum: Sport, isArray: true })
  sports: Sport[];
}

export class AdminAmenityDto extends AmenityDto {
  /** Negocios que lo ofrecen. */
  usageCount: number;
}

export class AdminPaymentMethodDto extends PaymentMethodDto {
  /** Pagos registrados con este método. */
  usageCount: number;
}

export class AdminCourtSurfaceDto extends CourtSurfaceDto {
  /** Canchas con esta superficie. */
  usageCount: number;
}

export class CatalogsDto {
  amenities: AmenityDto[];
  paymentMethods: PaymentMethodDto[];
  courtSurfaces: CourtSurfaceDto[];
}
