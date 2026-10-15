-- Búsqueda de clientes por fragmentos de nombre, teléfono o cédula.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Customer_documentId_idx" ON "Customer" USING GIN ("documentId" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Reservation_customerId_status_idx" ON "Reservation"("customerId", "status");

