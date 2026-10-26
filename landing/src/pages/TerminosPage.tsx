import type { ReactNode } from 'react';
import { CORREO, DOCUMENTO, DOMICILIO, TERMINOS_VIGENCIA, TITULAR } from '../legal';
import { POLICY_URL } from '../config';
import { Footer } from '../components/Footer';

/**
 * Términos y condiciones de Mi Cancha (Colombia). BORRADOR: completa los datos del titular en
 * src/legal.ts y pide que lo revise un abogado antes de darlo por definitivo.
 */
export function TerminosPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" aria-label="Mi Cancha, inicio">
            <img src="/brand/logo-h-light.png" alt="Mi Cancha" width={198} height={36} className="h-9 w-auto dark:hidden" />
            <img
              src="/brand/logo-h-dark.png"
              alt=""
              aria-hidden="true"
              width={198}
              height={36}
              className="hidden h-9 w-auto dark:block"
            />
          </a>
          <a href="/" className="text-sm font-semibold text-fg-2 hover:text-fg">
            ← Volver al inicio
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <article className="text-[15px] leading-relaxed text-fg-2">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">Legal</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-fg">Términos y condiciones</h1>
          <p className="mt-4 text-base">
            Estas son las reglas para usar Mi Cancha. Las escribimos para que se entiendan; si algo no te queda claro,
            escríbenos antes de aceptarlas.
          </p>
          <p className="mt-3 text-sm text-fg-3">Vigentes desde el {TERMINOS_VIGENCIA}.</p>

          <Seccion n={1} titulo="Quiénes somos">
            <p>
              Mi Cancha es un servicio prestado por {TITULAR}, identificado con {DOCUMENTO}, con domicilio en{' '}
              {DOMICILIO}. Nuestro correo de contacto es {CORREO}.
            </p>
            <p>
              Mi Cancha es un software: le da a cada negocio deportivo una página de reservas propia y un panel para
              administrar sus canchas, reservas, clientes y pagos. No somos dueños de canchas, no las alquilamos ni
              organizamos partidos.
            </p>
          </Seccion>

          <Seccion n={2} titulo="Quién contrata con quién">
            <p>Hay dos tipos de usuario, con reglas distintas:</p>
            <ul>
              <li>
                <strong>El negocio</strong> (dueño o administrador de canchas) contrata el servicio con nosotros y
                paga una suscripción. Define sus canchas, horarios, tarifas, anticipos y reglas de cancelación.
              </li>
              <li>
                <strong>El jugador</strong> usa gratis la página de reservas del negocio. Mi Cancha no le cobra nada
                por reservar.
              </li>
            </ul>
            <p>
              La cancha la alquila el negocio, no Mi Cancha. Cuando un jugador reserva, el acuerdo de alquiler es
              entre el jugador y el negocio: el precio, el estado de la cancha, el anticipo, las devoluciones y
              cualquier reclamo sobre el partido son responsabilidad del negocio. Nosotros ponemos el sistema donde
              eso se registra.
            </p>
          </Seccion>

          <Seccion n={3} titulo="Tu cuenta">
            <ul>
              <li>Tu contraseña es personal. Lo que se haga con tu cuenta se entiende hecho por ti.</li>
              <li>
                Los datos que registres deben ser reales. Una reserva a nombre de otra persona o con un celular
                inventado le daña la agenda al negocio.
              </li>
              <li>Si crees que alguien entró a tu cuenta, cambia la contraseña y avísanos.</li>
              <li>
                El negocio responde por las personas a las que da acceso a su panel, porque ahí se ven los datos de
                contacto de sus clientes.
              </li>
            </ul>
          </Seccion>

          <Seccion n={4} titulo="Reservas, pagos y cancelaciones">
            <ul>
              <li>
                Una reserva existe cuando el sistema la registra y aparece en la agenda. Mientras tanto, el horario
                sigue disponible para cualquiera.
              </li>
              <li>
                Mi Cancha no procesa pagos de reservas: el dinero del alquiler y de los anticipos va directamente al
                negocio, por los medios de pago que él defina. El sistema solo registra esos pagos para que el negocio
                los apruebe o los rechace.
              </li>
              <li>
                Cada negocio define su política de cancelación, devolución y de qué pasa si no te presentas. Cuando se
                cancela una reserva, el sistema la marca y registra la devolución de lo pagado, pero la devolución del
                dinero la hace el negocio.
              </li>
              <li>
                El negocio puede cancelar o bloquear turnos (mantenimiento, torneos, clima). Si te cancelan una
                reserva que pagaste, el reclamo es con el negocio.
              </li>
            </ul>
          </Seccion>

          <Seccion n={5} titulo="La suscripción del negocio">
            <ul>
              <li>
                Al registrar tu negocio tienes una prueba gratis de 15 días, sin tarjeta, con hasta 2 canchas y todo el
                panel.
              </li>
              <li>
                Después eliges un plan según la cantidad de canchas. Los precios vigentes se publican en{' '}
                <a href="/#planes">la sección de planes</a> y se pagan por mes, por el medio acordado con nosotros.
              </li>
              <li>
                Si la prueba termina o la suscripción queda inactiva, puedes seguir consultando toda tu información,
                pero no crear reservas ni canchas, y tu página de reservas deja de recibir reservas en línea hasta que
                reactives un plan. Tus datos no se borran por eso.
              </li>
              <li>
                Puedes cancelar la suscripción cuando quieras. La cancelación aplica al final del período ya pagado y
                no da lugar a devolución del tiempo usado.
              </li>
              <li>
                Si cambiamos los precios, te avisamos con al menos 30 días de anticipación. Si no te sirven, puedes
                cancelar antes de que empiecen a regir.
              </li>
              <li>Si decides irte, puedes pedirnos una copia de tu información y te la entregamos.</li>
            </ul>
          </Seccion>

          <Seccion n={6} titulo="Lo que subes: fotos y contenido">
            <p>
              El sistema te permite subir fotos de tu negocio y de tus canchas, y escribir sus descripciones. Al
              hacerlo declaras que tienes derecho a usar ese contenido.
            </p>
            <ul>
              <li>No subas fotos, logos o marcas de terceros sin su permiso.</li>
              <li>No subas datos de otras personas que no hagan falta para la reserva.</li>
            </ul>
            <p>
              Nos autorizas a almacenar y mostrar ese contenido solo para que el servicio funcione, por ejemplo para
              mostrar tus fotos en tu página de reservas. Si alguien reclama por un contenido, escríbenos a {CORREO}{' '}
              indicando cuál es, dónde está y por qué tienes derecho sobre él. Podemos retirarlo mientras se resuelve
              y avisaremos a quien lo subió.
            </p>
          </Seccion>

          <Seccion n={7} titulo="De quién es cada cosa">
            <ul>
              <li>El software, el diseño, la marca Mi Cancha y su código son nuestros.</li>
              <li>
                La información de tu negocio (reservas, clientes, tarifas y pagos) es tuya. No la vendemos, no la
                compartimos con otros negocios y no la usamos para favorecer a tu competencia.
              </li>
              <li>
                Podemos mencionar el nombre de tu negocio como cliente de Mi Cancha. Si no quieres, escríbenos y lo
                retiramos.
              </li>
            </ul>
          </Seccion>

          <Seccion n={8} titulo="Datos personales">
            <p>
              Tratamos los datos personales según la Ley 1581 de 2012 y sus decretos reglamentarios. Qué datos
              recogemos, para qué y cómo ejercer tus derechos está en la{' '}
              <a href={POLICY_URL}>política de tratamiento de datos</a>. Para prestar el servicio usamos proveedores
              tecnológicos (alojamiento, base de datos y envío de mensajes de texto), que pueden estar fuera de
              Colombia.
            </p>
            <p>
              Respecto de los datos de sus clientes, el negocio es responsable de tratarlos conforme a la ley; Mi
              Cancha los trata por cuenta del negocio para que el sistema funcione.
            </p>
          </Seccion>

          <Seccion n={9} titulo="Uso aceptable">
            <p>No está permitido:</p>
            <ul>
              <li>Reservar horarios en masa para revenderlos o dejar canchas bloqueadas.</li>
              <li>Registrar reservas falsas, propias o de terceros.</li>
              <li>Intentar acceder a la información de otro negocio o de otro jugador.</li>
              <li>Automatizar peticiones, escanear el sistema o hacerle pruebas de carga sin autorización escrita.</li>
            </ul>
            <p>
              Si esto pasa podemos suspender la cuenta y, si es grave o se repite, cerrarla.
            </p>
          </Seccion>

          <Seccion n={10} titulo="Hasta dónde respondemos">
            <p>
              Trabajamos para que Mi Cancha funcione siempre, pero puede tener interrupciones, porque depende de
              internet y de servicios de terceros.
            </p>
            <ul>
              <li>No respondemos por lo que haga o deje de hacer un negocio con sus clientes.</li>
              <li>No respondemos por lucro cesante ni por daños indirectos.</li>
              <li>
                Frente a un negocio, nuestra responsabilidad total se limita a lo que nos pagó en los 12 meses
                anteriores al hecho.
              </li>
              <li>
                Nada de lo anterior limita los derechos que la Ley 1480 de 2011 (Estatuto del Consumidor) le reconoce
                a quien sea consumidor, ni nuestra responsabilidad por dolo o culpa grave.
              </li>
            </ul>
          </Seccion>

          <Seccion n={11} titulo="Cambios en estos términos">
            <p>
              Podemos actualizarlos. Si un cambio te afecta de forma importante, te avisaremos por correo o dentro del
              sistema con al menos 15 días de anticipación. Si sigues usando Mi Cancha después de esa fecha, se
              entiende que aceptas la nueva versión. La fecha de arriba indica qué versión estás leyendo.
            </p>
          </Seccion>

          <Seccion n={12} titulo="Ley aplicable y reclamos">
            <p>
              Estos términos se rigen por las leyes de la República de Colombia, incluidas la Ley 527 de 1999 sobre
              comercio electrónico y, cuando aplique, la Ley 1480 de 2011. Cualquier controversia se resolverá ante
              los jueces competentes de {DOMICILIO}.
            </p>
            <p>
              Si eres consumidor, conservas tu derecho a acudir a la Superintendencia de Industria y Comercio o a los
              jueces que la ley te permita.
            </p>
            <p>Antes de llegar a eso, escríbenos a {CORREO}: casi todo se resuelve ahí.</p>
          </Seccion>
        </article>
      </main>

      <Footer />
    </>
  );
}

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3 [&_a]:font-semibold [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h2 className="text-xl font-extrabold text-fg">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  );
}
