import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { StoredImage } from '../businesses/business-images.service.js';
import { CourtPhotoSlot } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { type UploadedImage, validateImage } from '../storage/image-upload.js';
import { CourtsService } from './courts.service.js';
import { CourtDto } from './dto/court.dto.js';

/** Carpeta de las fotos de canchas dentro de STORAGE_ROOT. */
const COURTS_FOLDER = 'courts';

@Injectable()
export class CourtPhotosService {
  private readonly logger = new Logger(CourtPhotosService.name);
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly courts: CourtsService,
    private readonly storage: FileStorage,
    config: ConfigService,
  ) {
    this.root = config.getOrThrow<string>('STORAGE_ROOT');
  }

  /** Sube o reemplaza la foto de una posición. Cada foto nueva tiene id (y URL) nuevo. */
  async upload(
    ownerId: string,
    courtId: string,
    slot: CourtPhotoSlot,
    file: UploadedImage | undefined,
  ): Promise<CourtDto> {
    const upload = validateImage(file);
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const court = await this.courts.findOwnedCourt(businessId, courtId);

    const id = randomUUID();
    const storagePath = `${this.root}/${COURTS_FOLDER}/${court.id}/${id}.${upload.extension}`;
    await this.storage.put(storagePath, upload.buffer, upload.contentType);

    const photo = {
      id,
      storagePath,
      contentType: upload.contentType,
      sizeBytes: upload.size,
    };
    let previous: { storagePath: string } | null;
    try {
      previous = await this.prisma.$transaction(async (tx) => {
        const where = { courtId_slot: { courtId: court.id, slot } };
        const old = await tx.courtPhoto.findUnique({
          where,
          select: { storagePath: true },
        });
        await tx.courtPhoto.upsert({
          where,
          create: { ...photo, courtId: court.id, slot },
          update: photo,
        });
        return old;
      });
    } catch (error) {
      await this.deleteQuietly(storagePath);
      throw error;
    }

    if (previous) await this.deleteQuietly(previous.storagePath);
    return this.courts.findOne(ownerId, court.id);
  }

  async remove(
    ownerId: string,
    courtId: string,
    slot: CourtPhotoSlot,
  ): Promise<CourtDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const court = await this.courts.findOwnedCourt(businessId, courtId);
    const photo = await this.prisma.courtPhoto.findUnique({
      where: { courtId_slot: { courtId: court.id, slot } },
      select: { id: true, storagePath: true },
    });
    if (photo) {
      await this.prisma.courtPhoto.delete({ where: { id: photo.id } });
      await this.deleteQuietly(photo.storagePath);
    }
    return this.courts.findOne(ownerId, court.id);
  }

  /** Contenido de una foto para servirla públicamente. */
  async read(photoId: string): Promise<StoredImage> {
    const photo = await this.prisma.courtPhoto.findUnique({
      where: { id: photoId },
      select: { storagePath: true, contentType: true },
    });
    const data = photo && (await this.storage.get(photo.storagePath));
    if (!photo || !data) throw new NotFoundException('Imagen no encontrada');
    return { data, contentType: photo.contentType };
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
