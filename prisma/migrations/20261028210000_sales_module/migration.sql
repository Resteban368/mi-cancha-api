-- Módulo de Ventas por negocio (lo activa el super admin).
-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "salesModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesModuleEnabledAt" TIMESTAMP(3);

