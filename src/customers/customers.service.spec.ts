import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from './customers.service.js';

const input = {
  name: 'Laura Gómez',
  phone: '+57 311-555 0001',
  documentId: '1.075.111.222',
};

describe('CustomersService.resolve', () => {
  let prisma: PrismaMock;
  let service: CustomersService;
  let db: Parameters<CustomersService['resolve']>[0];

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
    db = prisma as unknown as typeof db;
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({
      id: 'c-new',
      ...data,
    }));
  });

  it('crea el cliente con teléfono y cédula normalizados', async () => {
    await service.resolve(db, 'biz-1', { customer: input });
    expect(prisma.customer.create.mock.calls[0][0].data).toEqual({
      businessId: 'biz-1',
      name: 'Laura Gómez',
      phone: '+573115550001',
      documentId: '1075111222',
    });
  });

  it('reutiliza el existente y conserva sus datos', async () => {
    const existing = { id: 'c-1', name: 'Laura', phone: '+573115550001' };
    prisma.customer.findUnique.mockResolvedValueOnce(existing);
    await expect(
      service.resolve(db, 'biz-1', {
        customer: { ...input, name: 'Otra' },
      }),
    ).resolves.toBe(existing);
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('rechaza teléfono y cédula de clientes distintos', async () => {
    prisma.customer.findUnique
      .mockResolvedValueOnce({ id: 'c-1', name: 'Laura' })
      .mockResolvedValueOnce({ id: 'c-2', name: 'Pedro' });
    await expect(
      service.resolve(db, 'biz-1', { customer: input }),
    ).rejects.toThrow(ConflictException);
  });

  it('busca por id dentro del negocio', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.resolve(db, 'biz-1', { customerId: 'c-x' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'c-x', businessId: 'biz-1' },
    });
  });
});
