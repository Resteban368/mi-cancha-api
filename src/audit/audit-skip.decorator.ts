import { SetMetadata } from '@nestjs/common';

export const AUDIT_SKIP = 'audit:skip';

/** El endpoint registra su propio evento de auditoría: el interceptor no lo repite. */
export const SkipAudit = () => SetMetadata(AUDIT_SKIP, true);
