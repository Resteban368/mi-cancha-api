import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FileStorage } from '../storage/file-storage.js';
import { CourtPhotosService } from './court-photos.service.js';
import type { CourtsService } from './courts.service.js';

describe('CourtPhotosService.removeForBusiness', () => {
  let prisma: PrismaMock;
  let service: CourtPhotosService;
  const storage = { put: vi.fn(), get: vi.fn(), delete: vi.fn() };
  const courts = {
    findOwnedCourt: vi.fn(),
    toDto: vi.fn((court: unknown) => court),
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    vi.clearAllMocks();
    service = new CourtPhotosService(
      prisma as unknown as PrismaService,
      {} as BusinessesService,
      courts as unknown as CourtsService,
      storage as unknown as FileStorage,
      new ConfigService({ STORAGE_ROOT: 'mi-cancha' }),
    );
    courts.findOwnedCourt.mockResolvedValue({ id: 'court-1', photos: [] });
  });

  it('borra el registro y el archivo de la foto de esa posición', async () => {
    prisma.courtPhoto.findUnique.mockResolvedValue({
      id: 'photo-1',
      storagePath: 'mi-cancha/courts/court-1/photo-1.jpg',
    });

    await service.removeForBusiness('biz-1', 'court-1', 'EXTRA_1');

    expect(courts.findOwnedCourt).toHaveBeenCalledWith('biz-1', 'court-1');
    expect(prisma.courtPhoto.findUnique).toHaveBeenCalledWith({
      where: { courtId_slot: { courtId: 'court-1', slot: 'EXTRA_1' } },
      select: { id: true, storagePath: true },
    });
    expect(prisma.courtPhoto.delete).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith(
      'mi-cancha/courts/court-1/photo-1.jpg',
    );
  });

  it('si la posición no tiene foto no borra nada', async () => {
    prisma.courtPhoto.findUnique.mockResolvedValue(null);

    await service.removeForBusiness('biz-1', 'court-1', 'MAIN');

    expect(prisma.courtPhoto.delete).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('no toca canchas de otro negocio', async () => {
    courts.findOwnedCourt.mockRejectedValue(new NotFoundException());

    await expect(
      service.removeForBusiness('otro', 'court-1', 'MAIN'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.courtPhoto.delete).not.toHaveBeenCalled();
  });
});
