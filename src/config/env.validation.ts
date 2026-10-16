import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @Type(() => Number)
  @IsInt()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '7d';

  /** Desfase horario del negocio, p. ej. -05:00 para Colombia. */
  @Matches(/^[+-]\d{2}:\d{2}$/)
  APP_UTC_OFFSET: string = '-05:00';

  /** Client IDs de Google aceptados como audiencia, separados por coma. */
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_IDS?: string;

  /** Bundle IDs / Service IDs de Apple aceptados como audiencia, separados por coma. */
  @IsOptional()
  @IsString()
  APPLE_CLIENT_IDS?: string;

  /** Cuenta de Koofr donde se guardan las imágenes (correo de inicio de sesión). */
  @IsOptional()
  @IsString()
  KOOFR_EMAIL?: string;

  /** Contraseña de aplicación de Koofr (no la contraseña de la cuenta). */
  @IsOptional()
  @IsString()
  KOOFR_APP_PASSWORD?: string;

  /** Raíz WebDAV de Koofr. */
  @IsString()
  KOOFR_WEBDAV_URL: string = 'https://app.koofr.net/dav/Koofr';

  /** Carpeta raíz de la app dentro del almacenamiento. */
  @Matches(/^[\w-]+(\/[\w-]+)*$/)
  STORAGE_ROOT: string = 'mi-cancha';

  /**
   * Orígenes (dominios) que pueden llamar a la API desde el navegador, separados
   * por coma. Ver common/cors.ts. @example https://micancha.co
   */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** URL pública de la API para armar enlaces absolutos (p. ej. https://mi-cancha-api.vercel.app). */
  @IsOptional()
  @IsString()
  PUBLIC_API_URL?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);
  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.toString()}`);
  }
  return validated;
}
