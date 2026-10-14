import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Opcional a propósito: `prisma generate` (en cada install, incluido el build de
    // Vercel) no se conecta. Los comandos que sí se conectan fallan si falta la URL.
    url: process.env.DATABASE_URL,
  },
});
