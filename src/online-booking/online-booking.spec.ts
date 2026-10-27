import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import {
  REQUIRED_PHOTOS,
  type CourtsService,
} from '../courts/courts.service.js';
import { CourtPhotoSlot, Sport, UserRole } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ReservationsService } from '../reservations/reservations.service.js';
import { OnlineBookingService, WEB_RULES } from './online-booking.service.js';
import { PlayerAuthService } from './player-auth.service.js';
import type { OtpService } from '../otp/otp.service.js';

const jwt = {
  signAsync: vi.fn().mockResolvedValue('token'),
} as unknown as JwtService;

describe('PlayerAuthService', () => {
  let prisma: PrismaMock;
  let service: PlayerAuthService;
  const otp = { request: vi.fn(), confirm: vi.fn() };
  const dto = {
    fullName: ' Pedro Jugador ',
    phone: '312 000 1111',
    password: 'clave1234',
    acceptDataPolicy: true as const,
    code: '123456',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    otp.request.mockReset().mockResolvedValue({ message: 'enviado' });
    otp.confirm.mockReset().mockResolvedValue(true);
    service = new PlayerAuthService(
      prisma as unknown as PrismaService,
      jwt,
      otp as unknown as OtpService,
    );
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) => ({
      id: 'u-1',
      ...data,
    }));
  });

  it('registra solo con nombre, celular verificado y contraseña', async () => {
    const session = await service.register(dto);

    expect(otp.confirm).toHaveBeenCalledWith('+573120001111', dto);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data).toMatchObject({
      role: UserRole.JUGADOR,
      displayName: 'Pedro Jugador',
      phone: '+573120001111',
      dataConsentVersion: expect.any(String),
    });
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('documentId');
    expect(data.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(await bcrypt.compare('clave1234', data.passwordHash)).toBe(true);
    expect(session.accessToken).toBe('token');
  });

  it('paso 1: con el celular libre pide el código (con la IP); si ya tiene cuenta, no', async () => {
    const { code: _code, ...data } = dto;
    await service.startRegistration(data, '1.2.3.4');
    expect(otp.request).toHaveBeenCalledWith('+573120001111', '1.2.3.4');

    otp.request.mockClear();
    prisma.user.findUnique.mockResolvedValue({ id: 'otro' });
    await expect(service.startRegistration(data)).rejects.toThrow(
      ConflictException,
    );
    expect(otp.request).not.toHaveBeenCalled();
  });

  it('paso 2: sin prueba válida del celular no crea la cuenta', async () => {
    otp.confirm.mockResolvedValue(false);
    await expect(service.register(dto)).rejects.toThrow(
      'El código no es correcto o ya venció',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('olvidé mi contraseña: responde igual con o sin cuenta, y solo envía si la hay', async () => {
    const a = await service.requestPasswordReset({ phone: '3120001111' });
    expect(otp.request).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
    otp.request.mockResolvedValue(a);
    const b = await service.requestPasswordReset({ phone: '3120001111' });
    expect(otp.request).toHaveBeenCalledWith('+573120001111', undefined);
    expect(b).toEqual(a);
  });

  it('cambia la contraseña con la prueba del celular y deja la sesión iniciada', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      role: UserRole.JUGADOR,
      phoneVerifiedAt: null,
    });
    prisma.user.update.mockImplementation(({ data }) => ({
      id: 'u-1',
      role: UserRole.JUGADOR,
      displayName: 'Pedro',
      birthDate: null,
      ...data,
    }));
    const session = await service.resetPassword({
      phone: '3120001111',
      code: '123456',
      password: 'nueva1234',
    });
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(await bcrypt.compare('nueva1234', data.passwordHash)).toBe(true);
    expect(session.accessToken).toBe('token');

    otp.confirm.mockResolvedValue(false);
    prisma.user.update.mockClear();
    await expect(
      service.resetPassword({
        phone: '3120001111',
        code: '000000',
        password: 'nueva1234',
      }),
    ).rejects.toThrow('El código no es correcto');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  describe('Mi perfil', () => {
    const player = { id: 'u-1', role: UserRole.JUGADOR, displayName: 'Pedro' };

    beforeEach(() => {
      prisma.user.findUnique.mockImplementation(({ where }) =>
        where.id === 'u-1' ? player : null,
      );
      prisma.user.update.mockImplementation(({ data }) => ({
        ...player,
        birthDate: null,
        ...data,
      }));
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cus-1', businessId: 'b-1' },
        { id: 'cus-2', businessId: 'b-2' },
      ]);
      // En la sede b-2 otro cliente ya usa esa cédula.
      prisma.customer.findUnique.mockImplementation(({ where }) =>
        where.businessId_documentId.businessId === 'b-2'
          ? { id: 'otro' }
          : null,
      );
    });

    it('completa correo y cédula, y anota la cédula en sus clientes sin ella', async () => {
      const me = await service.updateProfile('u-1', {
        email: ' Pedro@Correo.co ',
        documentId: '1.098.111.222',
        favoriteSport: Sport.FUTBOL,
      });
      expect(me).toMatchObject({
        email: 'pedro@correo.co',
        documentId: '1098111222',
        favoriteSport: Sport.FUTBOL,
      });
      expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({
        userId: 'u-1',
        documentId: null,
      });
      expect(prisma.customer.update).toHaveBeenCalledTimes(1);
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cus-1' },
        data: { documentId: '1098111222' },
      });
    });

    it('no deja usar el correo o la cédula de otra cuenta', async () => {
      prisma.user.findUnique.mockImplementation(({ where }) =>
        where.id === 'u-1' ? player : where.documentId ? { id: 'otra' } : null,
      );
      await expect(
        service.updateProfile('u-1', { documentId: '1098111222' }),
      ).rejects.toThrow('Esa cédula ya está registrada');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  it('inicia sesión con celular (o cédula) y rechaza la contraseña incorrecta', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u-1',
      role: UserRole.JUGADOR,
      displayName: 'Pedro',
      passwordHash: await bcrypt.hash('clave1234', 4),
      birthDate: null,
    });

    await expect(
      service.login({ identifier: '312 000 1111', password: 'clave1234' }),
    ).resolves.toMatchObject({ accessToken: 'token' });

    await expect(
      service.login({ identifier: '3120001111', password: 'mala' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('una cuenta bloqueada no inicia sesión ni cambia su clave, aunque los datos sean correctos', async () => {
    const banned = {
      id: 'u-1',
      role: UserRole.JUGADOR,
      displayName: 'Pedro',
      passwordHash: await bcrypt.hash('clave1234', 4),
      bannedAt: new Date(),
      phoneVerifiedAt: null,
      birthDate: null,
    };
    prisma.user.findFirst.mockResolvedValue(banned);
    await expect(
      service.login({ identifier: '3120001111', password: 'clave1234' }),
    ).rejects.toThrow(ForbiddenException);

    // Recuperar la clave con el código SMS tampoco la desbloquea.
    prisma.user.findUnique.mockResolvedValue(banned);
    prisma.user.update.mockClear();
    await expect(
      service.resetPassword({
        phone: '3120001111',
        code: '123456',
        password: 'nueva1234',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
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
    profileImages: [{ id: 'img-1' }],
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
      rules: {
        ...WEB_RULES,
        maxSlots: 3,
        maxCourts: 3,
        paymentMethod: 'EFECTIVO',
      },
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

  it('marca UNAVAILABLE los turnos que empezaron hace más de 15 minutos y limita la fecha', async () => {
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
            { start: new Date('2026-10-15T14:40:00Z'), status: 'AVAILABLE' },
            { start: new Date('2026-10-15T14:50:00Z'), status: 'AVAILABLE' },
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
      'AVAILABLE',
    ]);
    expect(result.courts[0].availableCount).toBe(2);

    await expect(
      service.availability('el-golazo', Sport.FUTBOL, '2026-11-20', now),
    ).rejects.toThrow('Elige una fecha entre hoy y 30 días adelante');
    await expect(
      service.availability('el-golazo', Sport.FUTBOL, '2026-10-14', now),
    ).rejects.toThrow('Elige una fecha');
  });

  describe('Directorio de sedes', () => {
    const photos = REQUIRED_PHOTOS.map((slot) => ({ slot }));
    const sede = (id: string, overrides: Record<string, unknown> = {}) =>
      business({
        id,
        slug: `sede-${id}`,
        name: `Sede ${id}`,
        courts: [
          {
            sport: Sport.FUTBOL,
            currency: 'COP',
            basePricePerHour: 80000,
            photos,
          },
          {
            sport: Sport.PADEL,
            currency: 'COP',
            basePricePerHour: 60000,
            photos,
          },
          // Sin fotos: no se reserva en línea, no cuenta.
          {
            sport: Sport.PADEL,
            currency: 'COP',
            basePricePerHour: 10000,
            photos: [],
          },
        ],
        ...overrides,
      });

    it('lista solo sedes reservables con canchas, deportes y precio desde', async () => {
      prisma.business.findMany
        .mockResolvedValueOnce([
          { id: 'biz-1', latitude: 1.6, longitude: -75.6 },
        ])
        .mockResolvedValueOnce([sede('biz-1')]);

      const page = await service.directory({});

      expect(page).toEqual({
        url: 'https://api.test/reservar',
        total: 1,
        page: 1,
        limit: 12,
        businesses: [
          expect.objectContaining({
            slug: 'sede-biz-1',
            imageUrl: 'https://api.test/api/v1/images/business-profile/img-1',
            sports: [Sport.FUTBOL, Sport.PADEL],
            courtCount: 2,
            amenities: [{ code: 'WIFI', name: 'WiFi' }],
            fromPricePerHour: 60000,
            currency: 'COP',
            distanceKm: null,
          }),
        ],
      });
    });

    it('aplica búsqueda, deporte y servicio en la consulta', async () => {
      prisma.business.findMany.mockResolvedValue([]);

      await service.directory({
        q: ' gol ',
        sport: Sport.PADEL,
        amenity: 'PARQUEADERO',
      });

      const where = prisma.business.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        onlineBookingEnabled: true,
        subscription: { is: { isActive: true } },
        amenities: { some: { code: 'PARQUEADERO', active: true } },
        courts: {
          some: { isActive: true, sport: Sport.PADEL },
        },
      });
      expect(where.OR).toContainEqual({
        name: { contains: 'gol', mode: 'insensitive' },
      });
    });

    it('ordena por cercanía, deja sin punto al final y pagina después de ordenar', async () => {
      prisma.business.findMany
        .mockResolvedValueOnce([
          { id: 'lejos', latitude: 4.6, longitude: -74.08 },
          { id: 'cerca', latitude: 1.6, longitude: -75.6 },
          { id: 'sin-punto', latitude: null, longitude: null },
        ])
        .mockResolvedValueOnce([
          sede('lejos', { slug: 'lejos' }),
          sede('cerca', { slug: 'cerca' }),
        ]);

      const page = await service.directory({
        lat: 1.6,
        lng: -75.6,
        limit: 2,
      });

      expect(page.total).toBe(3);
      expect(prisma.business.findMany.mock.calls[1][0].where).toEqual({
        id: { in: ['cerca', 'lejos'] },
      });
      expect(page.businesses.map((b) => b.slug)).toEqual(['cerca', 'lejos']);
      expect(page.businesses[0].distanceKm).toBe(0);
      expect(page.businesses[1].distanceKm).toBeGreaterThan(100);
    });

    it('con radiusKm solo trae las sedes dentro del radio y deja fuera las sin punto', async () => {
      prisma.business.findMany
        .mockResolvedValueOnce([
          { id: 'lejos', latitude: 4.6, longitude: -74.08 },
          { id: 'cerca', latitude: 1.62, longitude: -75.6 },
          { id: 'sin-punto', latitude: null, longitude: null },
        ])
        .mockResolvedValueOnce([sede('cerca', { slug: 'cerca' })]);

      const page = await service.directory({
        lat: 1.6,
        lng: -75.6,
        radiusKm: 10,
      });

      expect(page.total).toBe(1);
      expect(prisma.business.findMany.mock.calls[1][0].where).toEqual({
        id: { in: ['cerca'] },
      });
    });

    it('radiusKm exige lat y lng', async () => {
      await expect(service.directory({ radiusKm: 10 })).rejects.toThrow(
        'radiusKm necesita lat y lng',
      );
    });

    it('con cityId solo busca sedes de esa ciudad', async () => {
      prisma.business.findMany
        .mockResolvedValueOnce([{ id: 'a', latitude: null, longitude: null }])
        .mockResolvedValueOnce([sede('a', { slug: 'a' })]);

      await service.directory({ cityId: 'city-1' });

      expect(prisma.business.findMany.mock.calls[0][0].where).toMatchObject({
        cityId: 'city-1',
        onlineBookingEnabled: true,
      });
    });

    it('las ciudades del selector son solo las que tienen sedes reservables, con su conteo', async () => {
      prisma.business.groupBy.mockResolvedValue([
        { cityId: 'c-flo', _count: { _all: 3 } },
        { cityId: 'c-bog', _count: { _all: 1 } },
      ]);
      prisma.city.findMany.mockResolvedValue([
        {
          id: 'c-flo',
          name: 'Florencia',
          department: { id: 'd1', name: 'Caquetá' },
        },
        {
          id: 'c-bog',
          name: 'Bogotá, D.C.',
          department: { id: 'd2', name: 'Bogotá, D.C.' },
        },
      ]);

      const cities = await service.directoryCities();

      expect(prisma.business.groupBy.mock.calls[0][0].where).toMatchObject({
        onlineBookingEnabled: true,
        cityId: { not: null },
      });
      expect(prisma.city.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ['c-flo', 'c-bog'] },
      });
      expect(cities.map((c) => [c.name, c.businessCount])).toEqual([
        ['Bogotá, D.C.', 1],
        ['Florencia', 3],
      ]);
    });

    it('el mapa trae solo las sedes reservables con punto', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          name: 'El Golazo',
          slug: 'el-golazo',
          latitude: 1.6,
          longitude: -75.6,
        },
      ]);

      const points = await service.directoryMap();

      expect(points).toEqual([
        {
          name: 'El Golazo',
          slug: 'el-golazo',
          latitude: 1.6,
          longitude: -75.6,
        },
      ]);
      expect(prisma.business.findMany.mock.calls[0][0].where).toMatchObject({
        onlineBookingEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      });
    });

    it('exige lat y lng juntos', async () => {
      await expect(service.directory({ lat: 1.6 })).rejects.toThrow(
        'Envía lat y lng juntos',
      );
    });
  });

  it('Mis sedes: solo las sedes donde el jugador ya tiene cliente', async () => {
    const since = new Date('2026-10-01T15:00:00Z');
    prisma.customer.findMany.mockResolvedValue([
      {
        createdAt: since,
        business: {
          name: 'El Golazo',
          slug: 'el-golazo',
          address: 'Calle 15',
          neighborhood: 'Centro',
          profileImages: [{ id: 'img-1' }],
        },
      },
    ]);

    const list = await service.myBusinesses('u-1');

    expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u-1',
      business: { slug: { not: null } },
    });
    expect(list).toEqual([
      {
        slug: 'el-golazo',
        name: 'El Golazo',
        address: 'Calle 15',
        neighborhood: 'Centro',
        imageUrl: 'https://api.test/api/v1/images/business-profile/img-1',
        clientSince: since,
      },
    ]);
  });

  it('no deja usar como link una ruta fija de la web (perfil, ingresar…)', async () => {
    await expect(
      service.updateSettingsFor('biz-1', { slug: 'perfil' }),
    ).rejects.toThrow('reservado');
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});
