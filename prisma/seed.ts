// Seed de la base de datos. Dos modos (variable SEED_MODE):
//   minimal → solo lo necesario para operar: planes, catálogos y un SUPER_ADMIN.
//             Exige SEED_SUPER_ADMIN_PASSWORD. Pensado para Neon / producción.
//   demo    → (por defecto) lo anterior más un negocio con canchas, reservas de hoy,
//             pagos y algunos clientes y jugadores para ver el dashboard.
// Uso: npx prisma db seed   ·   SEED_MODE=minimal npx prisma db seed
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  DayOfWeek,
  PaymentConcept,
  PaymentStatus,
  ReservationStatus,
  Sport,
  UserRole,
} from '../src/generated/prisma/enums.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const SEED_MODE = process.env.SEED_MODE ?? 'demo';
if (SEED_MODE !== 'demo' && SEED_MODE !== 'minimal') {
  throw new Error(`SEED_MODE inválido: ${SEED_MODE} (usa demo o minimal)`);
}

const DEMO_EMAIL = 'admin@micancha.co';
const DEMO_PASSWORD = 'MiCancha2026!';
const SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@micancha.co';
const SUPER_ADMIN_PASSWORD = resolveSuperAdminPassword();

/** En minimal la contraseña es obligatoria: nunca se usa la de demo fuera de desarrollo. */
function resolveSuperAdminPassword(): string {
  const fromEnv = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (SEED_MODE === 'minimal') {
    if (!fromEnv || fromEnv.length < 12) {
      throw new Error(
        'En SEED_MODE=minimal define SEED_SUPER_ADMIN_PASSWORD (mínimo 12 caracteres)',
      );
    }
    return fromEnv;
  }
  return fromEnv ?? 'SuperAdmin2026!';
}

const amenities = [
  { code: 'PARQUEADERO', name: 'Parqueadero' },
  { code: 'CAFETERIA', name: 'Cafetería' },
  { code: 'ILUMINACION_LED', name: 'Iluminación LED Pro' },
  { code: 'VESTIERES', name: 'Vestieres' },
  { code: 'GRADERIAS', name: 'Graderías' },
  { code: 'WIFI', name: 'WiFi Gratis' },
  { code: 'ALQUILER_IMPLEMENTOS', name: 'Alquiler de implementos' },
];

const paymentMethods = [
  { code: 'EFECTIVO', name: 'Efectivo', requiresReference: false },
  { code: 'NEQUI', name: 'Nequi', requiresReference: true },
  { code: 'DAVIPLATA', name: 'Daviplata', requiresReference: true },
  { code: 'BANCOLOMBIA_QR', name: 'Bancolombia QR', requiresReference: true },
  { code: 'TRANSFERENCIA', name: 'Transferencia', requiresReference: true },
];
const UTC_OFFSET = process.env.APP_UTC_OFFSET ?? '-05:00';

