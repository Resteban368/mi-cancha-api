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

  describe('upload (reemplaza la portada)', () => {
    it('guarda el PNG en la carpeta del negocio y borra la portada anterior', async () => {
      prisma.businessProfileImage.findFirst.mockResolvedValue({
        id: 'img-0',
        storagePath: 'mi-cancha/business-profile/biz-1/vieja.jpg',
      });

      await service.upload('owner-1', image(PNG_MAGIC));

      const [path, , contentType] = storage.put.mock.calls[0];
      expect(path).toMatch(
        /^mi-cancha\/business-profile\/biz-1\/[0-9a-f-]{36}\.png$/,
      );
      expect(contentType).toBe('image/png');
      expect(prisma.businessProfileImage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'img-0' },
          data: expect.objectContaining({ storagePath: path, sizeBytes: 1024 }),
        }),
      );
      expect(storage.delete).toHaveBeenCalledWith(
        'mi-cancha/business-profile/biz-1/vieja.jpg',
      );
    });

    it('si no hay fotos, la agrega como portada y reconoce el JPG por su firma', async () => {
      prisma.businessProfileImage.findFirst.mockResolvedValue(null);

      await service.upload('owner-1', image([0xff, 0xd8, 0xff, 0xe0]));

      expect(storage.put.mock.calls[0][0]).toMatch(/\.jpg$/);
      expect(prisma.businessProfileImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: 'biz-1', position: 0 }),
      });
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
      prisma.businessProfileImage.findFirst.mockResolvedValue(null);
      prisma.businessProfileImage.create.mockRejectedValue(new Error('db'));

      await expect(service.upload('owner-1', image(PNG_MAGIC))).rejects.toThrow(
        'db',
      );
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });
  });

  describe('add (hasta 5 fotos)', () => {
    it('agrega la foto al final', async () => {
      prisma.businessProfileImage.aggregate.mockResolvedValue({
        _count: 2,
        _max: { position: 1 },
      });

      await service.add('owner-1', image(PNG_MAGIC));

      expect(prisma.businessProfileImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: 'biz-1', position: 2 }),
      });
    });

    it('rechaza la sexta foto y borra el archivo subido', async () => {
      prisma.businessProfileImage.aggregate.mockResolvedValue({
        _count: 5,
        _max: { position: 4 },
      });

      await expect(service.add('owner-1', image(PNG_MAGIC))).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.businessProfileImage.create).not.toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });
  });

  describe('delete', () => {
    it('borra el registro y el archivo, y compacta las posiciones', async () => {
      prisma.businessProfileImage.findFirst.mockResolvedValue({
        id: 'img-1',
        storagePath: 'mi-cancha/business-profile/biz-1/img-1.png',
      });
      prisma.businessProfileImage.findMany.mockResolvedValue([
        { id: 'img-2', position: 1 },
        { id: 'img-3', position: 2 },
      ]);

      await service.delete('owner-1', 'img-1');

      expect(prisma.businessProfileImage.delete).toHaveBeenCalledWith({
        where: { id: 'img-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith(
        'mi-cancha/business-profile/biz-1/img-1.png',
      );
      expect(prisma.businessProfileImage.update).toHaveBeenCalledWith({
        where: { id: 'img-2' },
        data: { position: 0 },
      });
      expect(prisma.businessProfileImage.update).toHaveBeenCalledWith({
        where: { id: 'img-3' },
        data: { position: 1 },
      });
    });

    it('404 si la foto no es del negocio', async () => {
      prisma.businessProfileImage.findFirst.mockResolvedValue(null);
      await expect(service.delete('owner-1', 'otra')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.businessProfileImage.delete).not.toHaveBeenCalled();
    });
  });

  it('remove borra la portada (la primera foto)', async () => {
    prisma.businessProfileImage.findFirst
      .mockResolvedValueOnce({ id: 'img-1' })
      .mockResolvedValueOnce({ id: 'img-1', storagePath: 'x/img-1.png' });
    prisma.businessProfileImage.findMany.mockResolvedValue([]);

    await service.remove('owner-1');

    expect(prisma.businessProfileImage.delete).toHaveBeenCalledWith({
      where: { id: 'img-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith('x/img-1.png');
  });

  describe('sort', () => {
    beforeEach(() => {
      prisma.businessProfileImage.findMany.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ]);
    });

    it('guarda el nuevo orden; la primera es la portada', async () => {
      await service.sort('owner-1', ['c', 'a', 'b']);

      expect(prisma.businessProfileImage.update).toHaveBeenCalledWith({
        where: { id: 'c' },
        data: { position: 0 },
      });
      expect(prisma.businessProfileImage.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { position: 2 },
      });
    });

    it('rechaza ids que faltan, sobran o se repiten', async () => {
      for (const ids of [
        ['a', 'b'],
        ['a', 'b', 'x'],
        ['a', 'a', 'b'],
      ]) {
        await expect(service.sort('owner-1', ids)).rejects.toThrow(
          BadRequestException,
        );
      }
      expect(prisma.businessProfileImage.update).not.toHaveBeenCalled();
    });
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
