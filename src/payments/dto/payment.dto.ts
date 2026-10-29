import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
import { PaymentConcept, PaymentStatus } from '../../generated/prisma/enums.js';
import { CATALOG_CODE_PATTERN } from '../../catalogs/dto/catalog.dto.js';

export class PaymentsQueryDto {
  @ApiProperty({ enum: PaymentStatus, required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class CreatePaymentDto {
  /** @example Camilo Méndez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  /** Monto con hasta 2 decimales. @example 60000 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount: number;

  /** Código del catálogo de métodos de pago (GET /catalogs). @example NEQUI */
  @Matches(CATALOG_CODE_PATTERN, { message: 'method no es un código válido' })
  method: string;

  @ApiProperty({ enum: PaymentConcept })
  @IsEnum(PaymentConcept)
  concept: PaymentConcept;

  /** Obligatoria si el método la exige (p. ej. Nequi). @example M4829310 */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** Reserva a la que se abona el pago. */
  @IsOptional()
  @IsUUID()
  reservationId?: string;
}

export class RejectPaymentDto {
  /** @example El comprobante no coincide con el monto */
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class PaymentDto {
  id: string;
  customerName: string;
  amount: number;
  /** Código del método de pago. */
  method: string;
  @ApiProperty({ enum: PaymentConcept })
  concept: PaymentConcept;
  receivedAt: Date;
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;
  reservationId: string | null;
  courtName: string | null;
  reservationStart: Date | null;
  reference: string | null;
  note: string | null;
  rejectionReason: string | null;
  registeredByBusiness: boolean;
  /**
   * Parte del pago que fue para la cancha y parte para productos (consumos
   * o venta suelta). En una reserva, lo pagado cubre primero la cancha y
   * luego los consumos cargados al saldo. Suman `amount`.
   */
  courtAmount: number;
  productsAmount: number;
}
