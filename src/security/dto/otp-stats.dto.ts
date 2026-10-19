import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class OtpStatsQueryDto {
  /** Días hacia atrás para el gráfico y los rankings. @example 30 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class OtpTotalsDto {
  /** Desde las 00:00 de hoy (hora de Colombia). */
  today: number;
  last7Days: number;
  last30Days: number;
  /** Todos los códigos enviados desde siempre. */
  all: number;
}

export class OtpDailyDto {
  /** Día calendario en Colombia (YYYY-MM-DD). */
  date: string;
  count: number;
}

export class OtpTopUserDto {
  id: string;
  displayName: string;
  @ApiProperty({ enum: UserRole })
  role: UserRole;
}

export class OtpTopPhoneDto {
  /** Celular en formato E.164. */
  phone: string;
  /** Códigos enviados a este celular en el período. */
  requests: number;
  /** De esos, cuántos se usaron para verificar. */
  verified: number;
  lastRequestAt: Date;
  /** Cuenta con ese celular; null si nadie se registró con él. */
  @ApiProperty({ type: OtpTopUserDto, nullable: true })
  user: OtpTopUserDto | null;
}

export class OtpTopSourceDto {
  /** Primeros 8 caracteres del hash de la IP (la IP real no se guarda). */
  source: string;
  requests: number;
  /** Celulares distintos que pidieron códigos desde ese origen. */
  phones: number;
}

export class OtpStatsDto {
  /** Días del período usado en el gráfico y los rankings. */
  days: number;
  totals: OtpTotalsDto;
  /** Códigos enviados y verificados dentro del período. */
  period: { requests: number; verified: number };
  @ApiProperty({ type: [OtpDailyDto] })
  daily: OtpDailyDto[];
  @ApiProperty({ type: [OtpTopPhoneDto] })
  topPhones: OtpTopPhoneDto[];
  @ApiProperty({ type: [OtpTopSourceDto] })
  topSources: OtpTopSourceDto[];
}
