import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';

/** Auditoría global: cualquier módulo puede inyectar AuditService; el interceptor registra solo. */
@Global()
@Module({
  providers: [
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
