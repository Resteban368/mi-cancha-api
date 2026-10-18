-- CreateTable
CREATE TABLE "SlotHold" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "slots" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotHold_courtId_start_idx" ON "SlotHold"("courtId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "SlotHold_businessId_playerId_key" ON "SlotHold"("businessId", "playerId");

-- AddForeignKey
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
