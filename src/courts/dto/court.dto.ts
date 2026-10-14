import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Sport } from '../../generated/prisma/enums.js';

export class CreateCourtDto {
  /** @example Sintética 1 */
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({ enum: Sport })
  @IsEnum(Sport)
  sport: Sport;

  /** Precio por hora en COP. @example 120000 */
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  hourlyPrice: number;
}

export class UpdateCourtDto extends PartialType(CreateCourtDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CourtDto {
  id: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  hourlyPrice: number;
  active: boolean;
}
