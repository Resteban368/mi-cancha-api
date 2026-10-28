-- Categoría de los productos (define su ícono en la app).
-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('AGUA', 'BEBIDA', 'HIDRATANTE', 'CERVEZA', 'SNACK', 'COMIDA', 'ALQUILER', 'OTRO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'OTRO';

