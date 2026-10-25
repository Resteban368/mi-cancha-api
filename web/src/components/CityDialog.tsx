import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { ALL_CITIES, type SavedCity } from '../lib/location';
import type { DirectoryCity } from '../lib/types';
import { Alert, Button, Dialog, Skeleton } from './ui';
import { CloseIcon, SearchIcon } from './PitchChrome';

/** Para buscar sin tildes ni mayúsculas: «bogota» encuentra «Bogotá». */
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * «¿En qué ciudad buscas?»: lista, con buscador, solo de las ciudades que ya tienen sedes
 * registradas (no todas las de Colombia). Se abre solo la primera vez que entra con sesión.
 */
export default function CityDialog({
  current,
  onSelect,
  onClose,
}: {
  current: SavedCity | null;
  onSelect: (city: SavedCity) => void;
  onClose: () => void;
}) {
  const [cities, setCities] = useState<DirectoryCity[] | null>(null);
  const [error, setError] = useState<string>();
  const [term, setTerm] = useState('');

  function load() {
    setError(undefined);
    api<DirectoryCity[]>('/public/cities').then(setCities, (e) => setError(errorMessage(e)));
  }
  useEffect(load, []);

  const shown = useMemo(() => {
    const q = plain(term.trim());
    return (cities ?? []).filter((c) => !q || plain(`${c.name} ${c.department.name}`).includes(q));
  }, [cities, term]);

  const total = (cities ?? []).reduce((sum, c) => sum + c.businessCount, 0);
  const row = (selected: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition active:scale-[0.99] ${
      selected ? 'border-accent bg-accent/10 font-semibold' : 'border-hairline bg-surface hover:border-fg-3'
    }`;

  return (
    <Dialog open onClose={onClose} labelledBy="city-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="city-title" className="text-xl font-bold">
            ¿En qué ciudad buscas?
          </h2>
          <p className="mt-1 text-sm text-fg-2">Te mostramos las sedes de la ciudad que elijas. Puedes cambiarla cuando quieras.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-hover"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">Buscar ciudad</span>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar ciudad o departamento"
          className="w-full rounded-xl border border-hairline bg-surface-2 py-2.5 pl-10 pr-3 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>

      <div className="mt-3 flex max-h-[45dvh] flex-col gap-2 overflow-y-auto pr-0.5" role="listbox" aria-label="Ciudades con sedes">
        {error ? (
          <Alert>
            {error}{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Reintentar
            </button>
          </Alert>
        ) : !cities ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)
        ) : (
          <>
            {!term.trim() && (
              <button
                type="button"
                role="option"
                aria-selected={current?.cityId === null}
                onClick={() => onSelect(ALL_CITIES)}
                className={row(current?.cityId === null)}
              >
                <span>{ALL_CITIES.label}</span>
                <span className="tabular text-xs text-fg-3">{total} {total === 1 ? 'sede' : 'sedes'}</span>
              </button>
            )}
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={current?.cityId === c.id}
                onClick={() => onSelect({ cityId: c.id, label: c.name })}
                className={row(current?.cityId === c.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-xs font-normal text-fg-3">{c.department.name}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-fg-3">
                  {c.businessCount} {c.businessCount === 1 ? 'sede' : 'sedes'}
                </span>
              </button>
            ))}
            {shown.length === 0 && (
              <p className="py-4 text-center text-sm text-fg-3">
                {cities.length === 0 ? 'Aún no hay sedes con ciudad registrada.' : 'No hay sedes en esa ciudad todavía.'}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Ahora no
        </Button>
      </div>
    </Dialog>
  );
}
