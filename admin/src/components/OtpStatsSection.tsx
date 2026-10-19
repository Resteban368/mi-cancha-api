import { useState } from 'react';
import { formatDateTime, formatNumber, formatPhone, ROLE_LABELS } from '../lib/format';
import type { OtpStats } from '../lib/security-types';
import { useApi } from '../lib/useApi';
import { StatTile } from './charts/StatTile';
import { Badge, Card, EmptyState, ErrorBanner, Select, Skeleton, Table, Td, Th } from './ui';

const PERIODS = [7, 30, 90];

/** Un origen que pide códigos para varios celulares distintos se marca como sospechoso. */
const SUSPICIOUS_PHONES = 3;

/** Códigos SMS enviados: totales, por día y quién los pide más. */
export function OtpStatsSection() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<OtpStats>(`/admin/security/otp?days=${days}`);

  const rate = data && data.period.requests ? Math.round((data.period.verified / data.period.requests) * 100) : 0;

  return (
    <section aria-labelledby="otp-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="otp-title" className="text-lg font-semibold text-fg">
            Códigos SMS
          </h2>
          <p className="text-sm text-fg-3">Códigos de verificación enviados por mensaje de texto.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          Período
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período de los códigos SMS">
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                Últimos {p} días
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {!data ? (
        loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Hoy" value={formatNumber(data.totals.today)} detail="Códigos enviados desde las 00:00" />
            <StatTile label="Últimos 7 días" value={formatNumber(data.totals.last7Days)} />
            <StatTile label="Últimos 30 días" value={formatNumber(data.totals.last30Days)} />
            <StatTile label="Total enviados" value={formatNumber(data.totals.all)} detail="Desde el inicio" />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card
              title="Códigos por día"
              description={`${formatNumber(data.period.requests)} en ${data.days} días · ${formatNumber(
                data.period.verified,
              )} verificados (${rate}%)`}
              className="lg:col-span-3"
            >
              <div className="px-5 py-5">
                <DailyBars data={data.daily} />
              </div>
            </Card>

            <Card
              title="Orígenes con más códigos"
              description="IP anónima: la dirección real no se guarda"
              className="lg:col-span-2"
            >
              {data.topSources.length ? (
                <ul className="divide-y divide-border">
                  {data.topSources.map((s) => (
                    <li key={s.source} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <p className="font-mono text-fg">{s.source}</p>
                        <p className="text-xs text-fg-3">
                          {formatNumber(s.requests)} {s.requests === 1 ? 'código' : 'códigos'} ·{' '}
                          {formatNumber(s.phones)} {s.phones === 1 ? 'celular' : 'celulares'}
                        </p>
                      </div>
                      {s.phones >= SUSPICIOUS_PHONES && <Badge tone="warn">Varios celulares</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Sin datos">No hubo códigos en este período.</EmptyState>
              )}
            </Card>
          </div>

          <Card
            title="Quién pide más códigos"
            description={`Celulares con más códigos en los últimos ${data.days} días`}
          >
            {data.topPhones.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Celular</Th>
                    <Th>Usuario</Th>
                    <Th align="right">Códigos</Th>
                    <Th align="right">Verificados</Th>
                    <Th>Último pedido</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPhones.map((row) => (
                    <tr key={row.phone}>
                      <Td className="whitespace-nowrap font-medium">{formatPhone(row.phone)}</Td>
                      <Td>
                        {row.user ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{row.user.displayName}</span>
                            <Badge tone={row.user.role === 'JUGADOR' ? 'neutral' : 'success'}>
                              {ROLE_LABELS[row.user.role]}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-fg-3">Sin cuenta</span>
                        )}
                      </Td>
                      <Td align="right" className="tabular font-semibold">
                        {formatNumber(row.requests)}
                      </Td>
                      <Td align="right" className="tabular text-fg-2">
                        {formatNumber(row.verified)}
                      </Td>
                      <Td className="whitespace-nowrap text-fg-2">{formatDateTime(row.lastRequestAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Sin códigos">Nadie ha pedido códigos en este período.</EmptyState>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

const PLOT_HEIGHT = 160;

/** Barras por día (hora de Colombia) con tooltip y una vista de tabla como alternativa accesible. */
function DailyBars({ data }: { data: OtpStats['daily'] }) {
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const peak = Math.max(0, ...data.map((d) => d.count));
  const max = Math.max(1, peak);
  const shown = data.find((d) => d.date === active);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <p className="text-fg-2" aria-live="polite">
          {shown ? `${formatDay(shown.date)}: ${formatNumber(shown.count)}` : `Máximo en un día: ${formatNumber(peak)}`}
        </p>
        <button
          type="button"
          className="text-fg-2 underline-offset-2 hover:text-fg hover:underline"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-fg-3">
                <th className="py-1.5 font-semibold">Día</th>
                <th className="py-1.5 text-right font-semibold">Códigos</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="py-1.5">{formatDay(d.date)}</td>
                  <td className="tabular py-1.5 text-right">{formatNumber(d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="img"
          aria-label={`Códigos enviados por día, últimos ${data.length} días`}
          className="flex items-end gap-[3px]"
          style={{ height: PLOT_HEIGHT }}
          onMouseLeave={() => setActive(null)}
        >
          {data.map((d) => (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setActive(d.date)}
              title={`${formatDay(d.date)}: ${d.count}`}
            >
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : 2,
                  background: d.count ? 'var(--series-1)' : 'var(--grid)',
                  opacity: active && active !== d.date ? 0.5 : 1,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const day = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
function formatDay(date: string): string {
  return day.format(new Date(`${date}T12:00:00Z`)).replace('.', '');
}
