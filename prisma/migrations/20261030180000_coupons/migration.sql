-- CreateEnum
CREATE TYPE "CouponRewardType" AS ENUM ('FREE_COURT', 'PERCENT');

-- CreateEnum
CREATE TYPE "CouponCardStatus" AS ENUM ('IN_PROGRESS', 'EARNED', 'REDEEMED');

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredReservations" INTEGER NOT NULL,
    "rewardType" "CouponRewardType" NOT NULL,
    "percent" INTEGER,
    "rewardDescription" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponCard" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "status" "CouponCardStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "earnedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redemptionKey" TEXT,
    "redeemedCourts" INTEGER,
    "redeemedAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponStamp" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "reservationKey" TEXT NOT NULL,
    "reservationId" TEXT,
    "courts" INTEGER NOT NULL,
    "courtNames" TEXT[],
    "amount" DECIMAL(12,2) NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponStamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Coupon_businessId_isActive_idx" ON "Coupon"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCard_redemptionKey_key" ON "CouponCard"("redemptionKey");

-- CreateIndex
CREATE INDEX "CouponCard_customerId_status_idx" ON "CouponCard"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCard_couponId_customerId_cycle_key" ON "CouponCard"("couponId", "customerId", "cycle");

-- CreateIndex
CREATE INDEX "CouponStamp_cardId_idx" ON "CouponStamp"("cardId");

-- CreateIndex
CREATE INDEX "CouponStamp_reservationKey_idx" ON "CouponStamp"("reservationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CouponStamp_couponId_reservationKey_key" ON "CouponStamp"("couponId", "reservationKey");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCard" ADD CONSTRAINT "CouponCard_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCard" ADD CONSTRAINT "CouponCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponStamp" ADD CONSTRAINT "CouponStamp_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponStamp" ADD CONSTRAINT "CouponStamp_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CouponCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponStamp" ADD CONSTRAINT "CouponStamp_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

