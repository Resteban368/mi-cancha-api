import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../generated/prisma/enums.js';

/** Restringe un controlador o endpoint a los roles indicados. */
export const Roles = Reflector.createDecorator<UserRole[]>();
