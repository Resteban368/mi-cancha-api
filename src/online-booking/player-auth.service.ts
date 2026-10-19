import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { assertNotBanned } from '../common/auth/banned-users.service.js';
import {
  normalizeDocument,
  normalizePhone,
} from '../customers/customers.service.js';
import type { User } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { WRONG_CODE } from '../otp/otp.controller.js';
import { OTP_SENT_MESSAGE, OtpService, otpPhone } from '../otp/otp.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DATA_POLICY_VERSION,
  LoginPlayerDto,
  PasswordResetCodeDto,
  PlayerDto,
  PlayerSessionDto,
  RegisterPlayerDto,
  ResetPasswordDto,
  StartRegistrationDto,
  UpdatePlayerProfileDto,
} from './dto/online-booking.dto.js';

const BCRYPT_ROUNDS = 12;

/**
 * Cuentas de jugador (globales, no por negocio): se registran con nombre,
 * celular verificado por SMS y contraseña, e ingresan con celular y contraseña.
 */
@Injectable()
export class PlayerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
  ) {}

  /** Registro, paso 1: si el celular está libre, le envía el código por SMS. */
  async startRegistration(
    dto: StartRegistrationDto,
    ip?: string | null,
  ): Promise<{ message: string }> {
    const phone = await this.assertPhoneFree(dto.phone);
    return this.otp.request(phone, ip);
  }

  /** Registro, paso 2: con la prueba del celular se crea la cuenta (celular verificado). */
  async register(dto: RegisterPlayerDto): Promise<PlayerSessionDto> {
    const phone = await this.assertPhoneFree(dto.phone);
    if (!(await this.otp.confirm(phone, dto))) {
      throw new BadRequestException(WRONG_CODE);
    }
    const user = await this.prisma.user.create({
      data: {
        role: UserRole.JUGADOR,
        displayName: dto.fullName.trim(),
        phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        dataConsentAt: new Date(),
        dataConsentVersion: DATA_POLICY_VERSION,
        phoneVerifiedAt: new Date(),
      },
    });
    return this.session(user);
  }

  /**
   * "Olvidé mi contraseña": envía el código solo si el celular tiene cuenta,
   * pero responde lo mismo en ambos casos (no revela quién está registrado).
   */
  async requestPasswordReset(
    dto: PasswordResetCodeDto,
    ip?: string | null,
  ): Promise<{ message: string }> {
    const phone = otpPhone(dto.phone);
    if (!(await this.findByPhone(phone))) return { message: OTP_SENT_MESSAGE };
    return this.otp.request(phone, ip);
  }

  /** Con la prueba del celular se elige una contraseña nueva y queda la sesión iniciada. */
  async resetPassword(dto: ResetPasswordDto): Promise<PlayerSessionDto> {
    const phone = otpPhone(dto.phone);
    const user = await this.findByPhone(phone);
    if (!user || !(await this.otp.confirm(phone, dto))) {
      throw new BadRequestException(WRONG_CODE);
    }
    // Una cuenta bloqueada no puede recuperar su clave para volver a entrar.
    assertNotBanned(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
      },
    });
    return this.session(updated);
  }

  /** Login con celular (o cédula, si ya la registró); el mismo error si algo no coincide. */
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
      throw new UnauthorizedException('Celular o contraseña incorrectos');
    }
    return this.session(user);
  }

  async me(userId: string): Promise<PlayerDto> {
    return toPlayerDto(await this.requirePlayer(userId));
  }

  /**
   * "Mi perfil": completa o cambia nombre, correo, cédula, fecha de
   * nacimiento y deporte. La cédula nueva también se anota en los clientes
   * del jugador en cada sede que aún no la tenían.
   */
  async updateProfile(
    userId: string,
    dto: UpdatePlayerProfileDto,
  ): Promise<PlayerDto> {
    const player = await this.requirePlayer(userId);
    const email = dto.email?.trim().toLowerCase();
    const documentId = dto.documentId
      ? normalizeDocument(dto.documentId)
      : undefined;

    const [byEmail, byDocument] = await Promise.all([
      email ? this.prisma.user.findUnique({ where: { email } }) : null,
      documentId
        ? this.prisma.user.findUnique({ where: { documentId } })
        : null,
    ]);
    if (byEmail && byEmail.id !== userId) {
      throw new ConflictException('Ese correo ya está registrado');
    }
    if (byDocument && byDocument.id !== userId) {
      throw new ConflictException('Esa cédula ya está registrada');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: player.id },
        data: {
          ...(dto.fullName !== undefined && {
            displayName: dto.fullName.trim(),
          }),
          ...(email !== undefined && { email }),
          ...(documentId !== undefined && { documentId }),
          ...(dto.birthDate !== undefined && {
            birthDate: dto.birthDate
              ? new Date(`${dto.birthDate}T00:00:00Z`)
              : null,
          }),
          ...(dto.favoriteSport !== undefined && {
            favoriteSport: dto.favoriteSport,
          }),
        },
      });
      if (documentId) {
        await this.fillCustomerDocuments(tx, player.id, documentId);
      }
      return user;
    });
    return toPlayerDto(updated);
  }

  async requirePlayer(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.JUGADOR) {
      throw new NotFoundException('La cuenta no existe');
    }
    return user;
  }

  /**
   * Pone la cédula en los clientes del jugador que no la tienen, salvo en la
   * sede donde otro cliente ya la usa (ahí la resuelve el negocio).
   */
  private async fillCustomerDocuments(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    documentId: string,
  ): Promise<void> {
    const customers = await tx.customer.findMany({
      where: { userId, documentId: null },
      select: { id: true, businessId: true },
    });
    for (const customer of customers) {
      const taken = await tx.customer.findUnique({
        where: {
          businessId_documentId: {
            businessId: customer.businessId,
            documentId,
          },
        },
        select: { id: true },
      });
      if (!taken) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { documentId },
        });
      }
    }
  }

  private findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { role_phone: { role: UserRole.JUGADOR, phone } },
    });
  }

  /** Celular normalizado, si ningún jugador lo tiene. */
  private async assertPhoneFree(raw: string): Promise<string> {
    const phone = otpPhone(raw);
    if (await this.findByPhone(phone)) {
      throw new ConflictException(
        'Ese celular ya tiene una cuenta. Ingresa o recupera tu contraseña.',
      );
    }
    return phone;
  }

  private async session(user: User): Promise<PlayerSessionDto> {
    assertNotBanned(user);
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
