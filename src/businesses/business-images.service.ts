import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { type UploadedImage, validateImage } from '../storage/image-upload.js';
import { BusinessesService } from './businesses.service.js';
import { BusinessDto } from './dto/business.dto.js';

/** Carpeta de las fotos de perfil dentro de STORAGE_ROOT. */
const PROFILE_FOLDER = 'business-profile';

export interface StoredImage {
  data: Buffer;
  contentType: string;
}

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
    const upload = validateImage(file);
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const id = randomUUID();
    const storagePath = `${this.root}/${PROFILE_FOLDER}/${businessId}/${id}.${upload.extension}`;
    await this.storage.put(storagePath, upload.buffer, upload.contentType);

    const image = {
      id,
      storagePath,
      contentType: upload.contentType,
      sizeBytes: upload.size,
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
