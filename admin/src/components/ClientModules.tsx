import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useToast } from '../lib/toast';
import type { ClientDetail } from '../lib/types';
import { Badge, Card, Switch } from './ui';

type ModuleKey = 'sales' | 'inventory';

const MODULES: {
  key: ModuleKey;
  title: string;
  description: string;
  requires?: string;
}[] = [
  {
    key: 'sales',
    title: 'Ventas y caja',
    description:
      'Productos, consumos cargados a las reservas, ventas sueltas, caja del día con arqueo y cierre, y ventas en el dashboard.',
  },
  {
    key: 'inventory',
    title: 'Inventario',
    description:
      'Stock por producto: se descuenta al vender, entradas de mercancía, ajustes por conteo físico y alertas de stock bajo.',
    requires: 'Necesita Ventas y caja: al activarlo se activa también.',
  },
];

/** Módulos adicionales del cliente (Ventas y caja, Inventario). */
export function ClientModules({
  client,
  onChanged,
}: {
  client: ClientDetail;
  onChanged: () => void;
}) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle(key: ModuleKey, enabled: boolean) {
    const title = MODULES.find((m) => m.key === key)!.title;
    setBusy(true);
    try {
      await api(`/admin/clients/${client.id}/modules`, {
        method: 'PATCH',
        body: { [key]: enabled },
      });
      notify(
        `${title} ${enabled ? 'activado' : 'desactivado'} para ${client.name}` +
          (key === 'sales' && !enabled && client.modules.inventory.enabled
            ? ' (también Inventario)'
            : ''),
      );
      onChanged();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Módulos" description="Funciones adicionales que se activan por cliente">
      <div className="divide-y divide-border">
        {MODULES.map((module) => {
          const state = client.modules[module.key];
          return (
            <div
              key={module.key}
              className="flex flex-wrap items-start justify-between gap-4 p-5"
            >
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{module.title}</span>
                  <Badge tone={state.enabled ? 'success' : 'neutral'}>
                    {state.enabled ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-fg-2">{module.description}</p>
                {state.enabled && state.enabledAt ? (
                  <p className="mt-1 text-xs text-fg-3">
                    Activo desde {formatDate(state.enabledAt)}
                  </p>
                ) : (
                  module.requires && (
                    <p className="mt-1 text-xs text-fg-3">{module.requires}</p>
                  )
                )}
              </div>
              <Switch
                checked={state.enabled}
                disabled={busy}
                label={`${state.enabled ? 'Desactivar' : 'Activar'} ${module.title}`}
                onChange={(enabled) => toggle(module.key, enabled)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
