import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CityRefDto } from '../../catalogs/dto/location.dto.js';

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

  /**
   * Latitud del punto de llegada. Va junto con longitude; si se omiten, la
   * ubicación se borra (es un PUT). @example 4.6097
   */
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  /** Longitud del punto de llegada. @example -74.0817 */
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  /**
   * Ciudad del negocio (id de `GET /catalogs/departments/:id/cities`); de ella sale el departamento.
   * Obligatoria al crear el negocio; al actualizar, si se omite se conserva la actual.
   */
  @IsOptional()
  @IsUUID()
  cityId?: string;

  /** Códigos del catálogo de servicios (GET /catalogs). @example ["PARQUEADERO","WIFI"] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  amenities?: string[];
}

/** Orden deseado de las fotos: todos los ids del negocio, la primera es la portada. */
export class ReorderPhotosDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  ids: string[];
}

/** Link público de reservas (/reservar/<slug>): existe desde que se crea el negocio. */
export class BookingLinkDto {
  enabled: boolean;
  slug: string;
  /** Link para compartir. */
  url: string;
  /** true cuando hay reservas encendidas, plan activo y al menos una cancha completa. */
  bookingAvailable: boolean;
  /** DISABLED, PLAN_INACTIVE o NO_COURTS; null si está disponible. */
  unavailableReason: string | null;
}

export class BusinessPhotoDto {
  id: string;
  url: string;
}

export class BusinessDto {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  description: string | null;
  /** Códigos de los servicios que ofrece. */
  amenities: string[];
  /** URL pública de la foto de portada; null si no tiene. */
  imageUrl: string | null;
  /** Fotos del negocio (hasta 5) en orden; la primera es la portada. */
  photos: BusinessPhotoDto[];
  /** Ciudad y departamento; null en negocios anteriores que aún no la completan. */
  city: CityRefDto | null;
  /** Link de reservas y si ya está activo. */
  bookingLink: BookingLinkDto;
  /** Punto de llegada; ambos null si aún no se fijó. */
  latitude: number | null;
  longitude: number | null;
}
