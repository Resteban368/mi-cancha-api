import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class HealthDto {
  status: 'ok';
  database: 'up';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la base de datos' })
  async check(): Promise<HealthDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
    return { status: 'ok', database: 'up' };
  }
}
