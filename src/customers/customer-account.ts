import { ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';

type Db = Pick<Prisma.TransactionClient, 'customer' | 'user'>;

const BCRYPT_ROUNDS = 12;

/**
 * Cuenta de jugador para un cliente que registró un negocio, para que pueda ingresar a la web de
 * reservas con su celular o cédula. Si el celular o la cédula ya tienen cuenta, solo se vincula
 * (su clave no cambia); si no, se crea con la cédula como clave inicial y la obligación de
 * cambiarla —y de aceptar la política de datos— en su primer ingreso.
 */
export async function ensurePlayerAccount(
  db: Db,
  customer: Customer,
): Promise<Customer> {
  if (customer.userId || !customer.documentId) return customer;

  const [byPhone, byDocument] = await Promise.all([
    db.user.findUnique({
      where: {
        role_phone: { role: UserRole.JUGADOR, phone: customer.phone },
      },
    }),
    db.user.findUnique({ where: { documentId: customer.documentId } }),
  ]);
  if (byPhone && byDocument && byPhone.id !== byDocument.id) {
    throw new ConflictException(
      'El celular y la cédula ya pertenecen a cuentas de jugador distintas: revisa los datos del cliente',
    );
  }

  const existing = byPhone ?? byDocument;
  if (existing) {
    // Un jugador tiene un solo cliente por sede.
    const linked = await db.customer.findUnique({
      where: {
        businessId_userId: {
          businessId: customer.businessId,
          userId: existing.id,
        },
      },
      select: { id: true },
    });
    if (linked) return customer;
    return db.customer.update({
      where: { id: customer.id },
      data: { userId: existing.id },
    });
  }

  const user = await db.user.create({
    data: {
      role: UserRole.JUGADOR,
      displayName: customer.name,
      phone: customer.phone,
      documentId: customer.documentId,
      passwordHash: await bcrypt.hash(customer.documentId, BCRYPT_ROUNDS),
      mustChangePassword: true,
    },
  });
  return db.customer.update({
    where: { id: customer.id },
    data: { userId: user.id },
  });
}
