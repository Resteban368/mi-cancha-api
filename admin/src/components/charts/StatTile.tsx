import type { ReactNode } from 'react';

/** Número protagonista con su contexto; no es un gráfico, no lleva color de datos. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-sm text-fg-2">{label}</p>
      <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-fg">{value}</p>
      {detail && <p className="mt-1 text-xs text-fg-3">{detail}</p>}
    </div>
  );
}
