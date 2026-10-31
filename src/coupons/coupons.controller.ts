import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
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
import { BusinessesService } from '../businesses/businesses.service.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { COUPON_IMAGE_ROUTE } from '../common/public-url.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from '../storage/image-upload.js';
import { CouponImagesService } from './coupon-images.service.js';
import { CouponsService } from './coupons.service.js';
import {
  CouponCardPageDto,
  CouponCardsQueryDto,
  CouponDto,
  CouponRedemptionDto,
  CreateCouponDto,
  CustomerCouponDto,
  PlayerCouponDto,
  PublicCouponDto,
  RedeemCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto.js';

@ApiTags('business / coupons')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business')
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly images: CouponImagesService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get('coupons')
  @ApiOperation({ summary: 'Cupones del negocio' })
  async findAll(@CurrentUser() user: AuthPayload): Promise<CouponDto[]> {
    return this.coupons.findAll(
      await this.businesses.requireBusinessId(user.sub),
    );
  }

  @Post('coupons')
  @ApiOperation({
    summary: 'Crear un cupón: cada N reservas, cancha gratis o un porcentaje',
  })
  async create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateCouponDto,
  ): Promise<CouponDto> {
    return this.coupons.create(
      await this.businesses.requireBusinessId(user.sub),
      dto,
    );
  }

  @Get('coupons/:id')
  @ApiOperation({ summary: 'Detalle de un cupón' })
  async findOne(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CouponDto> {
    return this.coupons.findOne(
      await this.businesses.requireBusinessId(user.sub),
      id,
    );
  }

  @Get('coupons/:id/cards')
  @ApiOperation({
    summary:
      'Tarjetas del cupón: quién redimió y a qué hora, y cuándo se llenó cada reserva',
  })
  async cards(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CouponCardsQueryDto,
  ): Promise<CouponCardPageDto> {
    return this.coupons.cards(
      await this.businesses.requireBusinessId(user.sub),
      id,
      query,
    );
  }

  @Patch('coupons/:id')
  @ApiOperation({
    summary:
      'Editar nombre, premio, vencimiento o límite, o activar/desactivar',
  })
  async update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ): Promise<CouponDto> {
    return this.coupons.update(
      await this.businesses.requireBusinessId(user.sub),
      id,
      dto,
    );
  }

  @Put('coupons/:id/image')
  @ApiOperation({
    summary: 'Poner o reemplazar la imagen del cupón (JPG o PNG, máx. 4 MB)',
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
  async setImage(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<CouponDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    await this.images.set(businessId, id, file);
    return this.coupons.findOne(businessId, id);
  }

  @Delete('coupons/:id/image')
  @ApiOperation({ summary: 'Quitar la imagen del cupón' })
  async removeImage(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CouponDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    await this.images.remove(businessId, id);
    return this.coupons.findOne(businessId, id);
  }

  @Get('customers/:customerId/coupons')
  @ApiOperation({
    summary:
      'Avance del cliente en cada cupón, con el historial de sus reservas',
  })
  async forCustomer(
    @CurrentUser() user: AuthPayload,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<CustomerCouponDto[]> {
    return this.coupons.forCustomer(
      await this.businesses.requireBusinessId(user.sub),
      customerId,
    );
  }

  @Post('reservations/:id/coupon-redemption')
  @ApiOperation({ summary: 'Redimir un bono al cobrar la reserva en persona' })
  async redeem(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RedeemCouponDto,
  ): Promise<CouponRedemptionDto> {
    return this.coupons.redeem(
      await this.businesses.requireBusinessId(user.sub),
      id,
      dto,
    );
  }
}

@ApiTags('player / coupons')
@ApiBearerAuth()
@Roles([UserRole.JUGADOR])
@Controller('player/coupons')
export class PlayerCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'Mi avance en los cupones de cada negocio' })
  findMine(@CurrentUser() user: AuthPayload): Promise<PlayerCouponDto[]> {
    return this.coupons.forPlayer(user.sub);
  }
}

@ApiTags('public / reservas en línea')
@Controller('public/businesses')
export class PublicCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Public()
  @Get(':slug/coupons')
  @ApiOperation({ summary: 'Cupones que ofrece el negocio' })
  findForBusiness(@Param('slug') slug: string): Promise<PublicCouponDto[]> {
    return this.coupons.publicForBusiness(slug);
  }
}

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Las imágenes de los cupones son públicas: se ven en la página de cada sede. */
@ApiTags('images')
@Controller(COUPON_IMAGE_ROUTE)
export class CouponImagesController {
  constructor(private readonly images: CouponImagesService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Imagen de un cupón (pública)' })
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
