# API de Mi Cancha + landing, panel de super admin (/admin) y web de jugadores
# (/reservar), todo servido por NestJS. Imagen para el VPS (Easypanel).
#
# Construir:  docker build -t mi-cancha-api .
# Correr:     docker run --env-file .env -p 3000:3000 mi-cancha-api
# Las migraciones de Neon NO se corren al arrancar: se aplican a mano antes del
# despliegue (ver README).

FROM node:24-bookworm-slim AS build
WORKDIR /app

# Dependencias primero para aprovechar la caché de capas. El postinstall corre
# prisma generate e instala admin/, web/ y landing/, así que necesita sus package.json.
# tsconfig va antes: prisma generate deduce de él la extensión de los imports (.js).
COPY package.json package-lock.json prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY admin/package.json admin/package-lock.json ./admin/
COPY web/package.json web/package-lock.json ./web/
COPY landing/package.json landing/package-lock.json ./landing/
RUN npm ci

COPY . .
# Mismo orden que en Vercel: la landing compila en la raíz de public/ sin vaciarla.
RUN npm run build:landing && npm run build:admin && npm run build:web && npm run build \
  && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
