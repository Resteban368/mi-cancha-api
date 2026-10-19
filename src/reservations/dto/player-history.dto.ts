import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import { Sport } from '../../generated/prisma/enums.js';
import { ReservationDto } from './reservation.dto.js';

/** Filtro de estado del historial del jugador. */
export enum PlayerReservationFilter {
  ALL = 'ALL',
  /** Confirmadas que todavía no terminan. */
  UPCOMING = 'UPCOMING',
  /** Jugadas: marcadas como completadas o confirmadas que ya pasaron. */
  PLAYED = 'PLAYED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class PlayerReservationsQueryDto extends PageQueryDto {
  @ApiProperty({ enum: PlayerReservationFilter, required: false })
  @IsOptional()
  @IsEnum(PlayerReservationFilter)
  status?: PlayerReservationFilter;

  @ApiProperty({ enum: Sport, required: false })
  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  /** Slug de la sede. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,80}$/, { message: 'business no es un slug válido' })
  business?: string;
}

/** Una reserva del jugador con la sede donde la hizo. */
export class PlayerReservationDto extends ReservationDto {
  businessName: string;
  businessSlug: string;
}

export class PlayerReservationPageDto {
  @ApiProperty({ type: [PlayerReservationDto] })
  items: PlayerReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class PlayerStatsNextDto {
  start: Date;
  end: Date;
  businessName: string;
  businessSlug: string;
  courtName: string;
}

export class PlayerStatsSportDto {
  @ApiProperty({ enum: Sport })
  sport: Sport;
  played: number;
}

export class PlayerStatsBusinessDto {
  name: string;
  slug: string;
  played: number;
}

export class PlayerStatsMonthDto {
  /** YYYY-MM en hora de Colombia. */
  month: string;
  played: number;
}

/** Resumen del jugador: cuánto ha jugado. Cada reserva de varias canchas cuenta como un partido. */
export class PlayerStatsDto {
  /** Todas las reservas hechas (también canceladas). */
  total: number;
  /** Jugados: completados o confirmados cuya hora ya pasó. */
  played: number;
  upcoming: number;
  cancelled: number;
  noShow: number;
  /** Horas de juego de los partidos jugados. */
  hoursPlayed: number;
  /** Valor de los partidos jugados según las tarifas. */
  spent: number;
  currency: string;
  @ApiProperty({ enum: Sport, nullable: true })
  favoriteSport: Sport | null;
  @ApiProperty({ type: PlayerStatsBusinessDto, nullable: true })
  topBusiness: PlayerStatsBusinessDto | null;
  @ApiProperty({ type: [PlayerStatsSportDto] })
  bySport: PlayerStatsSportDto[];
  /** Partidos jugados en cada uno de los últimos 6 meses (del más antiguo al actual). */
  @ApiProperty({ type: [PlayerStatsMonthDto] })
  byMonth: PlayerStatsMonthDto[];
  @ApiProperty({ type: PlayerStatsNextDto, nullable: true })
  next: PlayerStatsNextDto | null;
}
