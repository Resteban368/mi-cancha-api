import { useState } from 'react';
import { formatNumber } from '../../lib/format';

/**
 * Barras horizontales de una sola serie (magnitud por categoría). Una serie no
 * lleva leyenda: el título de la tarjeta la nombra. El valor va en la punta.
 */
export function BarList({
  data,
  unit,
}: {
  data: { label: string; count: number }[];
  unit: [singular: string, plural: string];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ul className="flex flex-col gap-3" aria-label="Gráfico de barras">
      {data.map((d) => {
        const share = total === 0 ? 0 : Math.round((d.count / total) * 100);
        const isHovered = hovered === d.label;
        return (
          <li
            key={d.label}
            className="relative grid grid-cols-[minmax(80px,30%)_1fr] items-center gap-3"
            onMouseEnter={() => setHovered(d.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="truncate text-sm text-fg-2">{d.label}</span>
            <div className="flex h-7 items-center gap-2">
              <div
                className="h-5 rounded-r-[4px] bg-series-1 transition-opacity"
                style={{
                  width: `${(d.count / max) * 85}%`,
                  minWidth: d.count > 0 ? 3 : 0,
                  opacity: hovered && !isHovered ? 0.55 : 1,
                }}
              />
              <span className="tabular text-sm font-medium text-fg">{formatNumber(d.count)}</span>
            </div>
            {isHovered && (
              <div
                role="tooltip"
                className="pointer-events-none absolute -top-9 left-[30%] z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-fg shadow-md"
              >
                <span className="font-medium">{d.label}</span>: {formatNumber(d.count)}{' '}
                {d.count === 1 ? unit[0] : unit[1]} · {share}%
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
