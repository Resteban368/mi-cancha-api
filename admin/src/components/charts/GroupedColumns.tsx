import { useState } from 'react';
import { formatMonthLong, formatMonthShort, formatNumber } from '../../lib/format';
import { niceScale } from './scale';

export interface ColumnSeries<K extends string> {
  key: K;
  label: string;
  /** Variable CSS del color de la serie, p. ej. var(--series-1). */
  color: string;
}

const PLOT_HEIGHT = 200;

/**
 * Columnas agrupadas por mes, un solo eje Y. Con 2 series: leyenda siempre
 * visible, tooltip por mes y vista de tabla como alternativa accesible.
 */
export function GroupedColumns<K extends string>({
  data,
  series,
}: {
  data: ({ month: string } & Record<K, number>)[];
  series: ColumnSeries<K>[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const { max, ticks } = niceScale(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key]))));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-sm text-fg-2" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-sm text-fg-2 underline-offset-2 hover:text-fg hover:underline"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-fg-3">
              <th className="py-2 font-semibold">Mes</th>
              {series.map((s) => (
                <th key={s.key} className="py-2 text-right font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-border">
                <td className="py-2 text-fg-2">{formatMonthLong(d.month)}</td>
                {series.map((s) => (
                  <td key={s.key} className="tabular py-2 text-right text-fg">
                    {formatNumber(d[s.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* Eje Y */}
          <div className="relative w-6 shrink-0 text-right text-xs text-fg-3" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="tabular absolute right-0"
                style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${t === 0 ? 'border-fg-3/50' : 'border-grid'}`}
                  style={{ bottom: `${(t / max) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex">
                {data.map((d) => {
                  const isActive = active === d.month;
                  return (
                    <div
                      key={d.month}
                      className={`relative flex flex-1 items-end justify-center gap-[2px] rounded-md transition-colors ${isActive ? 'bg-surface-2/70' : ''}`}
                      onMouseEnter={() => setActive(d.month)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(d.month)}
                      onBlur={() => setActive(null)}
                      tabIndex={0}
                      aria-label={`${formatMonthLong(d.month)}: ${series
                        .map((s) => `${s.label} ${d[s.key]}`)
                        .join(', ')}`}
                    >
                      {series.map((s) => (
                        <div
                          key={s.key}
                          className="w-full max-w-6 rounded-t-[4px]"
                          style={{
                            height: `${(d[s.key] / max) * 100}%`,
                            minHeight: d[s.key] > 0 ? 3 : 0,
                            background: s.color,
                          }}
                        />
                      ))}
                      {isActive && (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md"
                        >
                          <p className="mb-1 font-medium text-fg">{formatMonthLong(d.month)}</p>
                          {series.map((s) => (
                            <p key={s.key} className="flex items-center gap-2 text-fg-2">
                              <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
                              {s.label}
                              <span className="tabular ml-auto pl-3 font-medium text-fg">{d[s.key]}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex">
              {data.map((d) => (
                <span key={d.month} className="flex-1 text-center text-xs capitalize text-fg-3">
                  {formatMonthShort(d.month)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
