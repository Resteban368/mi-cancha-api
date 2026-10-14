-- Convierte los enums "BusinessAmenity" y "PaymentMethod" en catálogos editables,
-- conservando los servicios de cada negocio y el método de cada pago.

-- La tabla "PaymentMethod" crea un tipo con ese nombre: se aparta primero el enum viejo.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiresReference" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AmenityToBusiness" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AmenityToBusiness_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_code_key" ON "Amenity"("code");
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");
CREATE INDEX "_AmenityToBusiness_B_index" ON "_AmenityToBusiness"("B");

-- Valores iniciales: los mismos que tenían los enums
INSERT INTO "Amenity" ("id", "code", "name", "sortOrder", "updatedAt") VALUES
    (gen_random_uuid()::text, 'PARQUEADERO',          'Parqueadero',              1, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'CAFETERIA',            'Cafetería',                2, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'ILUMINACION_LED',      'Iluminación LED Pro',      3, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'VESTIERES',            'Vestieres',                4, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GRADERIAS',            'Graderías',                5, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'WIFI',                 'WiFi Gratis',              6, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'ALQUILER_IMPLEMENTOS', 'Alquiler de implementos',  7, CURRENT_TIMESTAMP);

INSERT INTO "PaymentMethod" ("id", "code", "name", "requiresReference", "sortOrder", "updatedAt") VALUES
    (gen_random_uuid()::text, 'EFECTIVO',       'Efectivo',       false, 1, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'NEQUI',          'Nequi',          true,  2, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'DAVIPLATA',      'Daviplata',      true,  3, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'BANCOLOMBIA_QR', 'Bancolombia QR', true,  4, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'TRANSFERENCIA',  'Transferencia',  true,  5, CURRENT_TIMESTAMP);

-- Migra los servicios de cada negocio a la tabla intermedia
INSERT INTO "_AmenityToBusiness" ("A", "B")
SELECT a."id", b."id"
FROM "Business" b
CROSS JOIN LATERAL unnest(b."amenities") AS am(code)
JOIN "Amenity" a ON a."code" = am.code::text;

ALTER TABLE "Business" DROP COLUMN "amenities";

-- Migra el método de cada pago
ALTER TABLE "Payment" ADD COLUMN "methodId" TEXT;
UPDATE "Payment" p SET "methodId" = m."id" FROM "PaymentMethod" m WHERE m."code" = p."method"::text;
ALTER TABLE "Payment" ALTER COLUMN "methodId" SET NOT NULL;
ALTER TABLE "Payment" DROP COLUMN "method";

-- DropEnum
DROP TYPE "BusinessAmenity";
DROP TYPE "PaymentMethod_old";

-- CreateIndex
CREATE INDEX "Payment_methodId_idx" ON "Payment"("methodId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_AmenityToBusiness" ADD CONSTRAINT "_AmenityToBusiness_A_fkey" FOREIGN KEY ("A") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AmenityToBusiness" ADD CONSTRAINT "_AmenityToBusiness_B_fkey" FOREIGN KEY ("B") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
