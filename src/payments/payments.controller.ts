import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  CreatePaymentDto,
  PaymentDto,
  PaymentsQueryDto,
  RejectPaymentDto,
} from './dto/payment.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('business / payments')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pagos (filtrables por estado)' })
  findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: PaymentsQueryDto,
  ): Promise<PaymentDto[]> {
    return this.paymentsService.findAll(user.sub, query.status);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un pago recibido por el negocio' })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentDto> {
    return this.paymentsService.create(user.sub, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Aprobar un pago pendiente' })
  approve(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentDto> {
    return this.paymentsService.approve(user.sub, id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar un pago pendiente' })
  reject(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<PaymentDto> {
    return this.paymentsService.reject(user.sub, id, dto);
  }
}
