import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class BanUserDto {
  /** Por qué se bloquea; queda en la auditoría. @example Suplantación de identidad */
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;

  /** Cancela sus reservas futuras (con sus devoluciones). Por defecto no. */
  @IsOptional()
  @IsBoolean()
  cancelFutureReservations?: boolean;
}

export class BanPreviewDto {
  id: string;
  displayName: string;
  @ApiProperty({ enum: UserRole })
  role: UserRole;
  /** Negocio que administra (si es ADMIN_NEGOCIO). */
  businessName: string | null;
  bannedAt: Date | null;
  bannedReason: string | null;
  /**
   * Reservas confirmadas que todavía no pasan y se cancelarían: las del jugador o,
   * si es un negocio, todas las de su negocio.
   */
  futureReservations: number;
}

export class BanResultDto {
  id: string;
  bannedAt: Date;
  /** Reservas que se cancelaron al bloquear (0 si no se pidió cancelarlas). */
  cancelledReservations: number;
  /** Reservas que se quisieron cancelar y no se pudo; revisar a mano. */
  failedCancellations: number;
}
