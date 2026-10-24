import { CourtPhotoSlot } from '../generated/prisma/enums.js';

/** Fotos sin las que la cancha no puede recibir reservas: solo la principal. */
export const REQUIRED_PHOTOS: CourtPhotoSlot[] = [CourtPhotoSlot.MAIN];
