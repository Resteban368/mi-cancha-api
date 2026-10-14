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
import { COURT_PHOTO_ROUTE } from '../common/public-url.js';
import { CourtPhotosService } from './court-photos.service.js';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

@ApiTags('images')
@Controller(COURT_PHOTO_ROUTE)
export class CourtPhotosController {
  constructor(private readonly photosService: CourtPhotosService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Foto de una cancha (pública)' })
  // El id cambia con cada foto nueva, así que la respuesta nunca caduca.
  @Header('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const photo = await this.photosService.read(id);
    return new StreamableFile(photo.data, {
      type: photo.contentType,
      length: photo.data.length,
    });
  }
}
