import { BarList } from '../components/charts/BarList';
import { GroupedColumns } from '../components/charts/GroupedColumns';
import { StatTile } from '../components/charts/StatTile';
import { OtpStatsSection } from '../components/OtpStatsSection';
import { RecentAudit } from '../components/RecentAudit';
import { Card, ErrorBanner, PageHeader, Skeleton } from '../components/ui';
import { formatCop, formatNumber } from '../lib/format';
import type { Dashboard } from '../lib/types';
import { useApi } from '../lib/useApi';

export function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>('/admin/dashboard');

  return (
    <>
      <PageHeader title="Dashboard" description="Cómo va la plataforma hoy." />
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        data && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Clientes"
                value={formatNumber(data.clients.total)}
                detail={`${data.clients.active} con plan activo · ${data.clients.newLast30Days} nuevos en 30 días`}
              />
              <StatTile
                label="Usuarios"
                value={formatNumber(data.users.total)}
                detail={`${data.users.players} jugadores · ${data.users.businessAdmins} negocios`}
              />
              <StatTile
                label="Ingreso mensual recurrente"
                value={formatCop(data.monthlyRecurringRevenue)}
                detail="Suma de los planes activos"
              />
              <StatTile
                label="Canchas activas"
                value={formatNumber(data.activeCourts)}
                detail={`${formatNumber(data.reservationsLast30Days)} reservas en 30 días`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card
                title="Altas por mes"
                description="Clientes y jugadores nuevos, últimos 6 meses"
                className="lg:col-span-3"
              >
                <div className="px-5 py-5">
                  <GroupedColumns
                    data={data.signupsByMonth}
                    series={[
                      { key: 'clients', label: 'Clientes', color: 'var(--series-1)' },
                      { key: 'players', label: 'Jugadores', color: 'var(--series-2)' },
                    ]}
                  />
                </div>
              </Card>

              <div className="flex flex-col gap-6 lg:col-span-2">
                <Card title="Clientes por plan">
                  <div className="px-5 py-5">
                    <BarList data={data.clientsByPlan} unit={['cliente', 'clientes']} />
                  </div>
                </Card>
                <Card title="Usuarios por rol">
                  <div className="px-5 py-5">
                    <BarList
                      data={[
                        { label: 'Jugadores', count: data.users.players },
                        { label: 'Negocios', count: data.users.businessAdmins },
                        { label: 'Super admin', count: data.users.superAdmins },
                      ]}
                      unit={['usuario', 'usuarios']}
                    />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )
      )}

      <div className="mt-10 flex flex-col gap-10">
        <OtpStatsSection />
        <RecentAudit />
      </div>
    </>
  );
}
