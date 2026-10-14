import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AccountService } from './account.service.js';
import { BusinessAccountDto } from './dto/account.dto.js';

@ApiTags('business / account')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Perfil del administrador y suscripción' })
  getAccount(@CurrentUser() user: AuthPayload): Promise<BusinessAccountDto> {
    return this.accountService.getAccount(user.sub);
  }
}
