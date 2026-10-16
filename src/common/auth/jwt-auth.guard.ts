import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPayload } from './auth-payload.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Guard global: exige un Bearer token válido salvo en endpoints @Public().
 *
 * Además de la firma, revisa en la base que el usuario siga existiendo y que el
 * token sea de su versión de sesiones actual, así un token deja de valer en cuanto
 * se cierran las sesiones del usuario (sin esperar a que expire). El rol se toma
 * de la base, no del token, para que un cambio de rol aplique de inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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

    let payload: AuthPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, tokenVersion: true },
    });
    if (!user || (payload.ver ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(
        'Tu sesión ya no es válida, inicia sesión de nuevo',
      );
    }

    request.user = {
      sub: payload.sub,
      role: user.role,
      ver: user.tokenVersion,
    };
    return true;
  }
}
