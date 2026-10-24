-- Un negocio pasa de tener 1 foto a hasta 5; la de position 0 es la portada.
DROP INDEX "BusinessProfileImage_businessId_key";

ALTER TABLE "BusinessProfileImage" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "BusinessProfileImage_businessId_position_idx" ON "BusinessProfileImage"("businessId", "position");
