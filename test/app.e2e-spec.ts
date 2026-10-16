// Requiere la base de datos levantada y con el seed aplicado:
//   docker compose up -d && npx prisma migrate deploy && npx prisma db seed
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

const DEMO = { email: 'admin@micancha.co', password: 'MiCancha2026!' };

describe('Mi Cancha API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/business/login')
      .send(DEMO)
      .expect(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde con la base de datos arriba', () =>
    request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' }));

  it('exige token en las rutas del negocio', () =>
    request(app.getHttpServer()).get('/api/v1/business/profile').expect(401));

  it('rechaza credenciales inválidas', () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/business/login')
      .send({ ...DEMO, password: 'incorrecta' })
      .expect(401));

  describe('sesiones de un jugador', () => {
    let playerId: string;
    let playerToken: string;

    beforeAll(async () => {
      const player = await app.get(PrismaService).user.create({
        data: { displayName: 'Jugador e2e', role: UserRole.JUGADOR },
      });
      playerId = player.id;
      playerToken = await app.get(JwtService).signAsync({
        sub: player.id,
        role: player.role,
        ver: player.tokenVersion,
      });
    });

    afterAll(async () => {
      await app.get(PrismaService).user.delete({ where: { id: playerId } });
    });

    it('bloquea a un jugador en las rutas del negocio', () =>
      request(app.getHttpServer())
        .get('/api/v1/business/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403));

    it('rechaza el token de un usuario que no existe', async () => {
      const ghost = await app
        .get(JwtService)
        .signAsync({ sub: 'no-existe', role: UserRole.SUPER_ADMIN });
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${ghost}`)
        .expect(401);
    });

    it('cerrar todas las sesiones invalida el token de inmediato', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${playerToken}` };
      await request(server).get('/api/v1/auth/me').set(auth).expect(200);
      await request(server)
        .post('/api/v1/auth/logout-all')
        .set(auth)
        .expect(204);
      await request(server).get('/api/v1/auth/me').set(auth).expect(401);
    });

    it('el super admin puede cerrar las sesiones de otro usuario', async () => {
      const server = app.getHttpServer();
      const player = await app
        .get(PrismaService)
        .user.findUniqueOrThrow({ where: { id: playerId } });
      const fresh = await app.get(JwtService).signAsync({
        sub: player.id,
        role: player.role,
        ver: player.tokenVersion,
      });
      await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fresh}`)
        .expect(200);

      const admin = await request(server)
        .post('/api/v1/auth/business/login')
        .send({
          email: 'superadmin@micancha.co',
          password: 'SuperAdmin2026!',
        })
        .expect(200);
      await request(server)
        .post(`/api/v1/admin/users/${playerId}/revoke-sessions`)
        .set('Authorization', `Bearer ${admin.body.accessToken}`)
        .expect(204);

      await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fresh}`)
        .expect(401);
    });
  });

  it('devuelve el perfil del negocio demo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/business/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.name).toBe('Complejo Deportivo El Golazo');
  });

  it('valida el formato de la fecha de la agenda', () =>
    request(app.getHttpServer())
      .get('/api/v1/business/reservations?date=13-10-2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(400));

  describe('reservas solapadas', () => {
    const created: string[] = [];
    const addedPhotos: string[] = [];
    let courtId: string;

    // Las canchas del seed no tienen fotos y por eso no se pueden reservar:
    // se le agregan las obligatorias a una cancha activa solo durante la prueba.
    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      const court = await prisma.court.findFirstOrThrow({
        where: { isActive: true, business: { owner: { email: DEMO.email } } },
        include: { photos: true },
      });
      courtId = court.id;
      for (const slot of ['MAIN', 'SURFACE', 'LIGHTING'] as const) {
        if (court.photos.some((p) => p.slot === slot)) continue;
        const photo = await prisma.courtPhoto.create({
          data: {
            courtId,
            slot,
            storagePath: `e2e/${slot}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 1,
          },
        });
        addedPhotos.push(photo.id);
      }
    });

    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.reservation.deleteMany({ where: { id: { in: created } } });
      await prisma.courtPhoto.deleteMany({
        where: { id: { in: addedPhotos } },
      });
    });

    /** Primer turno libre de la cancha dentro de una semana. */
    async function freeSlot(): Promise<{ courtId: string; start: string }> {
      const date = new Date(Date.now() + 7 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/business/courts/${courtId}/availability?date=${date}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const slot = res.body.slots.find(
        (s: { status: string }) => s.status === 'AVAILABLE',
      );
      if (!slot) throw new Error('La cancha no tiene turnos libres');
      return { courtId, start: slot.start };
    }

    const book = (courtId: string, start: string, n: number) =>
      request(app.getHttpServer())
        .post('/api/v1/business/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courtId,
          start,
          slots: 1,
          customer: {
            name: `Prueba Solape ${n}`,
            phone: `30000000${n}${Date.now() % 1000}`,
            documentId: `99${n}${Date.now() % 100000}`,
          },
        });

    it('acepta solo una de dos reservas simultáneas del mismo turno', async () => {
      const { courtId, start } = await freeSlot();
      const responses = await Promise.all([
        book(courtId, start, 1),
        book(courtId, start, 2),
      ]);
      for (const r of responses) if (r.status === 201) created.push(r.body.id);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('la base de datos rechaza el solape aunque se salte la validación', async () => {
      const prisma = app.get(PrismaService);
      const existing = await prisma.reservation.findFirstOrThrow({
        where: { status: 'CONFIRMED' },
      });
      const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = existing;
      await expect(
        prisma.reservation.create({ data: copy }),
      ).rejects.toMatchObject({
        code: 'P2039',
        meta: { driverAdapterError: { cause: { code: '23P01' } } },
      });
    });
  });

  it('rechaza propiedades no declaradas en el body', () =>
    request(app.getHttpServer())
      .put('/api/v1/business/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'X',
        address: 'Calle 1',
        neighborhood: 'Centro',
        ownerId: 'otro',
      })
      .expect(400));

  // Debe ir al final: agota el cupo de inicios de sesión de esta IP.
  it('corta los intentos de login repetidos con 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/business/login')
        .send({ ...DEMO, password: `incorrecta-${i}` });
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
  });
});