const plans = [
  {
    name: 'Gratis',
    monthlyPrice: 0,
    courtLimit: 1,
    benefits: [
      { title: 'Agenda digital', detail: 'Gestiona las reservas de 1 cancha' },
    ],
  },
  {
    name: 'Básico',
    monthlyPrice: 89_000,
    courtLimit: 3,
    benefits: [
      { title: 'Hasta 3 canchas', detail: 'Ideal para complejos pequeños' },
      {
        title: 'Validación de pagos',
        detail: 'Nequi, Daviplata y Bancolombia QR',
      },
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 179_000,
    courtLimit: 8,
    benefits: [
      {
        title: 'Hasta 8 canchas',
        detail: 'Para complejos con varias disciplinas',
      },
      {
        title: 'Validación de pagos',
        detail: 'Nequi, Daviplata y Bancolombia QR',
      },
      { title: 'Reservas recurrentes', detail: 'Equipos fijos y torneos' },
    ],
  },
];

/** Fecha de hoy en la zona del negocio, a la hora indicada. */
function todayAt(hour: number, minute = 0, dayOffset = 0): Date {
  const local = new Date(Date.now() + offsetMs());
  local.setUTCDate(local.getUTCDate() + dayOffset);
  const day = local.toISOString().slice(0, 10);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return new Date(`${day}T${time}:00${UTC_OFFSET}`);
}

function offsetMs(): number {
  const [, sign, h, m] = /^([+-])(\d{2}):(\d{2})$/.exec(UTC_OFFSET)!;
  return (sign === '-' ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60_000;
}

async function main() {
  await seedBase();
  if (SEED_MODE === 'minimal') {
    console.log(
      `Seed mínimo listo: planes, catálogos y super admin ${SUPER_ADMIN_EMAIL}.`,
    );
    return;
  }
  await seedDemo();
  console.log(
    `Seed demo listo.\n  Negocio demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n  Super admin:  ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`,
  );
}

/**
 * Datos necesarios para operar. Todo se crea solo si falta, así volver a correr
 * el seed no pisa los cambios hechos desde el panel.
 */
async function seedBase() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update: {},
    });
  }

  for (const [i, amenity] of amenities.entries()) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: {},
      create: { ...amenity, sortOrder: i + 1 },
    });
  }
  for (const [i, method] of paymentMethods.entries()) {
    await prisma.paymentMethod.upsert({
      where: { code: method.code },
      update: {},
      create: { ...method, sortOrder: i + 1 },
    });
  }

  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12),
      displayName: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      verified: true,
    },
  });
}

