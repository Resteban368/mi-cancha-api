-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "imageId" TEXT;

-- AlterTable
ALTER TABLE "NotificationBroadcast" ADD COLUMN     "imageId" TEXT;

-- CreateTable
CREATE TABLE "NotificationImage" (
    "id" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_imageId_idx" ON "Notification"("imageId");

-- AddForeignKey
ALTER TABLE "NotificationBroadcast" ADD CONSTRAINT "NotificationBroadcast_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "NotificationImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "NotificationImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
