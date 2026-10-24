import { CourtPhotoSlot } from '../generated/prisma/enums.js';
import { toBookingLink, type BookingLinkSource } from './booking-link.js';

const ready: BookingLinkSource = {
  slug: 'el-golazo',
  onlineBookingEnabled: true,
  subscription: { isActive: true },
  courts: [{ photos: [{ slot: CourtPhotoSlot.MAIN }] }],
};

describe('toBookingLink', () => {
  it('con una cancha completa el link queda activo', () => {
    expect(toBookingLink('https://api.test', ready)).toEqual({
      enabled: true,
      slug: 'el-golazo',
      url: 'https://api.test/reservar/el-golazo',
      bookingAvailable: true,
      unavailableReason: null,
    });
  });

  it('el link existe desde que se crea el negocio, pero sin canchas no está activo', () => {
    const link = toBookingLink('https://api.test', { ...ready, courts: [] });
    expect(link.url).toBe('https://api.test/reservar/el-golazo');
    expect(link).toMatchObject({
      bookingAvailable: false,
      unavailableReason: 'NO_COURTS',
    });
  });

  it('una cancha sin foto principal no cuenta como completa', () => {
    const link = toBookingLink('https://api.test', {
      ...ready,
      courts: [{ photos: [{ slot: CourtPhotoSlot.SURFACE }] }],
    });
    expect(link.unavailableReason).toBe('NO_COURTS');
  });

  it('informa si el dueño apagó las reservas o el plan está inactivo', () => {
    expect(
      toBookingLink('https://api.test', {
        ...ready,
        onlineBookingEnabled: false,
      }).unavailableReason,
    ).toBe('DISABLED');
    expect(
      toBookingLink('https://api.test', {
        ...ready,
        subscription: { isActive: false },
      }).unavailableReason,
    ).toBe('PLAN_INACTIVE');
  });
});
