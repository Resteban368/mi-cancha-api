import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from '../storage/image-upload.js';
import { BusinessImagesService } from './business-images.service.js';
import { BusinessesService } from './businesses.service.js';
import {
  BusinessDto,
  ReorderPhotosDto,
  SaveBusinessDto,
} from './dto/business.dto.js';

@ApiTags('business / profile')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/profile')
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly imagesService: BusinessImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Perfil del negocio (404 si aún no existe)' })
  findMine(@CurrentUser() user: AuthPayload): Promise<BusinessDto> {
    return this.businessesService.findMine(user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Crear o actualizar el perfil del negocio' })
  save(
    @CurrentUser() user: AuthPayload,
    @Body() dto: SaveBusinessDto,
  ): Promise<BusinessDto> {
    return this.businessesService.save(user.sub, dto);
  }

  @Put('image')
  @ApiOperation({
    summary: 'Reemplazar la portada, la primera foto (JPG o PNG, máx. 4 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  // Más de 4 MB → 413 (multer corta la subida sin leerla completa).
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  uploadImage(
    @CurrentUser() user: AuthPayload,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<BusinessDto> {
    return this.imagesService.upload(user.sub, file);
  }

  @Post('photos')
  @ApiOperation({
    summary: 'Agregar una foto al negocio (hasta 5; JPG o PNG, máx. 4 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  addPhoto(
    @CurrentUser() user: AuthPayload,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<BusinessDto> {
    return this.imagesService.add(user.sub, file);
  }

  @Put('photos/order')
  @ApiOperation({
    summary: 'Ordenar las fotos; la primera es la portada del directorio',
  })
  sortPhotos(
    @CurrentUser() user: AuthPayload,
    @Body() dto: ReorderPhotosDto,
  ): Promise<BusinessDto> {
    return this.imagesService.sort(user.sub, dto.ids);
  }

  @Delete('photos/:photoId')
  @ApiOperation({ summary: 'Quitar una foto del negocio' })
  removePhoto(
    @CurrentUser() user: AuthPayload,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<BusinessDto> {
    return this.imagesService.delete(user.sub, photoId);
  }

  @Delete('image')
  @ApiOperation({ summary: 'Quitar la foto de portada' })
  removeImage(@CurrentUser() user: AuthPayload): Promise<BusinessDto> {
    return this.imagesService.remove(user.sub);
  }
}
