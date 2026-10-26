-- Fin de la prueba gratuita de la suscripción (null = plan de pago).
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Plan de prueba: 15 días, hasta 2 canchas, sin costo.
INSERT INTO "Plan" ("id", "name", "monthlyPrice", "courtLimit", "benefits")
VALUES (
  gen_random_uuid(),
  'Prueba',
  0,
  2,
  '[{"title":"Prueba gratis de 15 días","detail":"Usa todo el panel con hasta 2 canchas"}]'::jsonb
)
ON CONFLICT ("name") DO NOTHING;
