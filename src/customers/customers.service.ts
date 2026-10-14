import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomerDto, CustomerInputDto } from './dto/customer.dto.js';

const SEARCH_LIMIT = 20;

/** Cliente de un tx de Prisma o del cliente normal. */
type Db = Pick<Prisma.TransactionClient, 'customer'>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Busca por nombre, teléfono o cédula; sin búsqueda devuelve los más recientes. */
  async search(businessId: string, search?: string): Promise<CustomerDto[]> {
    const term = search?.trim();
    const digits = term?.replace(/\D/g, '');
    const customers = await this.prisma.customer.findMany({
      where: {
        businessId,
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            ...(digits
              ? [
                  { phone: { contains: digits } },
                  { documentId: { contains: normalizeDocument(term) } },
                ]
              : []),
          ],
        }),
      },
      orderBy: term ? { name: 'asc' } : { createdAt: 'desc' },
      take: SEARCH_LIMIT,
    });
    return customers.map(toCustomerDto);
  }

  /**
   * Cliente de la reserva: el indicado por id, o el que ya tenga ese teléfono o
   * esa cédula (se conservan sus datos), o uno nuevo.
   */
  async resolve(
    db: Db,
    businessId: string,
    input: { customerId?: string; customer?: CustomerInputDto },
  ): Promise<Customer> {
    if (input.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: input.customerId, businessId },
      });
      if (!customer) throw new NotFoundException('El cliente no existe');
      return customer;
    }

    const data = input.customer!;
    const phone = normalizePhone(data.phone);
    const documentId = normalizeDocument(data.documentId);
    const [byPhone, byDocument] = await Promise.all([
      db.customer.findUnique({
        where: { businessId_phone: { businessId, phone } },
      }),
      db.customer.findUnique({
        where: { businessId_documentId: { businessId, documentId } },
      }),
    ]);
    if (byPhone && byDocument && byPhone.id !== byDocument.id) {
      throw new ConflictException(
        `El teléfono es de ${byPhone.name} y la cédula de ${byDocument.name}: revisa los datos del cliente`,
      );
    }
    const existing = byPhone ?? byDocument;
    if (existing) return existing;

    return db.customer.create({
      data: { businessId, name: data.name.trim(), phone, documentId },
    });
  }
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/(?!^\+)[^\d]/g, '');
}

export function normalizeDocument(document: string): string {
  return document.replace(/[.\s-]/g, '').toUpperCase();
}

export function toCustomerDto(c: Customer): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    documentId: c.documentId,
    createdAt: c.createdAt,
  };
}
