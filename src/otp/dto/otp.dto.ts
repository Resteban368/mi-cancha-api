import { IsPhoneNumber, Matches } from 'class-validator';

/** Celular de Colombia, con o sin +57. */
export const PHONE_MESSAGE =
  'phone debe ser un celular de Colombia, p. ej. 300 123 4567 o +573001234567';
export const OTP_CODE = /^\d{6}$/;
export const OTP_CODE_MESSAGE = 'code debe ser el código de 6 dígitos del SMS';

export class OtpRequestDto {
  /** @example +573001234567 */
  @IsPhoneNumber('CO', { message: PHONE_MESSAGE })
  phone: string;
}

export class OtpVerifyDto extends OtpRequestDto {
  /** @example 123456 */
  @Matches(OTP_CODE, { message: OTP_CODE_MESSAGE })
  code: string;
}

export class OtpSentDto {
  /** Siempre el mismo: no revela si el número tiene cuenta. */
  message: string;
}

export class OtpVerifiedDto {
  verified: true;
  /**
   * Prueba de que el celular se verificó: se envía como `verificationToken` al
   * registrarse o al cambiar la contraseña (en vez del código).
   */
  verificationToken: string;
  /** Segundos de vigencia del token. */
  expiresIn: number;
}
