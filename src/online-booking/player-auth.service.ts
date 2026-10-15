import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import {
  normalizeDocument,
  normalizePhone,
} from '../customers/customers.service.js';
import type { User } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DATA_POLICY_VERSION,
  LoginPlayerDto,
  PlayerDto,
  PlayerSessionDto,
  RegisterPlayerDto,
} from './dto/online-booking.dto.js';

const BCRYPT_ROUNDS = 12;

/** Cuentas de jugador con celular o cédula y contraseña (globales, no por negocio). */
@Injectable()
export class PlayerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterPlayerDto): Promise<PlayerSessionDto> {
    const email = dto.email.trim().toLowerCase();
    const phone = normalizePhone(dto.phone);
    const documentId = normalizeDocument(dto.documentId);

    const [byEmail, byPhone, byDocument] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findUnique({
        where: { role_phone: { role: UserRole.JUGADOR, phone } },
      }),
      this.prisma.user.findUnique({ where: { documentId } }),
    ]);
    if (byEmail) throw new ConflictException('Ese correo ya está registrado');
    if (byPhone) throw new ConflictException('Ese celular ya está registrado');
    if (byDocument)
      throw new ConflictException('Esa cédula ya está registrada');

    const user = await this.prisma.user.create({
      data: {
        role: UserRole.JUGADOR,
        displayName: dto.fullName.trim(),
        email,
        phone,
        documentId,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        birthDate: dto.birthDate
          ? new Date(`${dto.birthDate}T00:00:00Z`)
          : null,
        favoriteSport: dto.favoriteSport ?? null,
        dataConsentAt: new Date(),
        dataConsentVersion: DATA_POLICY_VERSION,
      },
    });
    return this.session(user);
  }

  /** Login con celular o cédula; el mismo error para usuario o contraseña incorrectos. */
  async login(dto: LoginPlayerDto): Promise<PlayerSessionDto> {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        role: UserRole.JUGADOR,
        OR: [
          { phone: normalizePhone(identifier) },
          { documentId: normalizeDocument(identifier) },
        ],
      },
    });
    const valid =
      user?.passwordHash &&
      (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !valid) {
      throw new UnauthorizedException(
        'Celular, cédula o contraseña incorrectos',
      );
    }
    return this.session(user);
  }

  async me(userId: string): Promise<PlayerDto> {
    return toPlayerDto(await this.requirePlayer(userId));
  }

  async requirePlayer(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.JUGADOR) {
      throw new NotFoundException('La cuenta no existe');
    }
    return user;
  }

  private async session(user: User): Promise<PlayerSessionDto> {
    const payload: AuthPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      player: toPlayerDto(user),
    };
  }
}

export function toPlayerDto(user: User): PlayerDto {
  return {
    id: user.id,
    fullName: user.displayName,
    email: user.email,
    phone: user.phone,
    documentId: user.documentId,
    birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
    favoriteSport: user.favoriteSport,
  };
}
