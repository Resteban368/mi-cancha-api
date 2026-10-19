import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { notificationImageUrl, publicApiUrl } from '../common/public-url.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { type UploadedImage, validateImage } from '../storage/image-upload.js';

/** Carpeta de las imágenes de avisos dentro de STORAGE_ROOT. */
const FOLDER = 'notifications';

export interface UploadedNotificationImage {
  id: string;
  url: string;
}

export interface StoredNotificationImage {
  data: Buffer;
  contentType: string;
}

/** Imágenes de los avisos: se guardan en el almacenamiento de imágenes y se sirven por URL pública. */
@Injectable()
export class NotificationImagesService {
  private readonly logger = new Logger(NotificationImagesService.name);
  private readonly root: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    config: ConfigService,
  ) {
    this.root = config.getOrThrow<string>('STORAGE_ROOT');
    this.origin = publicApiUrl(config);
  }

  /** Guarda la imagen (JPG o PNG, máx. 4 MB) y devuelve su id y su URL pública. */
  async upload(
    file: UploadedImage | undefined,
  ): Promise<UploadedNotificationImage> {
    const upload = validateImage(file);
    const id = randomUUID();
    const storagePath = `${this.root}/${FOLDER}/${id}.${upload.extension}`;
    await this.storage.put(storagePath, upload.buffer, upload.contentType);
    try {
      await this.prisma.notificationImage.create({
        data: {
          id,
          storagePath,
          contentType: upload.contentType,
          sizeBytes: upload.size,
        },
      });
    } catch (error) {
      await this.deleteQuietly(storagePath);
      throw error;
    }
    return { id, url: notificationImageUrl(this.origin, id) };
  }

  /** Borra una imagen que todavía no se usó en ningún aviso (p. ej. el admin la quitó antes de enviar). */
  async removeUnused(id: string): Promise<void> {
    const image = await this.prisma.notificationImage.findUnique({
      where: { id },
      select: { storagePath: true },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');
    const used = await this.prisma.notificationBroadcast.count({
      where: { imageId: id },
    });
    if (used > 0) {
      throw new ConflictException('La imagen ya se usó en un aviso enviado');
    }
    await this.prisma.notificationImage.delete({ where: { id } });
    await this.deleteQuietly(image.storagePath);
  }

  /** Contenido de la imagen para servirla públicamente. */
  async read(id: string): Promise<StoredNotificationImage> {
    const image = await this.prisma.notificationImage.findUnique({
      where: { id },
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
