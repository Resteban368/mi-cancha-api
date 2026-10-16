import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

function prismaError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

/** Error que entrega el adaptador de pg cuando Postgres rechaza la operación. */
function postgresError(sqlState: string) {
  return prismaError('P2039', {
    driverAdapterError: { cause: { kind: 'postgres', code: sqlState } },
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();
  const toHttp = (error: Prisma.PrismaClientKnownRequestError) =>
    (
      filter as unknown as {
        toHttpException: (e: Prisma.PrismaClientKnownRequestError) => unknown;
      }
    ).toHttpException(error);

  it('traduce el solape de reservas (23P01) a 409 con un mensaje claro', () => {
    const result = toHttp(postgresError('23P01'));
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(
      'La cancha ya está reservada en ese horario',
    );
  });

  it('deja pasar otros errores de Postgres sin exponer detalles como 409', () => {
    const error = postgresError('22001');
    expect(toHttp(error)).toBe(error);
  });

  it('mantiene las traducciones existentes', () => {
    expect(toHttp(prismaError('P2002'))).toBeInstanceOf(ConflictException);
    expect(toHttp(prismaError('P2025'))).toBeInstanceOf(NotFoundException);
  });
});
