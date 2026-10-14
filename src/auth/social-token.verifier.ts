import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface SocialIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

const APPLE_ISSUER = 'https://appleid.apple.com';

/** Verifica los tokens de identidad que la app obtiene de Google y Apple. */
@Injectable()
export class SocialTokenVerifier {
  private readonly googleClient = new OAuth2Client();
  private readonly appleKeys = createRemoteJWKSet(
    new URL(`${APPLE_ISSUER}/auth/keys`),
  );
  private readonly googleClientIds: string[];
  private readonly appleClientIds: string[];

  constructor(config: ConfigService) {
    this.googleClientIds = parseList(config.get<string>('GOOGLE_CLIENT_IDS'));
    this.appleClientIds = parseList(config.get<string>('APPLE_CLIENT_IDS'));
  }

  async verifyGoogle(idToken: string): Promise<SocialIdentity> {
    if (this.googleClientIds.length === 0) {
      throw new ServiceUnavailableException(
        'El inicio de sesión con Google no está configurado',
      );
    }
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientIds,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('Token sin sujeto');
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: payload.name,
      };
    } catch {
      throw new UnauthorizedException('Token de Google inválido');
    }
  }

  async verifyApple(identityToken: string): Promise<SocialIdentity> {
    if (this.appleClientIds.length === 0) {
      throw new ServiceUnavailableException(
        'El inicio de sesión con Apple no está configurado',
      );
    }
    try {
      const { payload } = await jwtVerify(identityToken, this.appleKeys, {
        issuer: APPLE_ISSUER,
        audience: this.appleClientIds,
      });
      if (!payload.sub) throw new Error('Token sin sujeto');
      return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        // Apple envía email_verified como booleano o como el string "true".
        emailVerified:
          payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch {
      throw new UnauthorizedException('Token de Apple inválido');
    }
  }
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
