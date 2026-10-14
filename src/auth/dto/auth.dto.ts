import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class RegisterBusinessAdminDto {
  /** @example Andrés Gómez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
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

export class LoginDto {
  /** @example admin@micancha.co */
  @IsEmail()
  email: string;

  /** @example MiCancha2026! */
  @IsString()
  @IsNotEmpty()
  password: string;
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
