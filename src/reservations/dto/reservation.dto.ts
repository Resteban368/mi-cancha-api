import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ReservationStatus, Sport } from '../../generated/prisma/enums.js';

export class DayQueryDto {
  /** Día en la zona horaria del negocio. @example 2026-10-13 */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  date: string;
}

export class CreateReservationDto {
  @IsUUID()
  courtId: string;

  /** Inicio en ISO 8601. @example 2026-10-13T19:00:00-05:00 */
  @IsISO8601({ strict: true })
  start: string;

  /** Fin en ISO 8601. @example 2026-10-13T20:00:00-05:00 */
  @IsISO8601({ strict: true })
  end: string;

  /** @example Valentina Dussán */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  /** @example Equipo Los Halcones */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerDetail?: string;

  /** @example 3001234567 */
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactNote?: string;

  /** @example Torneo */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  /** Valor total en COP. Si se omite se calcula con el precio por hora de la cancha. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  totalPrice?: number;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}

export class ReservationDto {
  id: string;
  courtId: string;
  courtName: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  start: Date;
  end: Date;
  customerName: string;
  customerDetail: string | null;
  phone: string;
  contactNote: string | null;
  tag: string | null;
  isRecurring: boolean;
  /** Valor total en COP. */
  totalPrice: number;
  /** Suma de los pagos aprobados. */
  amountPaid: number;
  @ApiProperty({ enum: ReservationStatus })
  status: ReservationStatus;
}
