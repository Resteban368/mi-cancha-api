import { Injectable } from '@nestjs/common';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminUserDto, UsersQueryDto } from './dto/admin.dto.js';

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
  };
}
