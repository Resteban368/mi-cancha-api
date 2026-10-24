import { businessImageUrl } from '../common/public-url.js';

/** Fotos del negocio en orden: la primera es la portada. */
export const profileImagesSelect = {
  select: { id: true },
  orderBy: { position: 'asc' },
} as const;

export interface BusinessPhoto {
  id: string;
  url: string;
}

export function toBusinessPhotos(
  origin: string,
  images: { id: string }[],
): BusinessPhoto[] {
  return images.map((i) => ({ id: i.id, url: businessImageUrl(origin, i.id) }));
}
