import { whatsapp } from '../config';
import { Icon, type IconName } from './Icon';
import { Reveal } from './Reveal';
import { CtaLink } from './ui';

// Módulo opcional «Ventas e inventario» (POS, inventario, caja y proveedores). Se suma a cualquier plan.

const PILARES: { icono: IconName; titulo: string; texto: string; puntos: string[] }[] = [
  {
    icono: 'carrito',
    titulo: 'Punto de venta ágil',
    texto: 'Vende bebidas, snacks, indumentaria y alquiler de implementos en segundos, sin filas.',
    puntos: [
      'Buscador por nombre o categoría',
      'Efectivo, Nequi, Daviplata, datáfono o transferencia',
      'Venta suelta o cargada a la reserva de la cancha',
      'Recibo detallado, descuentos y notas',
    ],
  },
  {
    icono: 'inventario',
    titulo: 'Inventario en tiempo real',
    texto: 'Sin descuadres ni productos agotados en los días de más movimiento.',
    puntos: [
      'Cada venta descuenta el stock al instante',
      'Entradas de mercancía con costo unitario',
      'Alertas de stock bajo',
      'Ajustes por merma o conteo físico, con historial (kárdex)',
    ],
  },
  {
    icono: 'caja',
    titulo: 'Caja, arqueo y cuadre',
    texto: 'Control de cada peso que entra y sale, turno por turno.',
    puntos: [
      'Apertura con base en efectivo',
      'Ingresos, retiros y pagos a proveedores',
      'Cuadre: efectivo esperado contra el contado',
      'Resumen por método de pago e historial de cierres',
    ],
  },
  {
    icono: 'proveedor',
    titulo: 'Proveedores y catálogo',
    texto: 'Toda la información de tus distribuidores en un solo lugar.',
    puntos: [
      'Directorio de proveedores con sus contactos',
      'Cada entrada de mercancía asociada a su proveedor',
      'Precio de costo y de venta para medir tu margen',
    ],
  },
];

const BENEFICIOS: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'rayo', titulo: 'Más ingresos por sede', texto: 'Vende hidratación, comida y accesorios en cada reserva y torneo.' },
  { icono: 'candado', titulo: 'Cero descuadres de caja', texto: 'Cada turno abre y cierra con un arqueo transparente.' },
  { icono: 'grafica', titulo: 'Inventario sin sorpresas', texto: 'Sabes qué te deja más ganancia y qué hay que reponer.' },
  { icono: 'capas', titulo: 'Todo en una plataforma', texto: 'Reservas, clientes, pagos, inventario y ventas, juntos.' },
];

const STOCK = [
  { nombre: 'Agua 1L', precio: '$2.500', und: 29 },
  { nombre: 'Cerveza Águila', precio: '$5.000', und: 61 },
  { nombre: 'Gatorade', precio: '$6.000', und: 30 },
];

export function Ventas() {
  return (
    <section id="ventas" className="tema-oscuro relative overflow-hidden bg-bg px-4 py-20 text-fg sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[620px] rounded-full bg-accent/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/50 px-4 py-1.5 text-xs font-bold text-accent-text">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Módulo opcional · se suma a cualquier plan
            </span>
            <h2 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
              Ventas e inventario: tu tienda y tu caja, junto a tus canchas.
            </h2>
            <p className="mt-4 text-base text-fg-2 sm:text-lg">
              Convierte tu sede deportiva en un negocio más rentable: gestiona la tienda, la cafetería, los alquileres
              y la caja en un solo lugar y en tiempo real.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {BENEFICIOS.map((b) => (
                <li key={b.titulo} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                    <Icon name={b.icono} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{b.titulo}</span>
                    <span className="block text-sm text-fg-3">{b.texto}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9">
              <CtaLink href={whatsapp('Hola, quiero agregar el módulo de ventas e inventario a mi plan de Mi Cancha.')}>
                Quiero el módulo de ventas
              </CtaLink>
            </div>
          </div>

          {/* Ejemplo de las pantallas de Ventas e Inventario del panel. */}
          <div className="mx-auto w-full max-w-md space-y-4">
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/40">
              <p className="text-xs font-semibold tracking-wider text-fg-3 uppercase">Ventas de hoy</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
                  <p className="text-xs text-fg-3">Total vendido</p>
                  <p className="mt-1 text-2xl font-extrabold">$50.000</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-4">
                  <p className="text-xs text-fg-3">Cargado a reservas</p>
                  <p className="mt-1 text-2xl font-extrabold">$50.000</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-bold">10 × Cerveza Águila</p>
                  <p className="text-xs text-fg-3">Cancha 2 · Fútbol 5 · turno 10:00 a. m.</p>
                </div>
                <span className="rounded-full border border-accent/50 px-2.5 py-1 text-[11px] font-bold text-accent-text">
                  A la reserva
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wider text-fg-3 uppercase">Inventario</p>
                <span className="text-xs font-bold text-accent-text">Sin alertas</span>
              </div>
              <ul className="mt-3 space-y-2">
                {STOCK.map((p) => (
                  <li key={p.nombre} className="flex items-center justify-between rounded-xl bg-surface-2/60 px-4 py-2.5">
                    <span>
                      <span className="block text-sm font-bold">{p.nombre}</span>
                      <span className="block text-xs text-fg-3">{p.precio}</span>
                    </span>
                    <span className="text-lg font-extrabold">
                      {p.und} <span className="text-xs font-semibold text-fg-3">und</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-center text-xs text-fg-3">Ejemplo ilustrativo del panel</p>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map((p, i) => (
            <Reveal key={p.titulo} delay={(i % 4) * 80}>
              <article className="h-full rounded-2xl border border-border bg-surface p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                  <Icon name={p.icono} />
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-fg-2">{p.texto}</p>
                <ul className="mt-4 space-y-2">
                  {p.puntos.map((punto) => (
                    <li key={punto} className="flex gap-2 text-sm text-fg-2">
                      <span aria-hidden="true" className="font-black text-accent-text">
                        ✓
                      </span>
                      {punto}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
