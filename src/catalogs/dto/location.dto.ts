import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';

export class DepartmentDto {
  id: string;
  /** Código DANE de 2 dígitos. */
  code: string;
  name: string;
}

export class CityDto {
  id: string;
  /** Código DANE de 5 dígitos. */
  code: string;
  name: string;
}

/** Ciudad de un negocio con su departamento. */
export class CityRefDto {
  id: string;
  name: string;
  department: { id: string; name: string };
}

/** Lo que se pide de la ciudad al leer un negocio. */
export const citySelect = {
  select: {
    id: true,
    name: true,
    department: { select: { id: true, name: true } },
  },
} as const;

export function toCityRef(
  city: {
    id: string;
    name: string;
    department: { id: string; name: string };
  } | null,
): CityRefDto | null {
  return city && { id: city.id, name: city.name, department: city.department };
}

/** Lanza 400 si la ciudad no existe en el catálogo de Colombia. */
export async function requireCity(
  prisma: Pick<PrismaService, 'city'>,
  cityId: string,
): Promise<void> {
  const found = await prisma.city.count({ where: { id: cityId } });
  if (!found) {
    throw new BadRequestException(
      'La ciudad no existe: elígela de la lista de ciudades de Colombia',
    );
  }
}
