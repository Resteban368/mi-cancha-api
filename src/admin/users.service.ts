import { Injectable } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminUserDto,
  DeleteUsersResultDto,
  UsersQueryDto,
} from './dto/admin.dto.js';

const userInclude = {
  business: { select: { name: true } },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UsersQueryDto): Promise<Page<AdminUserDto>> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role,
      ...(query.banned === undefined
        ? {}
        : { bannedAt: query.banned ? { not: null } : null }),
      ...(search && {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(toAdminUserDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Elimina jugadores de forma definitiva. Solo toca cuentas de jugador: los ids de negocios o
   * super admins se ignoran. Sus reservas se conservan en el negocio, sin vínculo a la cuenta.
   */
  async removePlayers(ids: string[]): Promise<DeleteUsersResultDto> {
    const { count } = await this.prisma.user.deleteMany({
      where: { id: { in: ids }, role: UserRole.JUGADOR },
    });
    return { deleted: count, skipped: ids.length - count };
  }
}

function toAdminUserDto(u: UserRecord): AdminUserDto {
  const authProviders = [
    u.passwordHash && 'password',
    u.googleSub && 'google',
    u.appleSub && 'apple',
  ].filter((p): p is string => Boolean(p));
  return {
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    verified: u.verified,
    createdAt: u.createdAt,
    businessName: u.business?.name ?? null,
    authProviders,
    bannedAt: u.bannedAt,
    bannedReason: u.bannedReason,
  };
}
