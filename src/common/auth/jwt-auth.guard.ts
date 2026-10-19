import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthPayload } from './auth-payload.js';
import { accountBanned, BannedUsersService } from './banned-users.service.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Guard global: exige un Bearer token válido salvo en endpoints @Public(), y
 * corta las cuentas bloqueadas aunque su token siga vigente.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly banned: BannedUsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    try {
      request.user = await this.jwt.verifyAsync<AuthPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (await this.banned.isBanned(request.user.sub)) throw accountBanned();
    return true;
  }
}
