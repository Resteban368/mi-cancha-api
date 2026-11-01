-- La tabla de precios por canchas pasa del código a la base de datos, para editarla desde el admin.
ALTER TABLE "Plan" ADD COLUMN "courtPrices" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

UPDATE "Plan"
SET "courtPrices" = ARRAY[
  79000, 98000, 117000, 136000, 155000, 171000, 187000, 203000, 219000, 235000,
  248000, 261000, 274000, 287000, 300000, 309000, 318000, 327000, 336000, 345000
]
WHERE "pricedByCourts" = true;
