import { ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { Customer } from '../generated/prisma/client.js';
import { ensurePlayerAccount } from './customer-account.js';

const customer = {
  id: 'cus-1',
  businessId: 'biz-1',
  name: 'Laura Gómez',
  phone: '+573115550001',
  documentId: '1075111222',
  userId: null,
} as Customer;

describe('ensurePlayerAccount', () => {
  let prisma: PrismaMock;
  let db: Parameters<typeof ensurePlayerAccount>[0];

  beforeEach(() => {
    prisma = createPrismaMock();
    db = prisma as unknown as typeof db;
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-new' });
    prisma.customer.update.mockImplementation(({ data }) => ({
      ...customer,
      ...data,
    }));
  });

  it('crea la cuenta con la cédula como clave inicial y la obliga a cambiarla', async () => {
    const result = await ensurePlayerAccount(db, customer);

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data).toMatchObject({
      role: 'JUGADOR',
      displayName: 'Laura Gómez',
      phone: '+573115550001',
      documentId: '1075111222',
      mustChangePassword: true,
    });
    expect(data.dataConsentAt).toBeUndefined();
    await expect(bcrypt.compare('1075111222', data.passwordHash)).resolves.toBe(
      true,
    );
    expect(result.userId).toBe('user-new');
  });

  it('si el celular ya tiene cuenta solo la vincula, sin tocar su clave', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(null);

    const result = await ensurePlayerAccount(db, customer);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { userId: 'user-1' },
    });
    expect(result.userId).toBe('user-1');
  });

  it('si la cédula ya tiene cuenta (con otro celular) también la vincula', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-2' });

    const result = await ensurePlayerAccount(db, customer);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.userId).toBe('user-2');
  });

  it('celular y cédula de cuentas distintas: avisa al negocio', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce({ id: 'user-2' });

    await expect(ensurePlayerAccount(db, customer)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('no vincula si la cuenta ya tiene otro cliente en la sede', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(null);
    prisma.customer.findUnique.mockResolvedValue({ id: 'otro' });

    const result = await ensurePlayerAccount(db, customer);

    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(result.userId).toBeNull();
  });

  it('no hace nada si el cliente ya tiene cuenta o no tiene cédula', async () => {
    expect(await ensurePlayerAccount(db, { ...customer, userId: 'u' })).toEqual(
      { ...customer, userId: 'u' },
    );
    await ensurePlayerAccount(db, { ...customer, documentId: null });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
