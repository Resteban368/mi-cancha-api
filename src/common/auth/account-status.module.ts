import { Global, Module } from '@nestjs/common';
import { BannedUsersService } from './banned-users.service.js';

/** Estado de bloqueo de las cuentas, disponible para los guards y para el panel de seguridad. */
@Global()
@Module({
  providers: [BannedUsersService],
  exports: [BannedUsersService],
})
export class AccountStatusModule {}
