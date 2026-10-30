-- Plan único: el precio sale de las canchas contratadas en cada suscripción.
ALTER TABLE "Plan" ADD COLUMN "pricedByCourts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "courts" INTEGER;

INSERT INTO "Plan" ("id", "name", "monthlyPrice", "courtLimit", "pricedByCourts", "benefits")
VALUES (
  gen_random_uuid(),
  'Mi Cancha',
  79000,
  20,
  true,
  '[{"title":"Todo el sistema incluido","detail":"El precio depende de las canchas contratadas"}]'::jsonb
)
ON CONFLICT ("name") DO UPDATE SET "pricedByCourts" = true, "monthlyPrice" = 79000, "courtLimit" = 20;

-- Los clientes de pago pasan al plan único con las canchas que ya tenían contratadas.
UPDATE "Subscription" s
SET "courts" = LEAST(p."courtLimit", 20),
    "planId" = (SELECT "id" FROM "Plan" WHERE "name" = 'Mi Cancha')
FROM "Plan" p
WHERE s."planId" = p."id" AND p."monthlyPrice" > 0 AND p."name" <> 'Mi Cancha';

DELETE FROM "Plan" WHERE "monthlyPrice" > 0 AND "name" <> 'Mi Cancha';
