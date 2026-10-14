import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { BusinessesService } from './businesses.service.js';
import { BusinessDto } from './dto/business.dto.js';

/** Vercel corta los cuerpos en 4,5 MB: 4 MB deja margen para el multipart. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Carpeta de las fotos de perfil dentro de STORAGE_ROOT. */
const PROFILE_FOLDER = 'business-profile';

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

export interface StoredImage {
  data: Buffer;
  contentType: string;
}

/** Tipos aceptados, reconocidos por su firma y no por el nombre o el mimetype del cliente. */
const IMAGE_TYPES = [
  { contentType: 'image/jpeg', extension: 'jpg', magic: [0xff, 0xd8, 0xff] },
  {
    contentType: 'image/png',
    extension: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

@Injectable()
export class BusinessImagesService {
  private readonly logger = new Logger(BusinessImagesService.name);
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly storage: FileStorage,
    config: ConfigService,
  ) {
    this.root = config.getOrThrow<string>('STORAGE_ROOT');
  }

  /**
   * Sube la foto de portada y reemplaza la anterior. Cada foto tiene un id nuevo,
   * así la URL cambia y los cachés nunca sirven la versión vieja.
   */
  async upload(
    ownerId: string,
    file: UploadedImage | undefined,
  ): Promise<BusinessDto> {
    if (!file?.size) {
      throw new BadRequestException('Adjunta la imagen en el campo "image"');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('La imagen no puede superar 4 MB');
    }
    const type = IMAGE_TYPES.find(({ magic }) =>
      magic.every((byte, i) => file.buffer[i] === byte),
    );
    if (!type) {
      throw new BadRequestException('La imagen debe ser JPG o PNG');
    }

    const businessId = await this.businesses.requireBusinessId(ownerId);
    const id = randomUUID();
    const storagePath = `${this.root}/${PROFILE_FOLDER}/${businessId}/${id}.${type.extension}`;
    await this.storage.put(storagePath, file.buffer, type.contentType);

    const image = {
      id,
      storagePath,
      contentType: type.contentType,
      sizeBytes: file.size,
    };
    let previous: { storagePath: string } | null;
    try {
      previous = await this.prisma.$transaction(async (tx) => {
        const old = await tx.businessProfileImage.findUnique({
          where: { businessId },
          select: { storagePath: true },
        });
        await tx.businessProfileImage.upsert({
          where: { businessId },
          create: { ...image, businessId },
          update: image,
        });
        return old;
      });
    } catch (error) {
      await this.deleteQuietly(storagePath);
      throw error;
    }

    if (previous) await this.deleteQuietly(previous.storagePath);
    return this.businesses.findMine(ownerId);
  }

  async remove(ownerId: string): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const image = await this.prisma.businessProfileImage.findUnique({
      where: { businessId },
      select: { id: true, storagePath: true },
    });
    if (image) {
      await this.prisma.businessProfileImage.delete({
        where: { id: image.id },
      });
      await this.deleteQuietly(image.storagePath);
    }
    return this.businesses.findMine(ownerId);
  }

  /** Contenido de una foto para servirla públicamente. */
  async read(imageId: string): Promise<StoredImage> {
    const image = await this.prisma.businessProfileImage.findUnique({
      where: { id: imageId },
      select: { storagePath: true, contentType: true },
    });
    const data = image && (await this.storage.get(image.storagePath));
    if (!image || !data) throw new NotFoundException('Imagen no encontrada');
    return { data, contentType: image.contentType };
  }

  /** Un archivo huérfano en el almacenamiento no debe tumbar la petición. */
  private async deleteQuietly(path: string): Promise<void> {
    try {
      await this.storage.delete(path);
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${path}: ${String(error)}`);
    }
  }
}
