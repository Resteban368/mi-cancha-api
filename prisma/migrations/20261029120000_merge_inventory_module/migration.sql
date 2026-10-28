-- Inventario queda dentro del módulo de Ventas (un solo interruptor).
-- AlterTable
ALTER TABLE "Business" DROP COLUMN "inventoryModuleEnabled",
DROP COLUMN "inventoryModuleEnabledAt";

