-- Impide que dos reservas activas de la misma cancha se solapen en el tiempo.
--
-- El servicio ya revisa la disponibilidad antes de crear la reserva, pero lo hace
-- con un SELECT y luego un INSERT: si dos personas reservan el mismo turno a la vez,
-- ambas pasan la revisión y quedan dos reservas. Esta restricción lo hace imposible
-- en la base de datos; el segundo INSERT falla con 23P01 y la API responde 409.
--
-- Prisma no representa restricciones EXCLUDE en schema.prisma, así que vive solo
-- aquí. Si `prisma migrate dev` alguna vez propone borrarla, no aceptes ese cambio.
--
-- Antes de aplicarla en producción, verifica que no haya solapes existentes
-- (la migración fallaría):
--
--   SELECT a.id, b.id, a."courtId", a.start, a."end"
--   FROM "Reservation" a
--   JOIN "Reservation" b
--     ON a."courtId" = b."courtId" AND a.id < b.id
--    AND tsrange(a.start, a."end", '[)') && tsrange(b.start, b."end", '[)')
--   WHERE a.status IN ('CONFIRMED', 'COMPLETED')
--     AND b.status IN ('CONFIRMED', 'COMPLETED');

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_court_no_overlap"
  EXCLUDE USING gist (
    "courtId" WITH =,
    tsrange("start", "end", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'COMPLETED'));
