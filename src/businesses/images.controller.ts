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
import { BUSINESS_IMAGE_ROUTE } from '../common/public-url.js';
import { BusinessImagesService } from './business-images.service.js';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

@ApiTags('images')
@Controller(BUSINESS_IMAGE_ROUTE)
export class ImagesController {
  constructor(private readonly imagesService: BusinessImagesService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Foto de portada de un negocio (pública)' })
  // El id cambia con cada foto nueva, así que la respuesta nunca caduca y el
  // CDN de Vercel la sirve sin volver a pedirla a Koofr.
  @Header('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const image = await this.imagesService.read(id);
    return new StreamableFile(image.data, {
      type: image.contentType,
      length: image.data.length,
    });
  }
}
