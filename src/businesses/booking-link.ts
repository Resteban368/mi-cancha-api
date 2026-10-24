import { REQUIRED_PHOTOS } from '../courts/required-photos.js';
import type { CourtPhotoSlot } from '../generated/prisma/enums.js';
import type { BookingLinkDto } from './dto/business.dto.js';

/** Lo que hace falta para decidir si el link de reservas recibe jugadores. */
export interface BookingLinkSource {
  slug: string | null;
  onlineBookingEnabled: boolean;
  subscription: { isActive: boolean } | null;
  /** Solo las canchas activas. */
  courts: { photos: { slot: CourtPhotoSlot }[] }[];
}

export type BookingUnavailableReason =
  'DISABLED' | 'PLAN_INACTIVE' | 'NO_COURTS';

/** El link se activa con reservas encendidas, plan activo y al menos una cancha activa completa. */
export function bookingStateOf(business: BookingLinkSource): {
  available: boolean;
  reason: BookingUnavailableReason | null;
} {
  if (!business.onlineBookingEnabled) {
    return { available: false, reason: 'DISABLED' };
  }
  if (!business.subscription?.isActive) {
    return { available: false, reason: 'PLAN_INACTIVE' };
  }
  const hasBookableCourt = business.courts.some((c) =>
    REQUIRED_PHOTOS.every((slot) => c.photos.some((p) => p.slot === slot)),
  );
  if (!hasBookableCourt) return { available: false, reason: 'NO_COURTS' };
  return { available: true, reason: null };
}

/** Link público de reservas del negocio: existe desde que se crea y se activa con su primera cancha completa. */
export function toBookingLink(
  origin: string,
  business: BookingLinkSource,
): BookingLinkDto {
  const { available, reason } = bookingStateOf(business);
  return {
    enabled: business.onlineBookingEnabled,
    slug: business.slug!,
    url: `${origin}/reservar/${business.slug}`,
    bookingAvailable: available,
    unavailableReason: reason,
  };
}