/** Negocio demo con canchas, reservas de hoy y pagos, más clientes y jugadores. */
async function seedDemo() {
  const pro = await prisma.plan.findUniqueOrThrow({ where: { name: 'Pro' } });
  const methodIds = Object.fromEntries(
    (await prisma.paymentMethod.findMany()).map((m) => [m.code, m.id]),
  );

  const admin = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      displayName: 'Andrés Gómez',
      phone: '+57 300 123 4567',
      role: UserRole.ADMIN_NEGOCIO,
      verified: true,
    },
  });

  const businessData = {
    name: 'Complejo Deportivo El Golazo',
    address: 'Calle 15 # 8-32',
    neighborhood: 'Barrio Centro',
    description:
      'Canchas sintéticas, pádel y cancha múltiple con iluminación LED.',
  };
  const demoAmenities = [
    'PARQUEADERO',
    'CAFETERIA',
    'ILUMINACION_LED',
    'VESTIERES',
    'WIFI',
  ].map((code) => ({ code }));
  const business = await prisma.business.upsert({
    where: { ownerId: admin.id },
    update: { ...businessData, amenities: { set: demoAmenities } },
    create: {
      ...businessData,
      ownerId: admin.id,
      amenities: { connect: demoAmenities },
    },
  });

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: { planId: pro.id, isActive: true },
    create: {
      businessId: business.id,
      planId: pro.id,
      since: new Date('2026-03-01T00:00:00-05:00'),
      nextPayment: todayAt(0, 0, 18),
    },
  });

  // Se regeneran reservas y pagos para que siempre haya agenda "de hoy".
  await prisma.payment.deleteMany({ where: { businessId: business.id } });
  await prisma.reservation.deleteMany({ where: { businessId: business.id } });

  const courtSeeds = [
    {
      name: 'Sintética 1',
      sport: Sport.FUTBOL,
      basePricePerHour: 120_000,
      isCovered: false,
    },
    {
      name: 'Sintética 2',
      sport: Sport.FUTBOL,
      basePricePerHour: 110_000,
      isCovered: false,
    },
    {
      name: 'Pádel 1',
      sport: Sport.PADEL,
      basePricePerHour: 90_000,
      isCovered: true,
    },
    {
      name: 'Pádel 2',
      sport: Sport.PADEL,
      basePricePerHour: 90_000,
      isCovered: true,
    },
    {
      name: 'Cancha Múltiple',
      sport: Sport.BALONCESTO,
      basePricePerHour: 80_000,
      isCovered: true,
    },
  ];
  // Abiertas de 06:00 a 23:00 entre semana y de 07:00 a 22:00 el fin de semana.
  const weekend: DayOfWeek[] = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY];
  const schedules = Object.values(DayOfWeek).map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openTime: weekend.includes(dayOfWeek) ? '07:00' : '06:00',
    closeTime: weekend.includes(dayOfWeek) ? '22:00' : '23:00',
  }));
  const courts: Record<string, string> = {};
  for (const court of courtSeeds) {
    // Tarifa nocturna entre semana: 20 % sobre el precio base.
    const rates = [
      {
        name: 'Nocturna L-V',
        pricePerHour: court.basePricePerHour * 1.2,
        days: Object.values(DayOfWeek).filter((d) => !weekend.includes(d)),
        startTime: '18:00',
        endTime: '23:00',
      },
    ];
    const details = {
      schedules: { deleteMany: {}, create: schedules },
      rates: { deleteMany: {}, create: rates },
    };
    const saved = await prisma.court.upsert({
      where: { businessId_name: { businessId: business.id, name: court.name } },
      update: { ...court, isActive: true, ...details },
      create: {
        ...court,
        businessId: business.id,
        schedules: { create: schedules },
        rates: { create: rates },
      },
    });
    courts[court.name] = saved.id;
  }

  // Clientes del negocio: la cédula de demo sale del teléfono para que sea estable.
  const customerFor = (name: string, phone: string) =>
    prisma.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone } },
      update: {},
      create: {
        businessId: business.id,
        name,
        phone,
        documentId: `10${phone.slice(-8)}`,
      },
    });

  const reservation = async (
    court: string,
    start: Date,
    hours: number,
    data: {
      customerName: string;
      phone: string;
      totalPrice: number;
      status?: ReservationStatus;
      customerDetail?: string;
      tag?: string;
      isRecurring?: boolean;
    },
  ) => {
    const customer = await customerFor(data.customerName, data.phone);
    return prisma.reservation.create({
      data: {
        businessId: business.id,
        courtId: courts[court],
        customerId: customer.id,
        start,
        end: new Date(start.getTime() + hours * 3_600_000),
        subtotal: data.totalPrice,
        ...data,
      },
    });
  };

  const r1 = await reservation('Sintética 1', todayAt(8), 1, {
    customerName: 'Juan Pablo Ríos',
    phone: '3104567890',
    totalPrice: 120_000,
    status: ReservationStatus.COMPLETED,
  });
  await reservation('Pádel 1', todayAt(10), 1.5, {
    customerName: 'Daniela Cortés',
    phone: '3157894561',
    totalPrice: 135_000,
    status: ReservationStatus.NO_SHOW,
  });
  const r3 = await reservation('Cancha Múltiple', todayAt(19), 1, {
    customerName: 'Valentina Dussán',
    phone: '3001234567',
    totalPrice: 80_000,
  });
  const r4 = await reservation('Sintética 1', todayAt(21), 2, {
    customerName: 'Torneo Nocturno Caquetá',
    customerDetail: 'Fecha 4 · 8 equipos',
    phone: '3209876543',
    totalPrice: 240_000,
    tag: 'Torneo',
    isRecurring: true,
  });
  const r5 = await reservation('Pádel 2', todayAt(20, 30, 1), 1, {
    customerName: 'Laura Restrepo',
    phone: '3112223344',
    totalPrice: 90_000,
  });

  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);
  await prisma.payment.createMany({
    data: [
      {
        businessId: business.id,
        reservationId: r3.id,
        customerName: 'Valentina Dussán',
        amount: 60_000,
        methodId: methodIds.NEQUI,
        concept: PaymentConcept.SALDO,
        reference: 'M4829310',
        receivedAt: ago(4),
        status: PaymentStatus.PENDING,
      },
      {
        businessId: business.id,
        reservationId: r4.id,
        customerName: 'Torneo Nocturno Caquetá',
        amount: 50_000,
        methodId: methodIds.BANCOLOMBIA_QR,
        concept: PaymentConcept.ANTICIPO,
        reference: '000184520',
        receivedAt: ago(26),
        status: PaymentStatus.PENDING,
      },
      {
        businessId: business.id,
        reservationId: r5.id,
        customerName: 'Laura Restrepo',
        amount: 45_000,
        methodId: methodIds.DAVIPLATA,
        concept: PaymentConcept.ANTICIPO,
        reference: 'DP-772014',
        receivedAt: ago(75),
        status: PaymentStatus.PENDING,
      },
      {
        businessId: business.id,
        reservationId: r1.id,
        customerName: 'Juan Pablo Ríos',
        amount: 120_000,
        methodId: methodIds.EFECTIVO,
        concept: PaymentConcept.TOTAL,
        receivedAt: ago(600),
        status: PaymentStatus.APPROVED,
        registeredByBusiness: true,
      },
      {
        businessId: business.id,
        reservationId: r3.id,
        customerName: 'Valentina Dussán',
        amount: 20_000,
        methodId: methodIds.TRANSFERENCIA,
        concept: PaymentConcept.ANTICIPO,
        reference: 'TR-55102',
        receivedAt: ago(1440),
        status: PaymentStatus.APPROVED,
      },
      {
        businessId: business.id,
        customerName: 'Pedro Salazar',
        amount: 30_000,
        methodId: methodIds.NEQUI,
        concept: PaymentConcept.ANTICIPO,
        reference: 'M1100293',
        receivedAt: ago(2000),
        status: PaymentStatus.REJECTED,
        rejectionReason: 'El comprobante no coincide con el monto',
      },
    ],
  });

  await seedDashboardDemo(pro.id);
}

