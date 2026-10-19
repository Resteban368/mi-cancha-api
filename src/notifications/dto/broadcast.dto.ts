import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BroadcastDto {
  @ApiProperty({ example: 'Mantenimiento programado' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @ApiProperty({ example: 'Esta noche a las 11 p. m. la plataforma estará en mantenimiento.' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  body!: string;

  @ApiPropertyOptional({
    description: 'Ruta de la app que se abre al tocar el aviso; por defecto "/"',
    example: '/negocio/reservas',
  })
  @IsOptional()
  @Matches(/^\/(?!\/)[\w\-./?=&%#]{0,199}$/, {
    message: 'url debe ser una ruta de la app, como /negocio/reservas',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Id de una imagen ya subida con POST /admin/notifications/images',
  })
  @IsOptional()
  @IsUUID()
  imageId?: string;

  @ApiProperty({ description: 'true = todos los negocios; false = solo los de businessIds' })
  @IsBoolean()
  all!: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Negocios elegidos (cuando all es false)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  businessIds?: string[];
}

export class BroadcastRecipientDto {
  businessId!: string;
  name!: string;
  ownerName!: string;
  /** Navegadores con los avisos activados; 0 = no recibiría nada. */
  devices!: number;
  /** Cuenta bloqueada: no recibe avisos. */
  banned!: boolean;
}

export class BroadcastResultDto {
  /** Negocios a los que se dirigió el aviso. */
  businesses!: number;
  /** De ellos, cuántos tienen avisos activados. */
  reachable!: number;
  /** Navegadores que lo aceptaron. */
  delivered!: number;
}
