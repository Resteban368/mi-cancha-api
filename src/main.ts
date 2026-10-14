import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { API_PREFIX, setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  setupApp(app);
  app.enableCors();

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
