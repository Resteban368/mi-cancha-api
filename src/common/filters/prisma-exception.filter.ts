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

const WRITE_CONFLICT_MESSAGE =
  'Otra operación modificó los mismos datos, intenta de nuevo';

/**
 * Traduce errores conocidos de Prisma a respuestas HTTP sin filtrar detalles
 * internos. El resto de errores sigue el manejo normal de Nest.
 */
@Catch()
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      super.catch(this.toHttpException(error), host);
    } else if (isWriteConflict(error)) {
      super.catch(new ConflictException(WRITE_CONFLICT_MESSAGE), host);
    } else {
      super.catch(error, host);
    }
  }

  private toHttpException(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpException | Error {
    switch (error.code) {
      case 'P2002':
        return new ConflictException('Ya existe un registro con esos datos');
      case 'P2034':
        return new ConflictException(WRITE_CONFLICT_MESSAGE);
      case 'P2025':
        return new NotFoundException('El registro no existe');
      default:
        this.logger.error(`Error de Prisma ${error.code}`, error.stack);
        return error;
    }
  }
}

/**
 * Dos transacciones Serializable chocaron (p. ej. dos jugadores tomando el
 * mismo turno). Con el adaptador pg llega como DriverAdapterError, no como
 * P2034, cuando el choque se detecta al confirmar la transacción.
 */
export function isWriteConflict(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== 'DriverAdapterError') {
    return false;
  }
  const cause = (error as { cause?: { kind?: string } }).cause;
  return cause?.kind === 'TransactionWriteConflict';
}
