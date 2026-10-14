import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { AuthService } from './auth.service.js';
import {
  AppleSignInDto,
  AuthResponseDto,
  AuthUserDto,
  GoogleSignInDto,
  LoginDto,
  RegisterBusinessAdminDto,
} from './dto/auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('business/register')
  @ApiOperation({ summary: 'Registrar un administrador de negocio' })
  register(@Body() dto: RegisterBusinessAdminDto): Promise<AuthResponseDto> {
    return this.authService.registerBusinessAdmin(dto);
  }

  @Public()
  @Post('business/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como negocio (email y contraseña)' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.loginBusiness(dto);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como jugador con Google' })
  google(@Body() dto: GoogleSignInDto): Promise<AuthResponseDto> {
    return this.authService.signInWithGoogle(dto);
  }

  @Public()
  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como jugador con Apple' })
  apple(@Body() dto: AppleSignInDto): Promise<AuthResponseDto> {
    return this.authService.signInWithApple(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado' })
  me(@CurrentUser() user: AuthPayload): Promise<AuthUserDto> {
    return this.authService.me(user.sub);
  }
}
