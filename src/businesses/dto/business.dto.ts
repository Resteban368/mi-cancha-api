import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveBusinessDto {
  /** @example Complejo Deportivo El Golazo */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** @example Calle 15 # 8-32 */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  /** @example Barrio Centro */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  neighborhood: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Códigos del catálogo de servicios (GET /catalogs). @example ["PARQUEADERO","WIFI"] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  amenities?: string[];
}

export class BusinessDto {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  description: string | null;
  /** Códigos de los servicios que ofrece. */
  amenities: string[];
}
