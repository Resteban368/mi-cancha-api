import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useToast } from '../lib/toast';
import type { ClientDetail } from '../lib/types';
import { Badge, Card, Switch } from './ui';

const TITLE = 'Ventas e inventario';

/** Módulos adicionales del cliente (hoy: Ventas e inventario). */
export function ClientModules({
  client,
  onChanged,
}: {
  client: ClientDetail;
  onChanged: () => void;
}) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const sales = client.modules.sales;

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await api(`/admin/clients/${client.id}/modules`, {
        method: 'PATCH',
        body: { sales: enabled },
      });
      notify(`${TITLE} ${enabled ? 'activado' : 'desactivado'} para ${client.name}`);
      onChanged();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Módulos" description="Funciones adicionales que se activan por cliente">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg">{TITLE}</span>
            <Badge tone={sales.enabled ? 'success' : 'neutral'}>
              {sales.enabled ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-fg-2">
            Productos, consumos cargados a las reservas, ventas sueltas, caja del día con
            arqueo y cierre, e inventario: stock por producto que se descuenta al vender,
            entradas de mercancía, ajustes por conteo y alertas de stock bajo.
          </p>
          <p className="mt-1 text-xs text-fg-3">
            {sales.enabled && sales.enabledAt
              ? `Activo desde ${formatDate(sales.enabledAt)}`
              : 'El negocio decide qué productos llevan control de stock.'}
          </p>
        </div>
        <Switch
          checked={sales.enabled}
          disabled={busy}
          label={`${sales.enabled ? 'Desactivar' : 'Activar'} ${TITLE}`}
          onChange={toggle}
        />
      </div>
    </Card>
  );
}
