import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaMock, PrismaMock } from '../../test/support/prisma-mock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FileStorage } from '../storage/file-storage.js';
import { NotificationImagesService } from './notification-images.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('NotificationImagesService', () => {
  let prisma: PrismaMock;
  let service: NotificationImagesService;
  const storage = { put: vi.fn(), get: vi.fn(), delete: vi.fn() };

  beforeEach(() => {
    prisma = createPrismaMock();
    storage.put.mockReset().mockResolvedValue(undefined);
    storage.get.mockReset();
    storage.delete.mockReset().mockResolvedValue(undefined);
    service = new NotificationImagesService(
      prisma as unknown as PrismaService,
      storage as unknown as FileStorage,
      {
        getOrThrow: () => 'mi-cancha',
        get: (key: string) => (key === 'PUBLIC_API_URL' ? 'https://api.test' : undefined),
      } as unknown as ConfigService,
    );
  });

  it('sube la imagen al almacenamiento, la registra y devuelve su URL pública', async () => {
    const result = await service.upload({ buffer: PNG, size: PNG.length });

    const [path, data, type] = storage.put.mock.calls[0];
    expect(path).toMatch(/^mi-cancha\/notifications\/[0-9a-f-]{36}\.png$/);
    expect(data).toBe(PNG);
    expect(type).toBe('image/png');
    expect(prisma.notificationImage.create.mock.calls[0][0].data).toMatchObject({
      id: result.id,
      storagePath: path,
      contentType: 'image/png',
    });
    expect(result.url).toBe(`https://api.test/api/v1/images/notifications/${result.id}`);
  });

  it('rechaza lo que no es JPG o PNG, y no guarda nada', async () => {
    await expect(
      service.upload({ buffer: Buffer.from('GIF89a....'), size: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('si falla el registro en la base, borra el archivo que acababa de subir', async () => {
    prisma.notificationImage.create.mockRejectedValue(new Error('base caída'));
    await expect(service.upload({ buffer: PNG, size: PNG.length })).rejects.toThrow('base caída');
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });

  it('quita una imagen sin usar: registro y archivo', async () => {
    prisma.notificationImage.findUnique.mockResolvedValue({ storagePath: 'mi-cancha/notifications/x.png' });
    prisma.notificationBroadcast.count.mockResolvedValue(0);
    await service.removeUnused('img-1');
    expect(prisma.notificationImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
    expect(storage.delete).toHaveBeenCalledWith('mi-cancha/notifications/x.png');
  });

  it('no quita una imagen que ya se usó ni una que no existe', async () => {
    prisma.notificationImage.findUnique.mockResolvedValueOnce({ storagePath: 'p' });
    prisma.notificationBroadcast.count.mockResolvedValue(1);
    await expect(service.removeUnused('img-1')).rejects.toBeInstanceOf(ConflictException);

    prisma.notificationImage.findUnique.mockResolvedValueOnce(null);
    await expect(service.removeUnused('nada')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('sirve la imagen guardada o responde 404', async () => {
    prisma.notificationImage.findUnique.mockResolvedValue({ storagePath: 'p', contentType: 'image/png' });
    storage.get.mockResolvedValue(PNG);
    await expect(service.read('img-1')).resolves.toEqual({ data: PNG, contentType: 'image/png' });

    storage.get.mockResolvedValue(null);
    await expect(service.read('img-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
