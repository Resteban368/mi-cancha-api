import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Solo letras (con tildes y ñ), números y espacios: nada de símbolos ni etiquetas. */
const BUSINESS_NAME = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

export const BUSINESS_NAME_MESSAGE =
  'El nombre del negocio solo puede tener letras, números y espacios';

/** Valida el nombre de un negocio: texto de 2 a 120 caracteres con letras, números y espacios. */
export function IsBusinessName() {
  return applyDecorators(
    // Quita espacios de los extremos y repetidos antes de validar.
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
    ),
    IsString(),
    MinLength(2),
    MaxLength(120),
    Matches(BUSINESS_NAME, { message: BUSINESS_NAME_MESSAGE }),
  );
}

const NO_MARKUP = /^[^<>"=`]*$/;

/** Texto libre (dirección, barrio, descripción, nombres de personas) sin los caracteres de las etiquetas HTML. */
export function NoMarkup() {
  return Matches(NO_MARKUP, {
    message: 'El texto no puede contener los caracteres < > " = o `',
  });
}
