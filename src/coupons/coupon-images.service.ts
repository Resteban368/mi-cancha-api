import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { type UploadedImage, validateImage } from '../storage/image-upload.js';

/** Carpeta de las imágenes de cupones dentro de STORAGE_ROOT. */
const FOLDER = 'coupons';

/** Imagen opcional del cupón: cada subida tiene su id, para que la URL nunca caduque. */
@Injectable()
export class CouponImagesService {
  private readonly logger = new Logger(CouponImagesService.name);
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    config: ConfigService,
  ) {
    this.root = config.getOrThrow<string>('STORAGE_ROOT');
  }

  /** Pone o reemplaza la imagen (JPG o PNG, máx. 4 MB). */
  async set(
    businessId: string,
    couponId: string,
    file: UploadedImage | undefined,
  ): Promise<void> {
    const upload = validateImage(file);
    const coupon = await this.requireCoupon(businessId, couponId);
    const imageId = randomUUID();
    const imagePath = `${this.root}/${FOLDER}/${couponId}/${imageId}.${upload.extension}`;
    await this.storage.put(imagePath, upload.buffer, upload.contentType);
    try {
      await this.prisma.coupon.update({
        where: { id: couponId },
        data: { imageId, imagePath, imageContentType: upload.contentType },
      });
    } catch (error) {
      await this.deleteQuietly(imagePath);
      throw error;
    }
    if (coupon.imagePath) await this.deleteQuietly(coupon.imagePath);
  }

  async remove(businessId: string, couponId: string): Promise<void> {
    const coupon = await this.requireCoupon(businessId, couponId);
    if (!coupon.imagePath) return;
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { imageId: null, imagePath: null, imageContentType: null },
    });
    await this.deleteQuietly(coupon.imagePath);
  }

  /** Contenido de la imagen para servirla públicamente. */
  async read(imageId: string): Promise<{ data: Buffer; contentType: string }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { imageId },
      select: { imagePath: true, imageContentType: true },
    });
    const data =
      coupon?.imagePath && (await this.storage.get(coupon.imagePath));
    if (!data || !coupon?.imageContentType) {
      throw new NotFoundException('Imagen no encontrada');
    }
    return { data, contentType: coupon.imageContentType };
  }

  private async requireCoupon(businessId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, businessId },
      select: { imagePath: true },
    });
    if (!coupon) throw new NotFoundException('El cupón no existe');
    return coupon;
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
