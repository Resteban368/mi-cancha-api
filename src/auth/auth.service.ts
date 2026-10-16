import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AppleSignInDto,
  AuthResponseDto,
  AuthUserDto,
  GoogleSignInDto,
  LoginDto,
  RegisterBusinessAdminDto,
} from './dto/auth.dto.js';
import {
  SocialIdentity,
  SocialTokenVerifier,
} from './social-token.verifier.js';

const BCRYPT_ROUNDS = 12;
const BUSINESS_ROLES: UserRole[] = [
  UserRole.ADMIN_NEGOCIO,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly socialVerifier: SocialTokenVerifier,
  ) {}

  async registerBusinessAdmin(
    dto: RegisterBusinessAdminDto,
  ): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        displayName: dto.fullName,
        phone: dto.phone,
        role: UserRole.ADMIN_NEGOCIO,
      },
    });
    return this.issueSession(user);
  }

  async loginBusiness(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    const passwordMatches = user?.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !passwordMatches || !BUSINESS_ROLES.includes(user.role)) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.issueSession(user);
  }

  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResponseDto> {
    const identity = await this.socialVerifier.verifyGoogle(dto.idToken);
    const user = await this.findOrCreatePlayer(
      { googleSub: identity.sub },
      identity,
    );
    return this.issueSession(user);
  }

  async signInWithApple(dto: AppleSignInDto): Promise<AuthResponseDto> {
    const identity = await this.socialVerifier.verifyApple(dto.identityToken);
    const user = await this.findOrCreatePlayer(
      { appleSub: identity.sub },
      { ...identity, name: dto.fullName ?? identity.name },
    );
    return this.issueSession(user);
  }

  /**
   * Cierra todas las sesiones del usuario: sube su versión de sesiones y con eso
   * todos los tokens emitidos hasta ahora dejan de valer (incluido el actual).
   */
  async revokeSessions(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('El usuario ya no existe');
    return toAuthUser(user);
  }

  /**
   * Busca al jugador por su identificador del proveedor; si no existe, lo
   * vincula a una cuenta de jugador con el mismo email verificado o lo crea.
   */
  private async findOrCreatePlayer(
    providerKey: { googleSub: string } | { appleSub: string },
    identity: SocialIdentity,
  ): Promise<User> {
    const linked = await this.prisma.user.findUnique({ where: providerKey });
    if (linked) return linked;

    const verifiedEmail = identity.emailVerified
      ? identity.email?.toLowerCase()
      : undefined;

    if (verifiedEmail) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: verifiedEmail },
      });
      if (byEmail) {
        if (byEmail.role !== UserRole.JUGADOR) {
          throw new ConflictException(
            'Este email pertenece a una cuenta de negocio',
          );
        }
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: providerKey,
        });
      }
    }

    const data: Prisma.UserCreateInput = {
      ...providerKey,
      email: verifiedEmail,
      displayName: identity.name ?? verifiedEmail?.split('@')[0] ?? 'Jugador',
      role: UserRole.JUGADOR,
      verified: Boolean(verifiedEmail),
    };
    return this.prisma.user.create({ data });
  }

  private async issueSession(user: User): Promise<AuthResponseDto> {
    const payload: AuthPayload = {
      sub: user.id,
      role: user.role,
      ver: user.tokenVersion,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toAuthUser(user),
    };
  }
}

function toAuthUser(user: User): AuthUserDto {
  return { id: user.id, displayName: user.displayName, role: user.role };
}
