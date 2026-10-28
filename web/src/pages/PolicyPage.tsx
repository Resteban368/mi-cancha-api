import { Header } from '../components/Header';
import { Card } from '../components/ui';

/**
 * BORRADOR de la política de tratamiento de datos (Ley 1581 de 2012). Debe
 * revisarla un abogado y completarse con los datos del responsable antes de
 * usarla con usuarios reales. Si cambia, actualiza DATA_POLICY_VERSION en la API.
 */
export function PolicyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="prose-sm flex flex-col gap-3 text-sm leading-relaxed text-fg-2">
          <h1 className="text-xl font-bold text-fg">Política de tratamiento de datos personales</h1>
          <p className="text-xs text-fg-3">Versión 2026-10-15 · Borrador</p>
          <p>
            En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, Mi Cancha informa cómo trata los datos
            personales de quienes se registran para reservar canchas deportivas.
          </p>
          <h2 className="font-semibold text-fg">Responsable</h2>
          <p>[Mi Cancha, Florencia, Caquetá, Colombia].</p>
          <h2 className="font-semibold text-fg">Datos que recolectamos</h2>
          <p>
            Nombre, correo electrónico, celular, número de cédula y, si los entregas, fecha de nacimiento y deporte
            favorito. También el historial de tus reservas y pagos en cada sede.
          </p>
          <h2 className="font-semibold text-fg">Finalidades</h2>
          <ul className="list-disc pl-5">
            <li>Crear y administrar tu cuenta e identificarte al iniciar sesión.</li>
            <li>Registrar tus reservas y compartirlas con la sede donde reservas, para que te atienda y te cobre.</li>
            <li>Contactarte sobre tus reservas.</li>
            <li>Elaborar estadísticas internas del uso del servicio.</li>
          </ul>
          <h2 className="font-semibold text-fg">Con quién los compartimos</h2>
          <p>
            Con la sede deportiva en la que reservas (nombre, celular, cédula y los datos de la reserva) y con los
            proveedores tecnológicos que alojan el servicio, bajo acuerdos de confidencialidad.
          </p>
          <h2 className="font-semibold text-fg">Tus derechos</h2>
          <p>
            Puedes conocer, actualizar, rectificar y suprimir tus datos, revocar esta autorización y presentar quejas
            ante la Superintendencia de Industria y Comercio. Para ejercerlos escribe a [correo de contacto]; responderemos
            en los plazos de ley.
          </p>
          <h2 className="font-semibold text-fg">Vigencia</h2>
          <p>Los datos se conservan mientras tengas una cuenta activa o lo exija la ley.</p>
        </Card>
      </main>
    </>
  );
}
