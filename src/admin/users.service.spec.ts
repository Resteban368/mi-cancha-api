import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { createPrismaMock } from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DeleteUsersDto } from './dto/admin.dto.js';
import { UsersService } from './users.service.js';

const ID_A = '0082c56c-f0f6-4550-aa87-a7e9ea9cdfcf';
const ID_B = '5b2f7a0e-0d2c-4a58-9d57-2a2f1c3f8b11';

describe('UsersService.removePlayers', () => {
  it('borra solo cuentas de jugador y cuenta las ignoradas', async () => {
    const prisma = createPrismaMock();
    prisma.user.deleteMany.mockResolvedValue({ count: 1 });
    const service = new UsersService(prisma as unknown as PrismaService);

    await expect(service.removePlayers([ID_A, ID_B])).resolves.toEqual({
      deleted: 1,
      skipped: 1,
    });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [ID_A, ID_B] }, role: UserRole.JUGADOR },
    });
  });
});

describe('DeleteUsersDto', () => {
  const erroresDe = async (ids: unknown) =>
    (await validate(plainToInstance(DeleteUsersDto, { ids }))).length;

  it('acepta una lista de ids', async () => {
    expect(await erroresDe([ID_A, ID_B])).toBe(0);
  });

  it.each([[[]], [['no-es-uuid']], [[ID_A, ID_A]], [Array(101).fill(ID_A)], ['x']])(
    'rechaza una lista inválida',
    async (ids) => {
      expect(await erroresDe(ids)).toBeGreaterThan(0);
    },
  );
});
