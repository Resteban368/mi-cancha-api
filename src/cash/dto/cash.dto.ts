import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OpenCashDto {
  /** Efectivo con que se abre la caja. @example 50000 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  openingCash: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CloseCashDto {
  /** Efectivo contado al cerrar. @example 242500 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  countedCash: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CashSessionsQueryDto extends PageQueryDto {}

export class CashMethodDto {
  /** Código del método de pago. */
  code: string;
  name: string;
  count: number;
  amount: number;
}

export class CashSessionDto {
  id: string;
  openingCash: number;
  openingNote: string | null;
  openedAt: Date;
  openedByName: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  closingNote: string | null;
  /** Base + pagos aprobados en efectivo del turno (al cerrar o hasta ahora). */
  expectedCash: number;
  /** null mientras está abierta. */
  countedCash: number | null;
  /** countedCash - expectedCash; negativo = faltante. */
  difference: number | null;
  /** Pagos aprobados del turno por método (de mayor a menor). */
  @ApiProperty({ type: [CashMethodDto] })
  methods: CashMethodDto[];
  /** Suma de todos los métodos. */
  collected: number;
}

export class CashCurrentDto {
  /** Caja abierta con sus totales hasta ahora, o null. */
  @ApiProperty({ type: CashSessionDto, nullable: true })
  session: CashSessionDto | null;
  /** Último cierre (para sugerir la base de la próxima apertura). */
  @ApiProperty({ type: CashSessionDto, nullable: true })
  lastClosed: CashSessionDto | null;
}
