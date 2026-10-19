import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/auth/public.decorator.js';
import { clientIp } from './client-ip.js';
import {
  OtpRequestDto,
  OtpSentDto,
  OtpVerifiedDto,
  OtpVerifyDto,
} from './dto/otp.dto.js';
import { OtpService, VERIFICATION_TOKEN_SECONDS } from './otp.service.js';

export const WRONG_CODE =
  'El código no es correcto o ya venció. Revísalo o pide uno nuevo.';

/** Códigos de un solo uso por SMS para verificar un celular. */
@ApiTags('public / otp')
@Public()
@Controller('public/auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Envía un código de 6 dígitos por SMS (vence en 5 min; 2 códigos cada 6 h por celular, 60 s entre ellos)',
  })
  request(
    @Body() dto: OtpRequestDto,
    @Req() req: Request,
  ): Promise<OtpSentDto> {
    return this.otp.request(dto.phone, clientIp(req));
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Valida el código (un solo uso, 5 intentos) y devuelve la prueba para registrarse o cambiar la contraseña',
  })
  async verify(@Body() dto: OtpVerifyDto): Promise<OtpVerifiedDto> {
    if (!(await this.otp.verify(dto.phone, dto.code))) {
      throw new BadRequestException(WRONG_CODE);
    }
    return {
      verified: true,
      verificationToken: await this.otp.issueVerificationToken(dto.phone),
      expiresIn: VERIFICATION_TOKEN_SECONDS,
    };
  }
}
