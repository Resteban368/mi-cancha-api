import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export type Opcion = { id: string; name: string };

/** Quita tildes y mayúsculas para buscar «bogota» y encontrar «Bogotá, D.C.». */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Selector con búsqueda (combobox). Pensado para listas largas, como las ~125 ciudades
 * de un departamento. Maneja la carga y el error del catálogo con «Reintentar».
 */
export function SearchSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  disabledHint,
  loading = false,
  loadError = false,
  onRetry,
  error,
}: {
  label: string;
  placeholder: string;
  options: Opcion[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledHint?: string;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  error?: string;
}) {
  const id = useId();
  const listId = `${id}-lista`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const seleccion = options.find((o) => o.id === value) ?? null;
  const filtradas = useMemo(() => {
    const q = normalizar(query.trim());
    return q ? options.filter((o) => normalizar(o.name).includes(q)) : options;
  }, [options, query]);

  // Cierra al hacer clic afuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Mantiene visible la opción activa al moverse con el teclado.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const abrir = () => {
    if (disabled || loading || loadError) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  };

  // Al abrir, el foco va al buscador para escribir de una vez.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const elegir = (opcion: Opcion) => {
    onChange(opcion.id);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[active]) elegir(filtradas[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  let texto = seleccion?.name ?? placeholder;
  if (loading) texto = 'Cargando…';
  else if (disabled && disabledHint) texto = disabledHint;

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={`${id}-boton`} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/50 bg-surface px-4 py-3 text-sm">
          <span className="text-danger">No pudimos cargar la lista.</span>
          <button type="button" onClick={onRetry} className="font-bold text-accent-text underline underline-offset-4">
            Reintentar
          </button>
        </div>
      ) : (
        <button
          id={`${id}-boton`}
          type="button"
          onClick={() => (open ? setOpen(false) : abrir())}
          disabled={disabled || loading}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={!!error}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? 'border-danger' : 'border-border hover:border-accent/60'
          } ${seleccion ? 'text-fg' : 'text-fg-3'}`}
        >
          <span className="truncate">{texto}</span>
          <span aria-hidden="true" className="text-fg-3">
            ▾
          </span>
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/20">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={filtradas[active] ? `${id}-op-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar…"
            className="w-full border-b border-border bg-surface-2 px-4 py-3 text-sm outline-none"
          />
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
            {filtradas.length === 0 && <li className="px-4 py-3 text-sm text-fg-3">Sin resultados</li>}
            {filtradas.map((o, i) => (
              <li
                key={o.id}
                id={`${id}-op-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.id === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
                className={`cursor-pointer px-4 py-2.5 text-sm ${i === active ? 'bg-accent-soft text-fg' : 'text-fg-2'} ${
                  o.id === value ? 'font-bold' : ''
                }`}
              >
                {o.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