/** Clientes y jugadores repartidos en los últimos meses, para ver el dashboard con datos. */
async function seedDashboardDemo(proPlanId: string) {
  const [free, basic] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { name: 'Gratis' } }),
    prisma.plan.findUniqueOrThrow({ where: { name: 'Básico' } }),
  ]);
  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - n);
    return d;
  };
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const clients = [
    {
      email: 'canchas.norte@demo.co',
      owner: 'Marcela Ruiz',
      name: 'Canchas del Norte',
      neighborhood: 'La Floresta',
      planId: basic.id,
      months: 4,
      active: true,
    },
    {
      email: 'padel.club@demo.co',
      owner: 'Felipe Osorio',
      name: 'Pádel Club Florencia',
      neighborhood: 'El Centro',
      planId: proPlanId,
      months: 2,
      active: true,
    },
    {
      email: 'la.bombonera@demo.co',
      owner: 'Jhon Cuéllar',
      name: 'La Bombonera',
      neighborhood: 'Los Pinos',
      planId: free.id,
      months: 1,
      active: true,
    },
    {
      email: 'multicanchas@demo.co',
      owner: 'Sandra Polanía',
      name: 'Multicanchas El Estadio',
      neighborhood: 'Juan XXIII',
      planId: basic.id,
      months: 0,
      active: false,
    },
  ];
  for (const c of clients) {
    const createdAt = monthsAgo(c.months);
    const owner = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash,
        displayName: c.owner,
        role: UserRole.ADMIN_NEGOCIO,
        verified: true,
        createdAt,
      },
    });
    await prisma.business.upsert({
      where: { ownerId: owner.id },
      update: {},
      create: {
        ownerId: owner.id,
        name: c.name,
        address: 'Dirección de demo',
        neighborhood: c.neighborhood,
        createdAt,
        subscription: {
          create: {
            planId: c.planId,
            isActive: c.active,
            since: createdAt,
            nextPayment: todayAt(0, 0, 10),
          },
        },
      },
    });
  }

  const players = [
    'Laura Restrepo',
    'Camilo Méndez',
    'Valentina Dussán',
    'Juan Pablo Ríos',
    'Daniela Cortés',
    'Sebastián Lugo',
    'Natalia Perdomo',
    'Andrés Trujillo',
    'Paula Ramírez',
  ];
  for (const [i, name] of players.entries()) {
    const email = `${name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z ]/g, '')
      .replace(/ /g, '.')}@demo.co`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        displayName: name,
        role: UserRole.JUGADOR,
        verified: true,
        createdAt: monthsAgo(i % 6),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
