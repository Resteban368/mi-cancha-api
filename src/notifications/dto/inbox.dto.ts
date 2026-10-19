import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import { NotificationType } from '../../generated/prisma/enums.js';

export class InboxQueryDto extends PageQueryDto {
  /** true = solo las que no se han leído. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unread?: boolean;
}

export class NotificationDto {
  id!: string;
  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;
  title!: string;
  body!: string;
  /** Ruta de la app que se abre al tocarla. */
  url!: string | null;
  /** Imagen del aviso (URL pública), si tiene. */
  imageUrl!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  data!: Record<string, unknown> | null;
  /** null = sin leer. */
  readAt!: Date | null;
  createdAt!: Date;
}

export class InboxPageDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[];
  total!: number;
  page!: number;
  pageSize!: number;
  /** Cuántas no se han leído en total (para la insignia). */
  unread!: number;
}

export class UnreadCountDto {
  unread!: number;
}

export class BroadcastHistoryItemDto {
  id!: string;
  title!: string;
  body!: string;
  url!: string | null;
  imageUrl!: string | null;
  /** ALL o SELECTED. */
  scope!: string;
  sentByLabel!: string | null;
  targeted!: number;
  reachable!: number;
  delivered!: number;
  /** Cuántos dueños ya la abrieron/leyeron en su bandeja. */
  read!: number;
  createdAt!: Date;
}

export class BroadcastHistoryPageDto {
  @ApiProperty({ type: [BroadcastHistoryItemDto] })
  items!: BroadcastHistoryItemDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
