import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { MAX_IMAGE_BYTES } from '../storage/image-upload.js';
import { BusinessImagesService } from './business-images.service.js';
import { BusinessesService } from './businesses.service.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function image(bytes: number[], size = 1024) {
  return { buffer: Buffer.from([...bytes, 0, 0, 0]), size };
}

describe('BusinessImagesService', () => {
  let service: BusinessImagesService;
  let prisma: PrismaMock;
  const storage = { put: vi.fn(), get: vi.fn(), delete: vi.fn() };
  const businesses = {
    requireBusinessId: vi.fn().mockResolvedValue('biz-1'),
    findMine: vi.fn().mockResolvedValue({ id: 'biz-1' }),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    storage.put.mockReset();
    storage.get.mockReset();
    storage.delete.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BusinessImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: BusinessesService, useValue: businesses },
        { provide: FileStorage, useValue: storage },
        {
          provide: ConfigService,
          useValue: new ConfigService({ STORAGE_ROOT: 'mi-cancha' }),
        },
      ],
    }).compile();
    service = moduleRef.get(BusinessImagesService);
  });

  describe('upload', () => {
    it('guarda el PNG en la carpeta del negocio y borra la foto anterior', async () => {
      prisma.businessProfileImage.findUnique.mockResolvedValue({
        storagePath: 'mi-cancha/business-profile/biz-1/vieja.jpg',
      });

      await service.upload('owner-1', image(PNG_MAGIC));

      const [path, , contentType] = storage.put.mock.calls[0];
      expect(path).toMatch(
        /^mi-cancha\/business-profile\/biz-1\/[0-9a-f-]{36}\.png$/,
      );
      expect(contentType).toBe('image/png');
      expect(prisma.businessProfileImage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-1' },
          create: expect.objectContaining({
            businessId: 'biz-1',
            storagePath: path,
            sizeBytes: 1024,
          }),
        }),
      );
      expect(storage.delete).toHaveBeenCalledWith(
        'mi-cancha/business-profile/biz-1/vieja.jpg',
      );
    });

    it('reconoce el JPG por su firma', async () => {
      prisma.businessProfileImage.findUnique.mockResolvedValue(null);

      await service.upload('owner-1', image([0xff, 0xd8, 0xff, 0xe0]));

      expect(storage.put.mock.calls[0][0]).toMatch(/\.jpg$/);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('rechaza archivos que no son JPG ni PNG, aunque digan serlo', async () => {
      await expect(
        service.upload('owner-1', image([0x47, 0x49, 0x46, 0x38])),
      ).rejects.toThrow(BadRequestException);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rechaza la petición sin archivo o demasiado grande', async () => {
      await expect(service.upload('owner-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.upload('owner-1', image(PNG_MAGIC, MAX_IMAGE_BYTES + 1)),
      ).rejects.toThrow(BadRequestException);
    });

    it('borra el archivo subido si falla la base de datos', async () => {
      prisma.businessProfileImage.upsert.mockRejectedValue(new Error('db'));

      await expect(service.upload('owner-1', image(PNG_MAGIC))).rejects.toThrow(
        'db',
      );
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });
  });

  it('remove borra el registro y el archivo', async () => {
    prisma.businessProfileImage.findUnique.mockResolvedValue({
      id: 'img-1',
      storagePath: 'mi-cancha/business-profile/biz-1/img-1.png',
    });

    await service.remove('owner-1');

    expect(prisma.businessProfileImage.delete).toHaveBeenCalledWith({
      where: { id: 'img-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith(
      'mi-cancha/business-profile/biz-1/img-1.png',
    );
  });

  describe('read', () => {
    it('devuelve el contenido con su tipo', async () => {
      prisma.businessProfileImage.findUnique.mockResolvedValue({
        storagePath: 'x.png',
        contentType: 'image/png',
      });
      storage.get.mockResolvedValue(Buffer.from('png'));

      await expect(service.read('img-1')).resolves.toEqual({
        data: Buffer.from('png'),
        contentType: 'image/png',
      });
    });

    it('lanza 404 si no está en la base o en el almacenamiento', async () => {
      prisma.businessProfileImage.findUnique.mockResolvedValue(null);
      await expect(service.read('img-x')).rejects.toThrow(NotFoundException);

      prisma.businessProfileImage.findUnique.mockResolvedValue({
        storagePath: 'x.png',
        contentType: 'image/png',
      });
      storage.get.mockResolvedValue(null);
      await expect(service.read('img-1')).rejects.toThrow(NotFoundException);
    });
  });
});
