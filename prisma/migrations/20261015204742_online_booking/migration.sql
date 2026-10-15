-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('BUSINESS', 'WEB');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "source" "ReservationSource" NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "dataConsentAt" TIMESTAMP(3),
ADD COLUMN     "dataConsentVersion" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "favoriteSport" "Sport",
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_userId_key" ON "Customer"("businessId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_documentId_key" ON "User"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_role_phone_key" ON "User"("role", "phone");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Slug del link público de reservas: se genera del nombre (sin tildes, en
-- minúsculas, con guiones) y se le agrega -2, -3… si ya existe.
CREATE OR REPLACE FUNCTION make_business_slug(business_name TEXT, business_id TEXT)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  n INT := 1;
BEGIN
  base := left(coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(business_name), 'áéíóúüñàèìòùç', 'aeiouunaeiouc'),
    '[^a-z0-9]+', '-', 'g')), ''), 'negocio'), 50);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM "Business" WHERE "slug" = candidate AND "id" <> business_id) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION business_slug_trigger() RETURNS trigger AS $$
BEGIN
  IF NEW."slug" IS NULL THEN
    NEW."slug" := make_business_slug(NEW."name", NEW."id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_slug_before_insert
BEFORE INSERT ON "Business"
FOR EACH ROW EXECUTE FUNCTION business_slug_trigger();

-- Negocios existentes, del más antiguo al más nuevo.
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT "id", "name" FROM "Business" WHERE "slug" IS NULL ORDER BY "createdAt", "id" LOOP
    UPDATE "Business" SET "slug" = make_business_slug(b."name", b."id") WHERE "id" = b."id";
  END LOOP;
END $$;
