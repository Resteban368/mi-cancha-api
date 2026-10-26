import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isSubscriptionUsable, isTrialExpired } from '../trial.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';

/** Métodos que solo leen: siempre permitidos. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: un administrador de negocio sin plan activo (suspendido o sin
 * plan) solo puede consultar su información; cualquier creación, edición o
 * borrado responde 403 con code SUBSCRIPTION_INACTIVE (o TRIAL_EXPIRED si venció
 * su prueba gratuita). Al ser global, todo
 * endpoint nuevo de escritura queda cubierto sin marcarlo.
 */
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = request;
    if (
      READ_METHODS.has(request.method) ||
      user?.role !== UserRole.ADMIN_NEGOCIO
    ) {
      return true;
    }

    const business = await this.prisma.business.findUnique({
      where: { ownerId: user.sub },
      select: {
        subscription: { select: { isActive: true, trialEndsAt: true } },
      },
    });
    // Sin negocio todavía no hay nada que proteger: puede registrarlo.
    if (!business || isSubscriptionUsable(business.subscription)) return true;

    if (isTrialExpired(business.subscription)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'TRIAL_EXPIRED',
        message:
          'Tu prueba gratuita de 15 días terminó: puedes consultar tu información, pero para seguir creando y modificando necesitas comprar un plan. Contacta a Mi Cancha.',
      });
    }
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'SUBSCRIPTION_INACTIVE',
      message:
        'Tu plan no está activo: puedes consultar tu información, pero no crear ni modificar nada. Contacta a Mi Cancha para reactivarlo.',
    });
  }
}
