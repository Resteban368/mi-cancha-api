import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import {
  ProductCategory,
  StockMovementType,
} from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const MAX_STOCK = 100_000;

export class StockEntryDto {
  @IsUUID()
  productId: string;

  /** Unidades que entran. @example 24 */
  @IsInt()
  @Min(1)
  @Max(MAX_STOCK)
  quantity: number;

  /** Costo por unidad (opcional). @example 3200 */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  unitCost?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class StockAdjustmentDto {
  @IsUUID()
  productId: string;

  /** Unidades que hay de verdad (conteo físico). @example 18 */
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock: number;

  /** @example Conteo físico */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason: string;
}

export class StockMovementsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class InventoryItemDto {
  id: string;
  name: string;
  @ApiProperty({ enum: ProductCategory })
  category: ProductCategory;
  price: number;
  trackStock: boolean;
  stock: number;
  minStock: number | null;
  lowStock: boolean;
}

export class InventoryDto {
  /** Productos activos, por nombre (con y sin control de stock). */
  @ApiProperty({ type: [InventoryItemDto] })
  items: InventoryItemDto[];
  /** Con control de stock. */
  tracked: number;
  /** Con stock bajo (en el mínimo o por debajo, con existencias). */
  low: number;
  /** Agotados (0 unidades). */
  out: number;
}

export class StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  @ApiProperty({ enum: StockMovementType })
  type: StockMovementType;
  /** Unidades que entran (+) o salen (−). */
  quantity: number;
  stockAfter: number;
  unitCost: number | null;
  supplierName: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: Date;
}
