import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import type { CourtsService } from '../courts/courts.service.js';
import { CourtPhotoSlot, Sport, UserRole } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ReservationsService } from '../reservations/reservations.service.js';
import { OnlineBookingService, WEB_RULES } from './online-booking.service.js';
import { PlayerAuthService } from './player-auth.service.js';

const jwt = {
  signAsync: vi.fn().mockResolvedValue('token'),
} as unknown as JwtService;

describe('PlayerAuthService', () => {
  let prisma: PrismaMock;
  let service: PlayerAuthService;
  const dto = {
    fullName: ' Pedro Jugador ',
    email: 'Pedro@Correo.co',
    phone: '312 000 1111',
    documentId: '1.098.111.222',
    password: 'clave1234',
    birthDate: '1995-04-21',
    acceptDataPolicy: true,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PlayerAuthService(prisma as unknown as PrismaService, jwt);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) => ({
      id: 'u-1',
      ...data,
    }));
  });

  it('registra al jugador con datos normalizados y la aceptación de datos', async () => {
    const session = await service.register(dto);

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data).toMatchObject({
      role: UserRole.JUGADOR,
      displayName: 'Pedro Jugador',
      email: 'pedro@correo.co',
      phone: '+573120001111',
      documentId: '1098111222',
      birthDate: new Date('1995-04-21T00:00:00Z'),
      dataConsentVersion: expect.any(String),
    });
    expect(data.dataConsentAt).toBeInstanceOf(Date);
    expect(await bcrypt.compare('clave1234', data.passwordHash)).toBe(true);
    expect(session).toMatchObject({
      accessToken: 'token',
      player: { fullName: 'Pedro Jugador', birthDate: '1995-04-21' },
    });
  });

  it('no permite repetir correo, celular ni cédula', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'otro' });
    await expect(service.register(dto)).rejects.toThrow(
      'Esa cédula ya está registrada',
    );
  });

  it('inicia sesión con celular o cédula y rechaza la contraseña incorrecta', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u-1',
      role: UserRole.JUGADOR,
      displayName: 'Pedro',
      passwordHash: await bcrypt.hash('clave1234', 4),
      birthDate: null,
    });

    await expect(
      service.login({ identifier: '1.098.111.222', password: 'clave1234' }),
    ).resolves.toMatchObject({ accessToken: 'token' });
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
      role: UserRole.JUGADOR,
      // 10 dígitos también podrían ser un celular: se busca de las dos formas.
      OR: [{ phone: '+571098111222' }, { documentId: '1098111222' }],
    });

    await expect(
      service.login({ identifier: '3120001111', password: 'mala' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe('OnlineBookingService', () => {
  let prisma: PrismaMock;
  let service: OnlineBookingService;
  const reservations = {
    sportAvailability: vi.fn(),
    createWebReservation: vi.fn(),
  };
  const players = { requirePlayer: vi.fn() };
  const courts = { toDto: vi.fn() };
  const now = new Date('2026-10-15T15:00:00Z'); // 10:00 en Colombia

  const business = (overrides: Record<string, unknown> = {}) => ({
    id: 'biz-1',
    name: 'El Golazo',
    slug: 'el-golazo',
    address: 'Calle 15',
    neighborhood: 'Centro',
    description: null,
    latitude: 1.61,
    longitude: -75.6,
    onlineBookingEnabled: true,
    subscription: { isActive: true },
    profileImage: { id: 'img-1' },
    amenities: [{ code: 'WIFI', name: 'WiFi' }],
    courts: [
      {
        sport: Sport.FUTBOL,
        currency: 'COP',
        photos: [
          { slot: CourtPhotoSlot.MAIN },
          { slot: CourtPhotoSlot.SURFACE },
          { slot: CourtPhotoSlot.LIGHTING },
        ],
      },
      { sport: Sport.PADEL, currency: 'COP', photos: [] },
    ],
    ...overrides,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.court.findMany.mockResolvedValue([]);
    reservations.sportAvailability.mockReset();
    service = new OnlineBookingService(
      prisma as unknown as PrismaService,
      reservations as unknown as ReservationsService,
      players as unknown as PlayerAuthService,
      {} as BusinessesService,
      courts as unknown as CourtsService,
      new ConfigService({
        APP_UTC_OFFSET: '-05:00',
        PUBLIC_API_URL: 'https://api.test',
      }),
    );
  });

  it('muestra la página con mapa, foto y solo deportes con canchas reservables', async () => {
    prisma.business.findUnique.mockResolvedValue(business());
    const page = await service.publicBusiness('el-golazo');
    expect(page).toMatchObject({
      imageUrl: 'https://api.test/api/v1/images/business-profile/img-1',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1.61%2C-75.6',
      sports: [Sport.FUTBOL],
      bookingAvailable: true,
      unavailableReason: null,
      rules: { ...WEB_RULES, maxSlots: 3, paymentMethod: 'EFECTIVO' },
    });
  });

  it('incluye solo las canchas reservables con sus fotos y datos', async () => {
    prisma.business.findUnique.mockResolvedValue(business());
    prisma.court.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    courts.toDto
      .mockReturnValueOnce({
        id: 'c-1',
        name: 'Sintética 1',
        isBookable: true,
        isActive: true,
        missingPhotos: [],
        photos: [{ slot: 'MAIN', url: 'https://x/1' }],
        surface: { code: 'GRAMA_SINTETICA', name: 'Grama sintética' },
        lengthMeters: 42,
      })
      .mockReturnValueOnce({ id: 'c-2', isBookable: false });

    const page = await service.publicBusiness('el-golazo');

    expect(page.courts).toHaveLength(1);
    expect(page.courts[0]).toMatchObject({
      id: 'c-1',
      photos: [{ slot: 'MAIN', url: 'https://x/1' }],
      surface: { name: 'Grama sintética' },
      lengthMeters: 42,
    });
    // Sin datos internos de la cancha.
    expect(page.courts[0]).not.toHaveProperty('missingPhotos');
    expect(page.courts[0]).not.toHaveProperty('isActive');
  });

  it.each([
    [{ onlineBookingEnabled: false }, 'DISABLED'],
    [{ subscription: { isActive: false } }, 'PLAN_INACTIVE'],
    [{ courts: [] }, 'NO_COURTS'],
  ])('indica por qué no se puede reservar (%o)', async (overrides, reason) => {
    prisma.business.findUnique.mockResolvedValue(business(overrides));
    await expect(service.publicBusiness('el-golazo')).resolves.toMatchObject({
      bookingAvailable: false,
      unavailableReason: reason,
    });
    const error = await service
      .availability('el-golazo', Sport.FUTBOL, '2026-10-15', now)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
  });

  it('marca UNAVAILABLE los turnos dentro de la anticipación mínima y limita la fecha', async () => {
    prisma.business.findUnique.mockResolvedValue(business());
    reservations.sportAvailability.mockResolvedValue({
      date: '2026-10-15',
      sport: Sport.FUTBOL,
      maxSlots: 5,
      courts: [
        {
          court: { id: 'c-1' },
          availableCount: 2,
          slots: [
            { start: new Date('2026-10-15T15:30:00Z'), status: 'AVAILABLE' },
            { start: new Date('2026-10-15T17:00:00Z'), status: 'AVAILABLE' },
          ],
        },
      ],
    });

    const result = await service.availability(
      'el-golazo',
      Sport.FUTBOL,
      '2026-10-15',
      now,
    );
    expect(reservations.sportAvailability.mock.calls[0][4]).toEqual({
      withHolds: true,
    });
    expect(result.courts[0].slots.map((s) => s.status)).toEqual([
      'UNAVAILABLE',
      'AVAILABLE',
    ]);
    expect(result.courts[0].availableCount).toBe(1);

    await expect(
      service.availability('el-golazo', Sport.FUTBOL, '2026-11-20', now),
    ).rejects.toThrow('Elige una fecha entre hoy y 30 días adelante');
    await expect(
      service.availability('el-golazo', Sport.FUTBOL, '2026-10-14', now),
    ).rejects.toThrow('Elige una fecha');
  });
});
