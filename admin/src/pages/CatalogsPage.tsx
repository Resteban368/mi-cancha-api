import { useState, type FormEvent } from 'react';
import { LockIcon, PlusIcon } from '../components/icons';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
} from '../components/ui';
import { useToast } from '../lib/toast';
import { api, errorMessage } from '../lib/api';
import { SPORT_LABELS, toCatalogCode } from '../lib/format';
import type { Amenity, CourtSurface, PaymentMethod, Sport, SystemEnum } from '../lib/types';
import { useApi } from '../lib/useApi';

type CatalogKind = 'amenities' | 'payment-methods' | 'court-surfaces';
type CatalogItem = Amenity | PaymentMethod | CourtSurface;

const SPORTS: Sport[] = ['FUTBOL', 'PADEL', 'BALONCESTO', 'VOLEIBOL'];

const KIND_TEXT: Record<CatalogKind, { title: string; description: string; item: string; usage: string }> = {
  amenities: {
    title: 'Servicios',
    description: 'Lo que un negocio puede ofrecer (parqueadero, cafetería…).',
    item: 'servicio',
    usage: 'Negocios',
  },
  'payment-methods': {
    title: 'Métodos de pago',
    description: 'Medios con los que un negocio registra pagos.',
    item: 'método de pago',
    usage: 'Pagos',
  },
  'court-surfaces': {
    title: 'Superficies de cancha',
    description: 'Tipo de grama o piso que el negocio elige al crear una cancha.',
    item: 'superficie',
    usage: 'Canchas',
  },
};

