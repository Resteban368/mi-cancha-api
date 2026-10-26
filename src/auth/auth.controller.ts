import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';
import {
  AppleSignInDto,
  AuthResponseDto,
  AuthUserDto,
  ChangePasswordDto,
  GoogleSignInDto,
  LoginDto,
  RegisterBusinessAdminDto,
  SignupBusinessDto,
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
  @Post('business/signup')
  @ApiOperation({
    summary:
      'Registrar un negocio nuevo con 15 días de prueba (crea cuenta, negocio y suscripción «Prueba»)',
  })
  signup(@Body() dto: SignupBusinessDto): Promise<AuthResponseDto> {
    return this.authService.signupBusiness(dto);
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

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles([UserRole.ADMIN_NEGOCIO, UserRole.SUPER_ADMIN])
  @ApiOperation({
    summary:
      'Cambiar la contraseña del negocio (pide la actual y la nueva; 400 si la actual no coincide)',
  })
  changePassword(
    @CurrentUser() user: AuthPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user.sub, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado' })
  me(@CurrentUser() user: AuthPayload): Promise<AuthUserDto> {
    return this.authService.me(user.sub);
  }
}
