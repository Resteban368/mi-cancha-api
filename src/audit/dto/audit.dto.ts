import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import { AuditCategory, UserRole } from '../../generated/prisma/enums.js';

export class AuditQueryDto extends PageQueryDto {
  @ApiProperty({ enum: AuditCategory, required: false })
  @IsOptional()
  @IsEnum(AuditCategory)
  category?: AuditCategory;

  /** Código exacto, p. ej. player.login_failed. */
  @IsOptional()
  @Matches(/^[a-z_.]{3,60}$/, { message: 'action no es un código válido' })
  action?: string;

  /** true = solo los que salieron bien; false = solo los rechazados. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  success?: boolean;

  /** Desde este día (YYYY-MM-DD, hora de Colombia). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe tener formato YYYY-MM-DD' })
  from?: string;

  /** Hasta este día incluido (YYYY-MM-DD, hora de Colombia). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to debe tener formato YYYY-MM-DD' })
  to?: string;
}

export class AuditLogDto {
  id: string;
  @ApiProperty({ enum: AuditCategory })
  category: AuditCategory;
  action: string;
  success: boolean;
  actorId: string | null;
  @ApiProperty({ enum: UserRole, nullable: true })
  actorRole: UserRole | null;
  actorLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  metadata: Record<string, unknown> | null;
  /** Primeros 8 caracteres del hash de la IP (la misma de los códigos SMS). */
  source: string | null;
  createdAt: Date;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditLogDto] })
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AuditActionDto {
  code: string;
  @ApiProperty({ enum: AuditCategory })
  category: AuditCategory;
  label: string;
}
