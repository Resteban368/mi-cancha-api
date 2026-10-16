import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { corsOptions } from './common/cors.js';
import { API_PREFIX, setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // En Vercel las peticiones llegan por su proxy, que pone la IP real del cliente
  // en X-Forwarded-For. Sin esto todas parecerían venir de la misma IP y el límite
  // de peticiones por IP bloquearía a todos los usuarios a la vez. Fuera de Vercel
  // no se confía en esa cabecera, porque cualquiera podría falsificarla.
  if (process.env.VERCEL) app.set('trust proxy', 1);
  const config = app.get(ConfigService);
  setupApp(app);
  app.enableCors(
    corsOptions(
      config.get<string>('CORS_ORIGINS'),
      config.getOrThrow<string>('NODE_ENV'),
    ),
  );

  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Mi Cancha API')
        .setDescription(
          'Backend de la app Mi Cancha: reservas de canchas deportivas',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.getOrThrow<number>('PORT'));
  console.log(
    `Mi Cancha API escuchando en ${await app.getUrl()}/${API_PREFIX}`,
  );
}
// Sin await de nivel superior: en Vercel el runtime importa este módulo y espera a
// que termine de cargar antes de interceptar app.listen(); con await se bloquean.
bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar la API', error);
  process.exit(1);
});
