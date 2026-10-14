-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "CourtPhotoSlot" AS ENUM ('MAIN', 'SURFACE', 'LIGHTING', 'EXTRA_1', 'EXTRA_2');

-- AlterTable
-- Se renombran (no se borran) para conservar los datos de las canchas existentes.
ALTER TABLE "Court" RENAME COLUMN "active" TO "isActive";
ALTER TABLE "Court" RENAME COLUMN "hourlyPrice" TO "basePricePerHour";
ALTER TABLE "Court" ALTER COLUMN "basePricePerHour" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "Court" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'COP',
ADD COLUMN     "isCovered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slotDuration" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CourtSchedule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,

    CONSTRAINT "CourtSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtRate" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerHour" DECIMAL(12,2) NOT NULL,
    "days" "DayOfWeek"[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourtRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtPhoto" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "slot" "CourtPhotoSlot" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourtSchedule_courtId_dayOfWeek_key" ON "CourtSchedule"("courtId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "CourtRate_courtId_idx" ON "CourtRate"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtPhoto_courtId_slot_key" ON "CourtPhoto"("courtId", "slot");

-- AddForeignKey
ALTER TABLE "CourtSchedule" ADD CONSTRAINT "CourtSchedule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtRate" ADD CONSTRAINT "CourtRate_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtPhoto" ADD CONSTRAINT "CourtPhoto_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las canchas existentes quedan abiertas todos los días de 06:00 a 23:00.
INSERT INTO "CourtSchedule" ("id", "courtId", "dayOfWeek", "isOpen", "openTime", "closeTime")
SELECT gen_random_uuid(), c."id", d."day", true, '06:00', '23:00'
FROM "Court" c
CROSS JOIN unnest(enum_range(NULL::"DayOfWeek")) AS d("day");
