'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, PlusCircle, Search, X } from 'lucide-react';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, PayoutPill, SourcePill, StatusPill } from '@/components/vendor/parts';
import AdminPagination from '@/components/admin/AdminPagination';
import { Button } from '@/components/ui/button';
import { DateRangeFilter, FilterSelect } from '@/components/vendor/filters';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { PAYOUT_LABEL, STATUS_LABEL, fetchVendorReservations, formatDate, formatMoney, type VendorReservationRow } from '@/lib/vendor-client';

function ReservasList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VendorReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'manual' | 'online'>('all');
  const [status, setStatus] = useState('all');
  const [payout, setPayout] = useState('all');
  const [pkg, setPkg] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchVendorReservations(user));
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (source !== 'all' && r.source !== source) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (payout !== 'all' && r.referredBy.payoutStatus !== payout) return false;
      if (pkg !== 'all' && (r.experienceId ?? r.experienceTitle) !== pkg) return false;
      const created = r.createdAt ? r.createdAt.slice(0, 10) : '';
      if (from && (!created || created < from)) return false;
      if (to && (!created || created > to)) return false;
      if (!t) return true;
      return `${r.customerName} ${r.customerEmail} ${r.experienceTitle} ${r.reservationCode ?? ''} ${r.referredBy.code ?? ''}`.toLowerCase().includes(t);
    });
  }, [rows, search, source, status, payout, pkg, from, to]);

  useEffect(() => setPage(1), [search, source, status, payout, pkg, from, to, perPage]);

  // Opciones de filtro construidas con los datos reales de las reservas.
  const options = useMemo(() => {
    const count = (get: (r: VendorReservationRow) => string | null | undefined, label: (k: string) => string) => {
      const m = new Map<string, { label: string; count: number }>();
      for (const r of rows) {
        const k = get(r);
        if (!k) continue;
        const cur = m.get(k) ?? { label: label(k), count: 0 };
        cur.count += 1;
        m.set(k, cur);
      }
      return Array.from(m, ([value, v]) => ({ value, label: v.label, count: v.count })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
    };
    return {
      source: count((r) => r.source, (k) => (k === 'manual' ? 'Manual' : 'Online')),
      status: count((r) => r.status, (k) => STATUS_LABEL[k] ?? k),
      payout: count((r) => r.referredBy.payoutStatus, (k) => PAYOUT_LABEL[k] ?? k),
      pkg: count((r) => r.experienceId ?? r.experienceTitle, (k) => rows.find((r) => (r.experienceId ?? r.experienceTitle) === k)?.experienceTitle || k),
    };
  }, [rows]);

  const dateLimits = useMemo(() => {
    const days = rows.map((r) => r.createdAt?.slice(0, 10)).filter(Boolean) as string[];
    if (days.length === 0) return { min: undefined, max: undefined };
    const today = new Date().toISOString().slice(0, 10);
    const last = days.reduce((a, b) => (a > b ? a : b));
    return { min: days.reduce((a, b) => (a < b ? a : b)), max: last > today ? last : today };
  }, [rows]);

  const pageRows = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page, perPage]);
  const hasFilters = Boolean(search || source !== 'all' || status !== 'all' || payout !== 'all' || pkg !== 'all' || from || to);
  const clear = () => {
    setSearch('');
    setSource('all');
    setStatus('all');
    setPayout('all');
    setPkg('all');
    setFrom('');
    setTo('');
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Codigo', 'Creada', 'Salida', 'Experiencia', 'Cliente', 'Email', 'Personas', 'Origen', 'Estado', 'Importe', 'Moneda', 'Comision', 'Estado comision', 'Enlace'];
    const lines = filtered.map((r) =>
      [
        r.reservationCode,
        r.createdAt?.slice(0, 10),
        r.date,
        r.experienceTitle,
        r.customerName,
        r.customerEmail,
        r.people,
        r.source === 'manual' ? 'Manual' : 'Online',
        STATUS_LABEL[r.status] ?? r.status,
        r.amountTotal / 100,
        r.currency.toUpperCase(),
        r.referredBy.commissionAmount / 100,
        PAYOUT_LABEL[r.referredBy.payoutStatus] ?? r.referredBy.payoutStatus,
        r.referredBy.code,
      ]
        .map(esc)
        .join(',')
    );
    const blob = new Blob(['\uFEFF' + [header.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mis-reservas.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis reservas"
        description="Todas las ventas asociadas a vos, manuales y online."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/vendedor/reservas/nueva">
                <PlusCircle className="h-4 w-4" /> Nueva reserva
              </Link>
            </Button>
          </>
        }
      />

      <Panel>
        <div className="space-y-3 border-b border-gray-100 bg-gray-50/60 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Buscar cliente, experiencia, código…" className="rounded-full border-0 bg-white pl-9 shadow-xs ring-1 ring-gray-200/60 focus-visible:ring-2 focus-visible:ring-gray-300" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Origen" value={source} onChange={(v) => setSource(v as any)} options={options.source} />
            <FilterSelect label="Estado" value={status} onChange={setStatus} options={options.status} />
            <FilterSelect label="Comisión" value={payout} onChange={setPayout} options={options.payout} />
            {options.pkg.length > 1 && <FilterSelect label="Experiencia" value={pkg} onChange={setPkg} options={options.pkg} className="max-w-[260px]" />}
            <DateRangeFilter label="Creada" from={from} to={to} minDate={dateLimits.min} maxDate={dateLimits.max} onChange={(r) => { setFrom(r.from); setTo(r.to); }} />
            {hasFilters && (
              <button type="button" onClick={clear} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-gray-800">
                <X className="h-3.5 w-3.5" /> Limpiar
              </button>
            )}
            {!loading && !error && (
              <span className="ml-auto text-xs text-gray-500">
                {filtered.length === rows.length ? `${rows.length} reservas` : `${filtered.length} de ${rows.length} reservas`}
              </span>
            )}
          </div>
        </div>
        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <LoadingBlock rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'Sin resultados' : 'Todavía no tenés reservas'}
            description={hasFilters ? 'Probá cambiando o limpiando los filtros.' : 'Cuando se registre una venta asociada a vos va a aparecer acá.'}
            action={hasFilters ? <Button size="sm" variant="outline" onClick={clear}>Limpiar filtros</Button> : undefined}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Experiencia</th>
                    <th className="px-4 py-3 font-medium">Salida</th>
                    <th className="px-4 py-3 font-medium">Origen</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Venta</th>
                    <th className="px-4 py-3 text-right font-medium">Comisión</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="max-w-[200px] truncate font-medium text-gray-900">{r.customerName || '—'}</p>
                        <p className="text-xs text-gray-500">{r.reservationCode ? `#${r.reservationCode}` : formatDate(r.createdAt)}</p>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-gray-700">{r.experienceTitle}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(r.date)}</td>
                      <td className="px-4 py-3"><SourcePill source={r.source} /></td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{formatMoney(r.amountTotal, r.currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="whitespace-nowrap font-medium">{formatMoney(r.referredBy.commissionAmount, r.referredBy.commissionCurrency ?? r.currency)}</p>
                        <PayoutPill status={r.referredBy.payoutStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/vendedor/reservas/${r.id}`}>{r.canEdit ? 'Gestionar' : 'Ver'}</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-gray-100 md:hidden">
              {pageRows.map((r) => (
                <li key={r.id}>
                  <Link href={`/vendedor/reservas/${r.id}`} className="block space-y-2 px-4 py-3 active:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{r.customerName || '—'}</p>
                        <p className="truncate text-xs text-gray-500">{r.experienceTitle}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{formatMoney(r.amountTotal, r.currency)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SourcePill source={r.source} />
                      <StatusPill status={r.status} />
                      <PayoutPill status={r.referredBy.payoutStatus} />
                    </div>
                    <p className="text-xs text-gray-500">
                      Salida {formatDate(r.date)} · Comisión {formatMoney(r.referredBy.commissionAmount, r.referredBy.commissionCurrency ?? r.currency)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 p-3">
              <AdminPagination currentPage={page} totalItems={filtered.length} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemName="reservas" />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

export default function VendorReservasPage() {
  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <ReservasList />
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
