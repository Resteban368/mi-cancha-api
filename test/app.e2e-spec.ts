// Requiere la base de datos levantada y con el seed aplicado:
//   docker compose up -d && npx prisma migrate deploy && npx prisma db seed
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/generated/prisma/enums.js';
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

  it('bloquea a un jugador en las rutas del negocio', async () => {
    const playerToken = await app
      .get(JwtService)
      .signAsync({ sub: 'jugador-demo', role: UserRole.JUGADOR });
    await request(app.getHttpServer())
      .get('/api/v1/business/profile')
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
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
});
