'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, Link2, PlusCircle, TrendingUp, Wallet } from 'lucide-react';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { useVendor } from '@/components/vendor/VendorContext';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, PayoutPill, SourcePill, StatCard, StatusPill } from '@/components/vendor/parts';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatMoney, vendorFetch, type VendorDashboardData } from '@/lib/vendor-client';

function Dashboard() {
  const { user } = useAuth();
  const vendor = useVendor();
  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setData(await vendorFetch<VendorDashboardData>(user, '/api/vendor/dashboard'));
    } catch (e: any) {
      setError(e.message || 'No pudimos cargar tu resumen');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const currencies = data ? Object.keys(data.byCurrency).filter((c) => data.byCurrency[c].sales || data.byCurrency[c].commission) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${vendor.name.split(' ')[0] || 'vendedor'}`}
        description="Resumen de tus ventas y comisiones."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/vendedor/enlaces">
                <Link2 className="h-4 w-4" /> Mis enlaces
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/vendedor/reservas/nueva">
                <PlusCircle className="h-4 w-4" /> Nueva reserva
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading || !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
          <Panel>
            <LoadingBlock />
          </Panel>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Ventas" value={data.totals.reservations} hint={`${data.totals.manual} manuales · ${data.totals.online} online`} icon={<CalendarCheck className="h-4 w-4" />} />
            <StatCard label="Reservas activas" value={(data.byStatus.pending ?? 0) + (data.byStatus.reserved ?? 0)} hint={`${data.byStatus.completed ?? 0} completadas · ${data.byStatus.cancelled ?? 0} canceladas`} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Enlaces activos" value={`${data.links.active}/${data.links.total}`} hint="Códigos de referido" icon={<Link2 className="h-4 w-4" />} />
            <StatCard
              label="Comisión pendiente"
              value={
                currencies.length === 0
                  ? '—'
                  : currencies.map((c) => (
                      <div key={c} className="text-xl">
                        {formatMoney(data.byCurrency[c].pending + data.byCurrency[c].accrued, c)}
                      </div>
                    ))
              }
              hint="Pendiente + devengada"
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>

          {currencies.length > 0 && (
            <Panel title="Resumen por moneda">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Moneda</th>
                      <th className="px-4 py-2 font-medium">Ventas</th>
                      <th className="px-4 py-2 font-medium">Comisión total</th>
                      <th className="px-4 py-2 font-medium">Por cobrar</th>
                      <th className="px-4 py-2 font-medium">Cobrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.map((c) => {
                      const t = data.byCurrency[c];
                      return (
                        <tr key={c} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium uppercase">{c}</td>
                          <td className="px-4 py-3">{formatMoney(t.sales, c)}</td>
                          <td className="px-4 py-3">{formatMoney(t.commission, c)}</td>
                          <td className="px-4 py-3">{formatMoney(t.pending + t.accrued, c)}</td>
                          <td className="px-4 py-3 text-emerald-700">{formatMoney(t.paid, c)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              title="Últimas ventas"
              className="lg:col-span-2"
              action={
                <Link href="/vendedor/reservas" className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {data.recent.length === 0 ? (
                <EmptyState
                  title="Todavía no tenés ventas"
                  description="Compartí tus enlaces o cargá una reserva manual para empezar."
                  action={
                    <Button asChild size="sm">
                      <Link href="/vendedor/reservas/nueva">Nueva reserva</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/vendedor/reservas/${r.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{r.customerName || 'Sin nombre'}</p>
                          <p className="truncate text-xs text-gray-500">
                            {r.experienceTitle} · {formatDate(r.date)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <SourcePill source={r.source} />
                          <StatusPill status={r.status} />
                          <span className="text-sm font-semibold text-gray-900">{formatMoney(r.amountTotal, r.currency)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Enlaces que más venden">
              {data.topLinks.length === 0 ? (
                <EmptyState title="Sin ventas por enlace" description="Cuando alguien compre desde tu enlace lo vas a ver acá." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.topLinks.map((l) => (
                    <li key={l.code} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium text-gray-900">{l.code}</p>
                        <p className="truncate text-xs text-gray-500">{l.title}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{l.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export default function VendorDashboardPage() {
  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <Dashboard />
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
