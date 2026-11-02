#!/bin/sh
# Migraciones de Prisma contra la base de producción (Postgres en el VPS, servicio
# "db" del proyecto mi_cancha_app en Easypanel). Se corre desde tu Mac, en la raíz
# del repo:
#
#   scripts/migrate-vps.sh status    # qué migraciones faltan (no cambia nada)
#   scripts/migrate-vps.sh deploy    # backup a Koofr y luego aplica las pendientes
#
# Usa las migraciones de TU copia local (prisma/), no las de GitHub: así se pueden
# aplicar antes de hacer push del código que las necesita.
#
# La base no está expuesta a internet: el script sube prisma/ al VPS por SSH y corre
# Prisma en un contenedor temporal dentro de la red interna de Easypanel. La URL de
# la base sale del servicio "api" del VPS, así que no hace falta tenerla en el Mac.
set -eu

VPS="${VPS:-root@179.66.129.62}"
CMD="${1:-}"
case "$CMD" in
  status | deploy) ;;
  *)
    echo "Uso: scripts/migrate-vps.sh status|deploy" >&2
    exit 2
    ;;
esac

cd "$(dirname "$0")/.."
[ -f prisma/schema.prisma ] || { echo "No encuentro prisma/schema.prisma" >&2; exit 1; }

# Misma versión de Prisma que el proyecto (sin el ^ ni el ~).
PRISMA_VERSION=$(node -p "require('./package.json').devDependencies.prisma.replace(/^[^0-9]*/, '')")
DOTENV_VERSION=$(node -p "require('./package.json').dependencies.dotenv.replace(/^[^0-9]*/, '')")

REMOTE_DIR=/root/mi-cancha-migrate
echo "› Subiendo prisma/ al VPS…"
ssh "$VPS" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR"
tar -cf - prisma.config.ts prisma/schema.prisma prisma/migrations | ssh "$VPS" "tar -xf - -C $REMOTE_DIR"

if [ "$CMD" = deploy ]; then
  echo "› Backup previo a Koofr…"
  ssh "$VPS" /usr/local/bin/mi-cancha-backup.sh
fi

echo "› prisma migrate $CMD (Prisma $PRISMA_VERSION)…"
ssh "$VPS" sh -s "$CMD" "$PRISMA_VERSION" "$DOTENV_VERSION" "$REMOTE_DIR" <<'REMOTE'
set -eu
CMD=$1; PRISMA_VERSION=$2; DOTENV_VERSION=$3; DIR=$4
URL=$(docker service inspect mi_cancha_app_api \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | sed -n 's/^DATABASE_URL=//p')
[ -n "$URL" ] || { echo "No encontré DATABASE_URL en el servicio api" >&2; exit 1; }
# migrate status sale con código 1 cuando hay pendientes: no es un error del script.
docker run --rm --network easypanel-mi_cancha_app \
  -e DATABASE_URL="$URL" -v "$DIR":/work -w /work \
  -v mi-cancha-migrate-npm:/root/.npm \
  node:24-bookworm sh -c "
    npm install --silent --no-save --no-audit --no-fund --ignore-scripts \
      prisma@$PRISMA_VERSION dotenv@$DOTENV_VERSION >/dev/null &&
    npx prisma migrate $CMD" || STATUS=$?
rm -rf "$DIR"
exit "${STATUS:-0}"
REMOTE
