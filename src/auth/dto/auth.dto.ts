import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  IsEmail,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsBusinessName, NoMarkup } from '../../common/dto/business-name.js';
import { UserRole } from '../../generated/prisma/enums.js';

export class RegisterBusinessAdminDto {
  /** @example Andrés Gómez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @NoMarkup()
  fullName: string;

  /** @example admin@golazo.co */
  @IsEmail()
  email: string;

  /** Mínimo 8 caracteres. @example MiCancha2026! */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /** @example +57 300 123 4567 */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

/**
 * Registro de un negocio nuevo desde la página web: cuenta, negocio y 15 días de prueba.
 * Aquí el celular es obligatorio (en RegisterBusinessAdminDto es opcional), por eso se omite
 * el heredado y se declara de nuevo: si no, su @IsOptional saltaría la validación.
 */
export class SignupBusinessDto extends OmitType(RegisterBusinessAdminDto, [
  'phone',
] as const) {
  /** Celular de contacto del negocio. @example +57 300 123 4567 */
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

  /** @example Cancha El Golazo */
  @IsBusinessName()
  businessName: string;

  /** @example Calle 10 # 5-20 */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @NoMarkup()
  address: string;

  /** @example Centro */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @NoMarkup()
  neighborhood: string;

  /** Ciudad del negocio (GET /catalogs/departments/:id/cities). */
  @IsUUID()
  cityId: string;
}

export class LoginDto {
  /** @example admin@micancha.co */
  @IsEmail()
  email: string;

  /** @example MiCancha2026! */
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ChangePasswordDto {
  /** Contraseña con la que inicia sesión hoy. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  /** Mínimo 8 caracteres; debe ser distinta de la actual. @example NuevaClave2026! */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class GoogleSignInDto {
  /** ID token devuelto por Google Sign-In en la app. */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class AppleSignInDto {
  /** identityToken devuelto por Sign in with Apple. */
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  /** Apple solo envía el nombre en el primer inicio de sesión. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @NoMarkup()
  fullName?: string;
}

export class AuthUserDto {
  id: string;
  displayName: string;
  @ApiProperty({ enum: UserRole })
  role: UserRole;
}

export class AuthResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
