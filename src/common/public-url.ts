import type { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '../setup-app.js';

/** Ruta pública (sin el prefijo de la API) donde se sirven las fotos de los negocios. */
export const BUSINESS_IMAGE_ROUTE = 'images/business-profile';
/** Ruta pública (sin el prefijo de la API) donde se sirven las fotos de las canchas. */
export const COURT_PHOTO_ROUTE = 'images/courts';

/** Origen público de la API: PUBLIC_API_URL, el dominio de producción en Vercel o localhost. */
export function publicApiUrl(config: ConfigService): string {
  const explicit = config.get<string>('PUBLIC_API_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = config.get<string>('VERCEL_PROJECT_PRODUCTION_URL');
  if (vercel) return `https://${vercel}`;
  return `http://localhost:${config.get<number>('PORT') ?? 3000}`;
}

export function businessImageUrl(origin: string, imageId: string): string {
  return `${origin}/${API_PREFIX}/${BUSINESS_IMAGE_ROUTE}/${imageId}`;
}

export function courtPhotoUrl(origin: string, photoId: string): string {
  return `${origin}/${API_PREFIX}/${COURT_PHOTO_ROUTE}/${photoId}`;
}
