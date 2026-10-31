-- Imagen opcional del cupón.
ALTER TABLE "Coupon" ADD COLUMN "imageId" TEXT,
ADD COLUMN "imagePath" TEXT,
ADD COLUMN "imageContentType" TEXT;

CREATE UNIQUE INDEX "Coupon_imageId_key" ON "Coupon"("imageId");
