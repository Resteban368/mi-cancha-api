import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CustomerInputDto {
  /** @example Valentina Dussán */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Se guardan solo los dígitos (y el + inicial). @example 300 123 4567 */
  @Matches(/^\+?[\d\s()-]{7,20}$/, {
    message: 'phone debe ser un teléfono válido (7 a 20 dígitos)',
  })
  phone: string;

  /** Cédula u otro documento; se ignoran puntos, espacios y guiones. @example 1.117.523.456 */
  @Matches(/^[\dA-Za-z.\s-]{4,20}$/, {
    message: 'documentId debe tener entre 4 y 20 caracteres (letras o números)',
  })
  documentId: string;
}

export class CustomerSearchDto {
  /** Nombre, teléfono o cédula. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class CustomerDto {
  id: string;
  name: string;
  phone: string;
  documentId: string;
  createdAt: Date;
}
