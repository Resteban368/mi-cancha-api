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
import {
  type UploadedImage,
  type ValidImage,
  validateImage,
} from '../storage/image-upload.js';
import { BusinessesService } from './businesses.service.js';
import { BusinessDto } from './dto/business.dto.js';

/** Máximo de fotos por negocio. */
export const MAX_BUSINESS_PHOTOS = 5;

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
   * Agrega una foto al final. Cada foto tiene un id nuevo, así la URL cambia y los
   * cachés nunca sirven la versión vieja.
   */
  async addForBusiness(
    businessId: string,
    file: UploadedImage | undefined,
  ): Promise<void> {
    const upload = validateImage(file);
    const stored = await this.store(businessId, upload);
    try {
      await this.prisma.$transaction(async (tx) => {
        const last = await tx.businessProfileImage.aggregate({
          where: { businessId },
          _count: true,
          _max: { position: true },
        });
        if (last._count >= MAX_BUSINESS_PHOTOS) {
          throw new BadRequestException(
            `Un negocio puede tener hasta ${MAX_BUSINESS_PHOTOS} fotos`,
          );
        }
        await tx.businessProfileImage.create({
          data: {
            ...stored.image,
            businessId,
            position: (last._max.position ?? -1) + 1,
          },
        });
      });
    } catch (error) {
      await this.deleteQuietly(stored.storagePath);
      throw error;
    }
  }

  /** Reemplaza la portada (la primera foto); si no hay fotos, la agrega. */
  async uploadForBusiness(
    businessId: string,
    file: UploadedImage | undefined,
  ): Promise<void> {
    const upload = validateImage(file);
    const stored = await this.store(businessId, upload);
    let previous: { storagePath: string } | null;
    try {
      previous = await this.prisma.$transaction(async (tx) => {
        const cover = await tx.businessProfileImage.findFirst({
          where: { businessId },
          orderBy: { position: 'asc' },
          select: { id: true, storagePath: true },
        });
        if (cover) {
          await tx.businessProfileImage.update({
            where: { id: cover.id },
            data: stored.image,
          });
        } else {
          await tx.businessProfileImage.create({
            data: { ...stored.image, businessId, position: 0 },
          });
        }
        return cover;
      });
    } catch (error) {
      await this.deleteQuietly(stored.storagePath);
      throw error;
    }

    if (previous) await this.deleteQuietly(previous.storagePath);
  }

  /** Quita una foto del negocio; las demás suben de lugar y la primera pasa a ser la portada. */
  async removePhoto(businessId: string, photoId: string): Promise<void> {
    const image = await this.prisma.businessProfileImage.findFirst({
      where: { id: photoId, businessId },
      select: { id: true, storagePath: true },
    });
    if (!image) throw new NotFoundException('Foto no encontrada');
    await this.prisma.businessProfileImage.delete({ where: { id: image.id } });
    await this.deleteQuietly(image.storagePath);
    await this.compact(businessId);
  }

  /** Quita la portada (la primera foto). */
  async removeForBusiness(businessId: string): Promise<void> {
    const cover = await this.prisma.businessProfileImage.findFirst({
      where: { businessId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (cover) await this.removePhoto(businessId, cover.id);
  }

  /** Reordena las fotos: `ids` debe traer todas las del negocio, la primera es la portada. */
  async reorder(businessId: string, ids: string[]): Promise<void> {
    const current = await this.prisma.businessProfileImage.findMany({
      where: { businessId },
      select: { id: true },
    });
    const same =
      ids.length === current.length &&
      new Set(ids).size === ids.length &&
      current.every((c) => ids.includes(c.id));
    if (!same) {
      throw new BadRequestException(
        'Envía todas las fotos del negocio, sin repetir, en el orden deseado',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.businessProfileImage.update({
          where: { id },
          data: { position },
        }),
      ),
    );
  }

  async add(
    ownerId: string,
    file: UploadedImage | undefined,
  ): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.addForBusiness(businessId, file);
    return this.businesses.findMine(ownerId);
  }

  async delete(ownerId: string, photoId: string): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.removePhoto(businessId, photoId);
    return this.businesses.findMine(ownerId);
  }

  async sort(ownerId: string, ids: string[]): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.reorder(businessId, ids);
    return this.businesses.findMine(ownerId);
  }

  /** Reemplaza la portada y devuelve el negocio (ruta heredada `PUT image`). */
  async upload(
    ownerId: string,
    file: UploadedImage | undefined,
  ): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.uploadForBusiness(businessId, file);
    return this.businesses.findMine(ownerId);
  }

  async remove(ownerId: string): Promise<BusinessDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    await this.removeForBusiness(businessId);
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

  private async store(businessId: string, upload: ValidImage) {
    const id = randomUUID();
    const storagePath = `${this.root}/${PROFILE_FOLDER}/${businessId}/${id}.${upload.extension}`;
    await this.storage.put(storagePath, upload.buffer, upload.contentType);
    return {
      storagePath,
      image: {
        id,
        storagePath,
        contentType: upload.contentType,
        sizeBytes: upload.size,
      },
    };
  }

  /** Deja las posiciones consecutivas (0, 1, 2…) tras borrar una foto. */
  private async compact(businessId: string): Promise<void> {
    const rows = await this.prisma.businessProfileImage.findMany({
      where: { businessId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    const stale = rows.filter((r, i) => r.position !== i);
    if (stale.length === 0) return;
    await this.prisma.$transaction(
      rows.flatMap((r, i) =>
        r.position === i
          ? []
          : [
              this.prisma.businessProfileImage.update({
                where: { id: r.id },
                data: { position: i },
              }),
            ],
      ),
    );
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
