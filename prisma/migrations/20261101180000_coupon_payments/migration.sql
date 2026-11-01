-- Registro de los bonos usados para pagar reservas. No es dinero: no entra en "Payment".
CREATE TABLE "CouponPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reservationId" TEXT,
    "reservationKey" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "couponName" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rewardType" "CouponRewardType" NOT NULL,
    "percent" INTEGER,
    "courts" INTEGER,
    "customerName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "CouponPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CouponPayment_businessId_createdAt_idx" ON "CouponPayment"("businessId", "createdAt");
CREATE INDEX "CouponPayment_reservationKey_idx" ON "CouponPayment"("reservationKey");

ALTER TABLE "CouponPayment" ADD CONSTRAINT "CouponPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponPayment" ADD CONSTRAINT "CouponPayment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
