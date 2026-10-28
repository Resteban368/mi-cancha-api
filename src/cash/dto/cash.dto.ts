import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATALOG_CODE_PATTERN } from '../../catalogs/dto/catalog.dto.js';
import { CashMovementType } from '../../generated/prisma/enums.js';
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

// ---------- Proveedores ----------

export class SuppliersQueryDto {
  /** true = también los desactivados (para administrarlos). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateSupplierDto {
  /** @example Distribuidora Postobón */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /** NIT o cédula. @example 900123456-7 */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  documentId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  documentId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SupplierDto {
  id: string;
  name: string;
  documentId: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}

// ---------- Pagos a proveedores ----------

export class CreateCashExpenseDto {
  @IsUUID()
  supplierId: string;

  /** @example 120000 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount: number;

  /** Código del catálogo de métodos de pago. Si es EFECTIVO sale de la caja. @example EFECTIVO */
  @Matches(CATALOG_CODE_PATTERN, { message: 'method no es un código válido' })
  method: string;

  /** Qué se pagó. @example Pedido de bebidas */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  concept: string;
}

export class VoidCashExpenseDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class CreateCashMovementDto {
  /** INGRESO = se agrega efectivo; RETIRO = se saca efectivo. */
  @ApiProperty({ enum: CashMovementType })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  /** @example 50000 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount: number;

  /** @example Consignación Bancolombia */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason: string;
}

export class CashMovementDto {
  id: string;
  @ApiProperty({ enum: CashMovementType })
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: Date;
  createdByName: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
}

export class CashExpenseDto {
  id: string;
  supplierId: string | null;
  supplierName: string;
  amount: number;
  /** Código del método de pago. */
  method: string;
  methodName: string;
  concept: string;
  createdAt: Date;
  createdByName: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
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
  /** Base + cobros en efectivo + ingresos − pagos a proveedores en efectivo − retiros (al cerrar o hasta ahora). */
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
  /** Pagos a proveedores del turno (también los anulados), más recientes primero. */
  @ApiProperty({ type: [CashExpenseDto] })
  expenses: CashExpenseDto[];
  /** Pagos a proveedores sin anular, de cualquier método. */
  expensesTotal: number;
  /** De ellos, los pagados en efectivo: se restan del efectivo esperado. */
  cashExpensesTotal: number;
  /** Ingresos y retiros manuales de efectivo (también los anulados), más recientes primero. */
  @ApiProperty({ type: [CashMovementDto] })
  movements: CashMovementDto[];
  /** Ingresos manuales sin anular (suman al esperado). */
  cashInTotal: number;
  /** Retiros sin anular (restan al esperado). */
  cashOutTotal: number;
  /** Nombre del negocio (para el comprobante). */
  businessName: string;
}

export class CashCurrentDto {
  /** Caja abierta con sus totales hasta ahora, o null. */
  @ApiProperty({ type: CashSessionDto, nullable: true })
  session: CashSessionDto | null;
  /** Último cierre (para sugerir la base de la próxima apertura). */
  @ApiProperty({ type: CashSessionDto, nullable: true })
  lastClosed: CashSessionDto | null;
}
