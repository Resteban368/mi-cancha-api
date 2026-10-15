-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "preferredSport" "Sport";


-- Teléfonos colombianos de 10 dígitos sin indicativo: se guardan con +57 (WhatsApp).
UPDATE "Customer" SET "phone" = '+57' || "phone" WHERE "phone" ~ '^[0-9]{10}$';
