-- DropIndex
DROP INDEX "SlotHold_businessId_playerId_key";

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "ReservationGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationGroup_businessId_idx" ON "ReservationGroup"("businessId");

-- CreateIndex
CREATE INDEX "Reservation_groupId_idx" ON "Reservation"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotHold_businessId_playerId_courtId_key" ON "SlotHold"("businessId", "playerId", "courtId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReservationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGroup" ADD CONSTRAINT "ReservationGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

