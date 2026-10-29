import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CATALOG_CODE_PATTERN } from '../../catalogs/dto/catalog.dto.js';
import { ProductCategory, SaleStatus } from '../../generated/prisma/enums.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Productos por negocio (el catálogo se manda completo a la app). */
export const MAX_PRODUCTS = 200;
export const MAX_SALE_ITEMS = 30;
export const MAX_QUANTITY = 999;
/** Días hacia atrás que cuentan para "más vendidos". */
export const POPULAR_DAYS = 30;
export const PRODUCT_SORTS = ['name', 'popular'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ProductsQueryDto {
  /** true = también los desactivados (para administrar el catálogo). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  /** name (por defecto) o popular: más vendidos en los últimos 30 días primero. */
  @ApiProperty({ enum: PRODUCT_SORTS, required: false })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: (typeof PRODUCT_SORTS)[number];
}

export class CreateProductDto {
  /** @example Agua 600 ml */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  /** Por defecto OTRO. */
  @ApiProperty({ enum: ProductCategory, required: false })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  /** Precio por unidad. @example 2500 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  price: number;

  /** Con el módulo de Inventario: controlar sus existencias. */
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  /** Alerta de stock bajo; null = sin alerta. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  minStock?: number | null;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiProperty({ enum: ProductCategory, required: false })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000)
  minStock?: number | null;
}

export class ProductDto {
  id: string;
  name: string;
  @ApiProperty({ enum: ProductCategory })
  category: ProductCategory;
  price: number;
  isActive: boolean;
  /** Unidades vendidas en los últimos 30 días (sin anuladas). */
  sold: number;
  /** Inventario: si se controlan sus existencias y cuántas hay. */
  trackStock: boolean;
  stock: number;
  minStock: number | null;
  /** Sin unidades o en el mínimo (solo si trackStock). */
  lowStock: boolean;
}

export class SaleItemInputDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity: number;
}

/** Pago de una venta suelta: el monto es el total de la venta. */
export class SalePaymentInputDto {
  /** Código del catálogo de métodos de pago (GET /catalogs). @example EFECTIVO */
  @Matches(CATALOG_CODE_PATTERN, { message: 'method no es un código válido' })
  method: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;
}

export class CreateSaleDto {
  /** Reserva a la que se carga el consumo; sin ella es una venta suelta y lleva payment. */
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiProperty({ type: [SaleItemInputDto] })
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SALE_ITEMS)
  items: SaleItemInputDto[];

  /** Obligatorio en una venta suelta. En un consumo de reserva es opcional: lo cobra ya. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SalePaymentInputDto)
  payment?: SalePaymentInputDto;

  /** A quién se le vendió (venta suelta). @example Mostrador */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class VoidSaleDto {
  /** @example Se registró dos veces */
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class SalesQueryDto {
  /** Día (YYYY-MM-DD, hora local del negocio). */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date debe tener formato YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;
}

export class SaleItemDto {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export class SaleDto {
  id: string;
  /** null = venta suelta. */
  reservationId: string | null;
  customerName: string | null;
  total: number;
  note: string | null;
  @ApiProperty({ enum: SaleStatus })
  status: SaleStatus;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  @ApiProperty({ type: [SaleItemDto] })
  items: SaleItemDto[];
  /** Código del método con que se pagó (venta suelta o consumo cobrado ya). */
  paymentMethod: string | null;
  /** Cancha e inicio de la reserva de un consumo. */
  courtName: string | null;
  reservationStart: Date | null;
  /**
   * Consumo cuya reserva ya está pagada por completo (saldo en cero): se
   * cobró con la reserva aunque no tenga pago propio.
   */
  reservationPaid: boolean;
}
