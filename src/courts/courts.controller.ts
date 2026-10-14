import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { CourtPhotoSlot, UserRole } from '../generated/prisma/enums.js';
import {
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from '../storage/image-upload.js';
import { CourtPhotosService } from './court-photos.service.js';
import { CourtsService } from './courts.service.js';
import { CourtDto, CreateCourtDto, UpdateCourtDto } from './dto/court.dto.js';

@ApiTags('business / courts')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/courts')
export class CourtsController {
  constructor(
    private readonly courtsService: CourtsService,
    private readonly photosService: CourtPhotosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar las canchas del negocio' })
  findAll(@CurrentUser() user: AuthPayload): Promise<CourtDto[]> {
    return this.courtsService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una cancha' })
  findOne(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourtDto> {
    return this.courtsService.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Crear una cancha con horarios y tarifas (respeta el límite del plan; las fotos se suben después)',
  })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateCourtDto,
  ): Promise<CourtDto> {
    return this.courtsService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Actualizar, activar o desactivar una cancha (schedules y rates reemplazan la lista completa)',
  })
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    return this.courtsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una cancha' })
  deactivate(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourtDto> {
    return this.courtsService.deactivate(user.sub, id);
  }

  @Put(':id/photos/:slot')
  @ApiOperation({
    summary:
      'Subir o reemplazar la foto de una posición (JPG o PNG, máx. 4 MB)',
  })
  @ApiParam({ name: 'slot', enum: CourtPhotoSlot })
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
  uploadPhoto(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', new ParseEnumPipe(CourtPhotoSlot)) slot: CourtPhotoSlot,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<CourtDto> {
    return this.photosService.upload(user.sub, id, slot, file);
  }

  @Delete(':id/photos/:slot')
  @ApiOperation({ summary: 'Quitar la foto de una posición' })
  @ApiParam({ name: 'slot', enum: CourtPhotoSlot })
  removePhoto(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', new ParseEnumPipe(CourtPhotoSlot)) slot: CourtPhotoSlot,
  ): Promise<CourtDto> {
    return this.photosService.remove(user.sub, id, slot);
  }
}
