import { DOMICILIO, PRIVACIDAD_VIGENCIA, TELEFONO, TITULAR } from '../legal';
import { Correo, LegalLayout, Seccion } from '../components/LegalLayout';

/**
 * Política de privacidad y tratamiento de datos de Mi Cancha (Ley 1581 de 2012). BORRADOR:
 * completa los datos del titular en src/legal.ts y pide que la revise un abogado. Describe lo
 * que hace hoy el sistema (prisma/schema.prisma); si cambia qué datos se guardan o con qué
 * proveedores, actualízala.
 */
export function PrivacidadPage() {
  return (
    <LegalLayout
      titulo="Política de privacidad"
      intro="Qué datos guardamos, para qué, con quién los compartimos y cómo puedes consultarlos, corregirlos o pedir que los borremos."
      vigencia={PRIVACIDAD_VIGENCIA}
    >
      <Seccion n={1} titulo="Quién trata tus datos">
        <p>
          Los responsables del tratamiento son {TITULAR}, con domicilio en {DOMICILIO}. Para cualquier asunto
          sobre tus datos escríbenos a <Correo /> o al WhatsApp {TELEFONO}.
        </p>
        <p>Según quién seas, tratamos tus datos en un papel distinto:</p>
        <ul>
          <li>
            <strong>Dueños y administradores de negocios:</strong> somos responsables de los datos de tu cuenta, tu
            negocio y tu suscripción.
          </li>
          <li>
            <strong>Jugadores con cuenta en Mi Cancha:</strong> somos responsables de los datos de tu cuenta. Cuando
            reservas en un negocio, ese negocio recibe los datos de la reserva y responde por el uso que les dé.
          </li>
          <li>
            <strong>Clientes que registra un negocio</strong> (por ejemplo, alguien que reservó por teléfono): el
            responsable es el negocio. Nosotros solo guardamos esos datos por cuenta del negocio, como encargados, y no
            los usamos para nada propio.
          </li>
        </ul>
        <p>Esta política cumple la Ley 1581 de 2012 y sus normas reglamentarias (Decreto 1074 de 2015).</p>
      </Seccion>

      <Seccion n={2} titulo="Qué datos guardamos">
        <ul>
          <li>
            <strong>Del dueño o administrador del negocio:</strong> nombre, correo, celular y contraseña (guardada
            cifrada, nadie puede leerla). Del negocio: nombre, dirección, barrio, ciudad, ubicación en el mapa, fotos,
            canchas, horarios, tarifas y el estado de la suscripción.
          </li>
          <li>
            <strong>Del jugador con cuenta:</strong> nombre, correo, celular y cédula; si los das, fecha de nacimiento
            y deporte favorito. Si entras con Google o Apple, solo el identificador que ese servicio nos entrega, nunca
            tu contraseña. También tus reservas, tus pagos y la fecha y versión de la autorización que nos diste.
          </li>
          <li>
            <strong>De los clientes que registra un negocio:</strong> nombre, celular, cédula si el negocio la pide,
            deporte preferido, notas del negocio, reservas, asistencia, pagos y saldos.
          </li>
          <li>
            <strong>Del módulo de Ventas e inventario,</strong> si el negocio lo usa: productos, ventas, consumos
            cargados a las reservas, movimientos de inventario, aperturas y cierres de caja con su responsable, y los
            datos de contacto de sus proveedores (nombre, teléfono y correo).
          </li>
          <li>
            <strong>Técnicos y de seguridad:</strong> los códigos de verificación que enviamos por mensaje de texto
            (guardados cifrados y vencen en minutos); un registro de las acciones de administración y seguridad, en el
            que guardamos una huella cifrada e irreversible de la dirección IP, no la IP; y, si activas las
            notificaciones, lo que el navegador necesita para enviártelas (una dirección técnica y el tipo de
            navegador).
          </li>
        </ul>
        <p>No pedimos ni guardamos datos de tarjetas, datos de salud ni otros datos sensibles.</p>
      </Seccion>

      <Seccion n={3} titulo="Para qué los usamos">
        <ul>
          <li>Crear y administrar las cuentas e identificarte al iniciar sesión.</li>
          <li>Registrar reservas, pagos, cancelaciones y devoluciones, y mostrarlas en la agenda del negocio.</li>
          <li>Que el negocio pueda contactarte por tu reserva.</li>
          <li>Mostrarle al negocio sus métricas: ocupación, ingresos, horarios con más movimiento y clientes.</li>
          <li>Enviarte avisos del servicio, como una reserva nueva o un cambio importante.</li>
          <li>Verificar tu celular con un código y prevenir fraudes y abusos.</li>
          <li>Administrar la suscripción del negocio y darle soporte.</li>
        </ul>
        <p>
          No vendemos tus datos, no los usamos para publicidad y no se los pasamos a otros negocios distintos de aquel
          donde reservas.
        </p>
      </Seccion>

      <Seccion n={4} titulo="Tu autorización">
        <p>
          Al crear tu cuenta, registrar tu negocio o hacer una reserva nos autorizas a tratar tus datos para las
          finalidades de esta política. Guardamos la prueba de esa autorización (cuándo la diste y qué versión
          aceptaste). Puedes revocarla en cualquier momento, salvo que debamos conservar algún dato por una obligación
          legal o contractual.
        </p>
      </Seccion>

      <Seccion n={5} titulo="Con quién los compartimos">
        <p>
          Con el negocio donde reservas, para que te atienda y te cobre. Y con los proveedores que hacen falta para que
          el servicio funcione, que actúan como encargados: solo ven lo necesario y no pueden usar los datos para otra
          cosa.
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> (Estados Unidos): servidores donde corre Mi Cancha. Ve los datos en tránsito y los
            registros técnicos de acceso.
          </li>
          <li>
            <strong>Neon</strong> (servidores en Estados Unidos): base de datos donde se guarda la información del
            servicio, incluidas las fotos.
          </li>
          <li>
            <strong>Twilio</strong> (Estados Unidos): envío de los códigos de verificación por mensaje de texto. Ve tu
            celular y el mensaje.
          </li>
          <li>
            <strong>Google y Apple:</strong> solo si eliges iniciar sesión con ellos, o si activas las notificaciones
            del navegador, que se entregan por sus servicios de mensajería.
          </li>
          <li>
            <strong>Google Fonts:</strong> la tipografía de la página se descarga de servidores de Google, que reciben
            la dirección IP de tu navegador.
          </li>
        </ul>
        <p>
          También podemos entregar datos cuando lo ordene una autoridad competente. Si la ley nos lo permite, te
          avisaremos.
        </p>
      </Seccion>

      <Seccion n={6} titulo="Datos fuera de Colombia">
        <p>
          Los servidores de nuestros proveedores están en Estados Unidos, que la Superintendencia de Industria y
          Comercio reconoce como un país con nivel adecuado de protección de datos (Circular Externa 005 de 2017). Esos
          proveedores tratan los datos por nuestra cuenta, bajo sus condiciones contractuales de protección de datos.
          Al aceptar esta política autorizas esa transmisión.
        </p>
      </Seccion>

      <Seccion n={7} titulo="Tus derechos">
        <p>Como titular de los datos tienes derecho a:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Saber qué uso le hemos dado a tus datos.</li>
          <li>
            Revocar la autorización y pedir que borremos tus datos, cuando no exista un deber legal o contractual de
            conservarlos.
          </li>
          <li>Acceder gratis a tus datos.</li>
          <li>
            Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber hecho tu consulta o
            reclamo con nosotros.
          </li>
        </ul>
      </Seccion>

      <Seccion n={8} titulo="Cómo ejercer tus derechos">
        <p>
          Escríbenos a <Correo /> desde el correo de tu cuenta o indicando tu nombre, tu celular y lo que necesitas. Si
          tus datos los registró un negocio, puedes pedírselo a él o a nosotros, y se lo trasladaremos.
        </p>
        <ul>
          <li>
            <strong>Consultas</strong> (qué datos tenemos y cómo los usamos): respondemos en máximo 10 días hábiles,
            prorrogables 5 días hábiles más si te avisamos el motivo.
          </li>
          <li>
            <strong>Reclamos</strong> (corregir, actualizar, borrar o revocar): respondemos en máximo 15 días hábiles,
            prorrogables 8 días hábiles más si te avisamos el motivo.
          </li>
        </ul>
      </Seccion>

      <Seccion n={9} titulo="Cuánto tiempo los guardamos">
        <ul>
          <li>Los datos de tu cuenta, mientras la cuenta esté activa.</li>
          <li>
            Las reservas y pagos de un negocio, mientras el negocio use Mi Cancha: son su historial. Una reserva
            cancelada no se borra, queda marcada como cancelada.
          </li>
          <li>Los códigos de verificación vencen a los pocos minutos y no sirven después.</li>
          <li>
            Cuando pidas cerrar tu cuenta o borrar tus datos, los suprimimos, salvo lo que la ley nos obligue a
            conservar (por ejemplo, información contable o tributaria) y solo por el tiempo que lo exija.
          </li>
        </ul>
      </Seccion>

      <Seccion n={10} titulo="Seguridad">
        <ul>
          <li>Toda la información viaja cifrada (HTTPS).</li>
          <li>Las contraseñas se guardan cifradas de forma irreversible: nadie en Mi Cancha puede leerlas.</li>
          <li>Cada negocio solo puede ver y modificar sus propios datos; el sistema lo controla en el servidor.</li>
          <li>
            Si ocurre un incidente de seguridad que afecte tus datos, te avisaremos y lo reportaremos a la
            Superintendencia de Industria y Comercio, como exige la ley.
          </li>
        </ul>
      </Seccion>

      <Seccion n={11} titulo="Menores de edad">
        <p>
          Las cuentas son para mayores de 18 años. Un menor puede jugar, claro: en ese caso la reserva la hace un
          adulto, que es quien entrega sus datos. Si detectamos una cuenta de un menor sin autorización de su
          representante legal, la eliminaremos.
        </p>
      </Seccion>

      <Seccion n={12} titulo="Cookies y lo que se guarda en tu navegador">
        <p>
          No usamos cookies de publicidad ni de seguimiento: no tenemos Google Analytics, píxeles de redes sociales ni
          nada parecido. Esta página no guarda nada en tu navegador.
        </p>
        <p>En la página de reservas se guarda solo lo necesario para que funcione:</p>
        <ul>
          <li>Tu sesión, para que no tengas que entrar cada vez. Se borra al cerrar sesión.</li>
          <li>La ciudad que elegiste para buscar canchas.</li>
          <li>Si lo eliges, la preferencia de modo claro u oscuro.</li>
        </ul>
        <p>Todo se borra si limpias los datos del sitio desde tu navegador.</p>
      </Seccion>

      <Seccion n={13} titulo="Cambios en esta política">
        <p>
          Si cambiamos esta política de forma importante, te avisaremos por correo o dentro del servicio antes de que
          empiece a aplicar y, si hace falta, te pediremos una nueva autorización. La fecha de arriba indica qué
          versión estás leyendo. Esta política hace parte de los <a href="/terminos/">términos y condiciones</a>.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
