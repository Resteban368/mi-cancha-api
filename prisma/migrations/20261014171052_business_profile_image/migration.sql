-- CreateTable
CREATE TABLE "BusinessProfileImage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfileImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfileImage_businessId_key" ON "BusinessProfileImage"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessProfileImage" ADD CONSTRAINT "BusinessProfileImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
