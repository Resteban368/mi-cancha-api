-- Turnos de caja: apertura con base de efectivo y cierre con arqueo.
-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "openingCash" DECIMAL(12,2) NOT NULL,
    "openingNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT,
    "openedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "expectedCash" DECIMAL(12,2),
    "countedCash" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "closingNote" TEXT,
    "summary" JSONB,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_businessId_openedAt_idx" ON "CashSession"("businessId", "openedAt");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Solo una caja abierta por negocio.
CREATE UNIQUE INDEX "CashSession_one_open_per_business" ON "CashSession"("businessId") WHERE "closedAt" IS NULL;
