import { vi, type Mock } from 'vitest';

type ModelMock = Record<
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findMany'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'count'
  | 'delete'
  | 'deleteMany'
  | 'upsert'
  | 'groupBy'
  | 'aggregate',
  Mock
>;

function modelMock(): ModelMock {
  return {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  };
}

/** Doble de PrismaService: los modelos son mocks y $transaction ejecuta el callback con el mismo doble (o resuelve la lista de operaciones). */
export function createPrismaMock() {
  const prisma = {
    user: modelMock(),
    business: modelMock(),
    court: modelMock(),
    reservation: modelMock(),
    payment: modelMock(),
    plan: modelMock(),
    subscription: modelMock(),
    amenity: modelMock(),
    paymentMethod: modelMock(),
    courtSurface: modelMock(),
    slotHold: modelMock(),
    reservationGroup: modelMock(),
    otpCode: modelMock(),
    auditLog: modelMock(),
    pushSubscription: modelMock(),
    notification: modelMock(),
    notificationBroadcast: modelMock(),
    notificationImage: modelMock(),
    businessProfileImage: modelMock(),
    city: modelMock(),
    department: modelMock(),
    courtPhoto: modelMock(),
    customer: modelMock(),
    coupon: modelMock(),
    couponCard: modelMock(),
    couponStamp: modelMock(),
    refund: modelMock(),
    product: modelMock(),
    sale: modelMock(),
    saleItem: modelMock(),
    cashSession: modelMock(),
    supplier: modelMock(),
    cashExpense: modelMock(),
    cashMovement: modelMock(),
    stockMovement: modelMock(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  // Listas que la lógica recorre aunque el test no las use.
  prisma.sale.findMany.mockResolvedValue([]);
  prisma.stockMovement.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation(
    (work: ((tx: typeof prisma) => unknown) | Promise<unknown>[]) =>
      Array.isArray(work) ? Promise.all(work) : work(prisma),
  );
  return prisma;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
