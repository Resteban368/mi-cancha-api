-- Cuentas de jugador creadas por un negocio: la clave inicial es la cédula y debe cambiarse al ingresar.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