export function CatalogsPage() {
  const enums = useApi<SystemEnum[]>('/admin/enums');
  return (
    <>
      <PageHeader
        title="Catálogos"
        description="Valores que la app muestra en listas. Desactivar un valor lo oculta sin borrar el historial."
      />
      <div className="flex flex-col gap-6">
        <CatalogCard kind="amenities" />
        <CatalogCard kind="payment-methods" />
        <CatalogCard kind="court-surfaces" />

        <Card
          title="Enums del sistema"
          description="Solo lectura: el código depende de estos valores. Cambiarlos requiere una migración y actualizar la app."
          actions={<Badge><LockIcon width={12} height={12} /> Fijos</Badge>}
        >
          {enums.error && (
            <div className="p-4">
              <ErrorBanner message={enums.error} onRetry={enums.reload} />
            </div>
          )}
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {enums.data?.map((e) => (
              <div key={e.name} className="rounded-lg border border-border p-4">
                <p className="font-mono text-sm font-semibold">{e.name}</p>
                <p className="mt-0.5 text-xs text-fg-3">{e.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.values.map((v) => (
                    <code key={v} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-fg-2">
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function CatalogCard({ kind }: { kind: CatalogKind }) {
  const notify = useToast();
  const text = KIND_TEXT[kind];
  const items = useApi<CatalogItem[]>(`/admin/catalogs/${kind}`);
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isPayment = kind === 'payment-methods';
  const isSurface = kind === 'court-surfaces';

  async function patch(item: CatalogItem, body: Record<string, unknown>, message: string) {
    setBusyId(item.id);
    try {
      await api(`/admin/catalogs/${kind}/${item.id}`, { method: 'PATCH', body });
      notify(message);
      items.reload();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title={text.title}
      description={text.description}
      actions={
        <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
          <PlusIcon /> Agregar
        </Button>
      }
    >
      {items.error && (
        <div className="p-4">
          <ErrorBanner message={items.error} onRetry={items.reload} />
        </div>
      )}
      {items.loading && !items.data ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Código</Th>
              {isPayment && <Th>Exige referencia</Th>}
              {isSurface && <Th>Deportes</Th>}
              <Th align="right">{text.usage}</Th>
              <Th>Activo</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.data?.map((item) => (
              <tr key={item.id} className={item.active ? '' : 'opacity-60'}>
                <Td className="font-medium">{item.name}</Td>
                <Td>
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-fg-2">{item.code}</code>
                </Td>
                {isPayment && (
                  <Td>
                    <Switch
                      checked={(item as PaymentMethod).requiresReference}
                      disabled={busyId === item.id}
                      label={`Exigir referencia en ${item.name}`}
                      onChange={(requiresReference) =>
                        patch(item, { requiresReference }, `${item.name}: ${requiresReference ? 'exige' : 'no exige'} referencia`)
                      }
                    />
                  </Td>
                )}
                {isSurface && (
                  <Td>
                    <SportsList sports={(item as CourtSurface).sports} />
                  </Td>
                )}
                <Td align="right" className="tabular">
                  {item.usageCount}
                </Td>
                <Td>
                  <Switch
                    checked={item.active}
                    disabled={busyId === item.id}
                    label={item.active ? `Desactivar ${item.name}` : `Activar ${item.name}`}
                    onChange={(active) => patch(item, { active }, `${item.name} ${active ? 'activad' : 'desactivad'}${isSurface ? 'a' : 'o'}`)}
                  />
                </Td>
                <Td align="right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                    Editar
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {editing && (
        <CatalogItemModal
          kind={kind}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name, created) => {
            setEditing(null);
            const o = isSurface ? 'a' : 'o';
            notify(created ? `${name} agregad${o}` : `${name} actualizad${o}`);
            items.reload();
          }}
        />
      )}
    </Card>
  );
}

function SportsList({ sports }: { sports: Sport[] }) {
  if (sports.length === 0) return <span className="text-xs text-fg-3">Todos</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {sports.map((s) => (
        <Badge key={s}>{SPORT_LABELS[s]}</Badge>
      ))}
    </div>
  );
}

function CatalogItemModal({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: CatalogKind;
  item: CatalogItem | null;
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const isPayment = kind === 'payment-methods';
  const isSurface = kind === 'court-surfaces';
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState(item ? String(item.sortOrder) : '');
  const [requiresReference, setRequiresReference] = useState(
    item && 'requiresReference' in item ? item.requiresReference : true,
  );
  const [sports, setSports] = useState<Sport[]>(item && 'sports' in item ? item.sports : []);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const body: Record<string, unknown> = { name: name.trim() };
    if (sortOrder !== '') body.sortOrder = Number(sortOrder);
    if (isPayment) body.requiresReference = requiresReference;
    if (isSurface) body.sports = sports;
    try {
      if (item) {
        await api(`/admin/catalogs/${kind}/${item.id}`, { method: 'PATCH', body });
      } else {
        await api(`/admin/catalogs/${kind}`, { method: 'POST', body: { ...body, code } });
      }
      onSaved(name.trim(), !item);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  const title = KIND_TEXT[kind].item;
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Editar ${title}` : `${isSurface ? 'Nueva' : 'Nuevo'} ${title}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="catalog-form" variant="primary" loading={saving}>
            {item ? 'Guardar' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form id="catalog-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Nombre visible">
          {(id) => (
            <Input
              id={id}
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!item && !codeTouched) setCode(toCatalogCode(e.target.value));
              }}
            />
          )}
        </Field>
        <Field
          label="Código"
          hint={item ? 'El código no se puede cambiar: la app lo usa como identificador.' : 'MAYÚSCULAS y _, se sugiere a partir del nombre. No se podrá cambiar.'}
        >
          {(id) => (
            <Input
              id={id}
              required
              pattern="[A-Z][A-Z0-9_]{1,39}"
              className="font-mono"
              disabled={Boolean(item)}
              value={code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
            />
          )}
        </Field>
        <Field label="Orden" hint="Posición en las listas de la app. Vacío = al final.">
          {(id) => <Input id={id} type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />}
        </Field>
        {isPayment && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Exige referencia</p>
              <p className="text-xs text-fg-3">Pide número de comprobante al registrar el pago.</p>
            </div>
            <Switch checked={requiresReference} onChange={setRequiresReference} label="Exige referencia" />
          </div>
        )}
        {isSurface && (
          <fieldset>
            <legend className="text-sm font-medium">Deportes</legend>
            <p className="mb-2 text-xs text-fg-3">
              Solo se ofrece en canchas de estos deportes. Sin ninguno marcado, aplica a todos.
            </p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((sport) => {
                const on = sports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSports(on ? sports.filter((s) => s !== sport) : SPORTS.filter((s) => s === sport || sports.includes(s)))
                    }
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      on ? 'bg-accent text-accent-fg' : 'border border-border bg-surface text-fg-2 hover:bg-surface-2'
                    }`}
                  >
                    {SPORT_LABELS[sport]}
                  </button>
                );
              })}
            </div>
            {item && (
              <p className="mt-2 text-xs text-fg-3">
                Quitar un deporte no cambia las canchas que ya la usan.
              </p>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
