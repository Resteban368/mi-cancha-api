-- AlterTable
ALTER TABLE "Court" ADD COLUMN     "lengthMeters" DECIMAL(5,2),
ADD COLUMN     "playersPerSide" INTEGER,
ADD COLUMN     "surfaceId" TEXT,
ADD COLUMN     "widthMeters" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "CourtSurface" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sports" "Sport"[] DEFAULT ARRAY[]::"Sport"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtSurface_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourtSurface_code_key" ON "CourtSurface"("code");

-- CreateIndex
CREATE INDEX "Court_surfaceId_idx" ON "Court"("surfaceId");

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "CourtSurface"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Medidas: las dos o ninguna, entre 1 y 200 m. Formato: 1 a 11 jugadores por equipo.
ALTER TABLE "Court" ADD CONSTRAINT "Court_dimensions_check" CHECK (
  ("lengthMeters" IS NULL AND "widthMeters" IS NULL)
  OR ("lengthMeters" BETWEEN 1 AND 200 AND "widthMeters" BETWEEN 1 AND 200)
);
ALTER TABLE "Court" ADD CONSTRAINT "Court_playersPerSide_check" CHECK (
  "playersPerSide" IS NULL OR "playersPerSide" BETWEEN 1 AND 11
);
