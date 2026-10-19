import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class SubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  auth!: string;
}

/** Lo que devuelve `PushSubscription.toJSON()` en el navegador. */
export class SubscribeDto {
  @ApiProperty({ description: 'URL del servicio push del navegador' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @ApiProperty({ type: SubscriptionKeysDto })
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys!: SubscriptionKeysDto;
}

export class UnsubscribeDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}

export class VapidKeyDto {
  @ApiProperty({ description: 'Clave pública VAPID para pushManager.subscribe (applicationServerKey)' })
  publicKey!: string;
}
