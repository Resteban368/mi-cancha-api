import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator.js';
import { NOTIFICATION_IMAGE_ROUTE } from '../common/public-url.js';
import { NotificationImagesService } from './notification-images.service.js';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Las imágenes de los avisos son públicas: el navegador las descarga al mostrar la notificación. */
@ApiTags('images')
@Controller(NOTIFICATION_IMAGE_ROUTE)
export class NotificationImagesController {
  constructor(private readonly images: NotificationImagesService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Imagen de un aviso (pública)' })
  // El id cambia con cada imagen, así que la respuesta nunca caduca.
  @Header('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const image = await this.images.read(id);
    return new StreamableFile(image.data, {
      type: image.contentType,
      length: image.data.length,
    });
  }
}
