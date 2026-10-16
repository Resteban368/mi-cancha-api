import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';

/** Traduce errores conocidos de Prisma a respuestas HTTP sin filtrar detalles internos. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(this.toHttpException(error), host);
  }

  private toHttpException(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpException | Error {
    switch (error.code) {
      case 'P2002':
        return new ConflictException('Ya existe un registro con esos datos');
      case 'P2034':
        return new ConflictException(
          'Otra operación modificó los mismos datos, intenta de nuevo',
        );
      case 'P2025':
        return new NotFoundException('El registro no existe');
      case 'P2039':
        // Error de Postgres sin código propio de Prisma. 23P01 es la restricción
        // EXCLUDE que impide reservas solapadas en la misma cancha.
        if (postgresCode(error) === EXCLUSION_VIOLATION) {
          return new ConflictException(
            'La cancha ya está reservada en ese horario',
          );
        }
        this.logger.error(
          `Error de Postgres ${postgresCode(error) ?? 'desconocido'}`,
          error.stack,
        );
        return error;
      default:
        this.logger.error(`Error de Prisma ${error.code}`, error.stack);
        return error;
    }
  }
}

/** Código SQLSTATE de una violación de restricción EXCLUDE. */
const EXCLUSION_VIOLATION = '23P01';

/** Código SQLSTATE original que el adaptador de pg adjunta al error. */
function postgresCode(
  error: Prisma.PrismaClientKnownRequestError,
): string | undefined {
  const cause = (
    error.meta?.driverAdapterError as { cause?: { code?: unknown } } | undefined
  )?.cause;
  return typeof cause?.code === 'string' ? cause.code : undefined;
}
