import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FileStorage } from '../storage/file-storage.js';
import { CouponImagesService } from './coupon-images.service.js';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

describe('CouponImagesService', () => {
  let prisma: PrismaMock;
  let storage: {
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: CouponImagesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    storage = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new CouponImagesService(
      prisma as unknown as PrismaService,
      storage as unknown as FileStorage,
      { getOrThrow: () => 'root' } as unknown as ConfigService,
    );
  });

  it('reemplaza la imagen y borra la anterior', async () => {
    prisma.coupon.findFirst.mockResolvedValue({ imagePath: 'root/old.jpg' });
    await service.set('b-1', 'c-1', { buffer: JPG, size: JPG.length });
    expect(storage.put.mock.calls[0][0]).toMatch(
      /^root\/coupons\/c-1\/.+\.jpg$/,
    );
    expect(prisma.coupon.update.mock.calls[0][0].data.imageContentType).toBe(
      'image/jpeg',
    );
    expect(storage.delete).toHaveBeenCalledWith('root/old.jpg');
  });

  it('rechaza lo que no es JPG ni PNG', async () => {
    const buffer = Buffer.from('hola');
    await expect(
      service.set('b-1', 'c-1', { buffer, size: buffer.length }),
    ).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('no toca cupones de otro negocio', async () => {
    prisma.coupon.findFirst.mockResolvedValue(null);
    await expect(
      service.set('b-2', 'c-1', { buffer: JPG, size: JPG.length }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove('b-2', 'c-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('quita la imagen del cupón y del almacenamiento', async () => {
    prisma.coupon.findFirst.mockResolvedValue({ imagePath: 'root/a.jpg' });
    await service.remove('b-1', 'c-1');
    expect(prisma.coupon.update.mock.calls[0][0].data.imageId).toBeNull();
    expect(storage.delete).toHaveBeenCalledWith('root/a.jpg');
  });

  it('una imagen que no existe responde 404', async () => {
    prisma.coupon.findUnique.mockResolvedValue(null);
    await expect(service.read('x')).rejects.toThrow(NotFoundException);
  });
});
