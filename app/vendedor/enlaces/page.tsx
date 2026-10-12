'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, MoreHorizontal, Plus, Power, Search, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { EmptyState, ErrorState, PageHeader, Pill, StatCard } from '@/components/vendor/parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDate, formatMoney, vendorFetch, type VendorLinkRow, type VendorExperienceOption } from '@/lib/vendor-client';

type Snapshot = { vendorId: string; links: VendorLinkRow[]; experiencias: VendorExperienceOption[] };
const CURRENCIES = ['ars', 'brl', 'usd'] as const;

function EnlacesView() {
  const { user } = useAuth();
  const [links, setLinks] = useState<VendorLinkRow[]>([]);
  const [experiencias, setExperiencias] = useState<VendorExperienceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'sales'>('recent');

  const [createOpen, setCreateOpen] = useState(false);
  const [pickTerm, setPickTerm] = useState('');
  const [pickId, setPickId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteLink, setDeleteLink] = useState<VendorLinkRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const apply = (s: Snapshot) => {
    setLinks(s.links);
    setExperiencias(s.experiencias);
  };

  const api = useCallback(
    (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown) => vendorFetch<Snapshot>(user!, '/api/vendor/links', { method, body }),
    [user]
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      apply(await api('GET'));
    } catch (e: any) {
      setError(e.message || 'No pudimos cargar tus enlaces');
    } finally {
      setLoading(false);
    }
  }, [user, api]);

  useEffect(() => {
    load();
  }, [load]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const urlFor = (l: VendorLinkRow) => `${origin}${l.experienceSlug ? `/experiencia/${encodeURIComponent(l.experienceSlug)}` : '/'}?ref=${encodeURIComponent(l.code)}`;

  const usedExperienceIds = useMemo(() => new Set(links.map((l) => l.experienceId).filter(Boolean) as string[]), [links]);
  const availableExperiences = useMemo(() => {
    const t = pickTerm.trim().toLowerCase();
    return experiencias.filter((experience) => !usedExperienceIds.has(experience.id) && (!t || `${experience.title} ${experience.slug}`.toLowerCase().includes(t)));
  }, [experiencias, usedExperienceIds, pickTerm]);

  const visible = useMemo(() => {
    const t = query.trim().toLowerCase();
    const list = links.filter((l) => {
      if (status === 'active' && !l.active) return false;
      if (status === 'inactive' && l.active) return false;
      return !t || `${l.code} ${l.experienceName}`.toLowerCase().includes(t);
    });
    return list.sort((a, b) => (sort === 'sales' ? b.salesCount - a.salesCount : String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))));
  }, [links, status, query, sort]);

  const totalSales = links.reduce((acc, l) => acc + l.salesCount, 0);

  const run = async (key: string, fn: () => Promise<Snapshot>, ok: string) => {
    setBusy(key);
    try {
      apply(await fn());
      toast.success(ok);
      return true;
    } catch (e: any) {
      toast.error(e.message || 'No se pudo completar la acción');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!pickId) return;
    if (await run('create', () => api('POST', { experienceId: pickId }), 'Enlace creado')) {
      setCreateOpen(false);
      setPickId('');
    }
  };

  const copy = async (l: VendorLinkRow) => {
    try {
      await navigator.clipboard.writeText(urlFor(l));
      setCopied(l.id);
      setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 1800);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const share = async (l: VendorLinkRow) => {
    const text = `${l.experienceName}: ${urlFor(l)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: l.experienceName, text, url: urlFor(l) });
        return;
      } catch {
        /* cancelado */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis enlaces"
        description="Un enlace único por experiencia. Las ventas hechas desde él quedan asociadas a vos."
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setPickId('');
              setPickTerm('');
              setCreateOpen(true);
            }}
            disabled={loading || !!error}
          >
            <Plus className="h-4 w-4" /> Nuevo enlace
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Enlaces" value={loading ? '—' : links.length} hint={`${links.filter((l) => l.active).length} activos`} icon={<Link2 className="h-4 w-4" />} />
            <StatCard label="Ventas por enlace" value={loading ? '—' : totalSales} hint="Sin contar canceladas" />
            <StatCard label="Experiencias disponibles" value={loading ? '—' : Math.max(0, experiencias.length - usedExperienceIds.size)} hint="Sin enlace todavía" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input className="pl-8" placeholder="Buscar por código o experiencia…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
              {([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setStatus(k)} className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', status === k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                  {label}
                </button>
              ))}
            </div>
            <select className="h-9 rounded-md border border-input bg-white px-2.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Ordenar">
              <option value="recent">Más recientes</option>
              <option value="sales">Más ventas</option>
            </select>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white">
              <EmptyState
                title={links.length === 0 ? 'Todavía no tenés enlaces' : 'Sin resultados'}
                description={links.length === 0 ? 'Creá un enlace para una experiencia y empezá a compartirlo.' : 'Probá con otro filtro o búsqueda.'}
                action={
                  links.length === 0 && experiencias.length > 0 ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      Crear mi primer enlace
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((l) => {
                const url = urlFor(l);
                const revenue = CURRENCIES.filter((c) => l.revenueByCurrency[c]);
                const commission = CURRENCIES.filter((c) => l.commissionByCurrency[c]);
                return (
                  <article key={l.id} className={cn('flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-opacity', l.active ? 'border-gray-200' : 'border-gray-200 opacity-75')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-gray-900" title={l.experienceName}>{l.experienceName}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">Creado {formatDate(l.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Pill tone={l.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}>{l.active ? 'Activo' : 'Inactivo'}</Pill>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Más acciones" disabled={busy === l.id}>
                              {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[200px] bg-white">
                            <DropdownMenuItem onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                              <ExternalLink className="h-4 w-4" /> Abrir experiencia
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => run(l.id, () => api('PATCH', { linkId: l.id, active: !l.active }), l.active ? 'Enlace desactivado' : 'Enlace activado')}>
                              <Power className="h-4 w-4" /> {l.active ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={l.salesCount > 0}
                              onClick={() => setDeleteLink(l)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" /> {l.salesCount > 0 ? 'Eliminar (tiene ventas)' : 'Eliminar'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-gray-50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-semibold tracking-wider text-gray-900">{l.code}</span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5" onClick={() => copy(l)}>
                            {copied === l.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === l.id ? 'Copiado' : 'Copiar'}
                          </Button>
                          <Button size="icon-sm" variant="outline" className="h-8 w-8" onClick={() => share(l)} aria-label="Compartir">
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 truncate text-xs text-gray-500" title={url}>{url}</p>
                    </div>

                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-gray-100 p-2">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Ventas</dt>
                        <dd className="mt-0.5 text-sm font-semibold">{l.salesCount}</dd>
                      </div>
                      <div className="rounded-lg border border-gray-100 p-2">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Ingresos</dt>
                        <dd className="mt-0.5 space-y-0.5 text-xs font-semibold">{revenue.length ? revenue.map((c) => <div key={c}>{formatMoney(l.revenueByCurrency[c], c)}</div>) : '—'}</dd>
                      </div>
                      <div className="rounded-lg border border-gray-100 p-2">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Comisión</dt>
                        <dd className="mt-0.5 space-y-0.5 text-xs font-semibold text-emerald-700">{commission.length ? commission.map((c) => <div key={c}>{formatMoney(l.commissionByCurrency[c], c)}</div>) : '—'}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Nuevo enlace de referido</DialogTitle>
            <DialogDescription>Elegí la experiencia para generar tu enlace único.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar experiencia…" value={pickTerm} onChange={(e) => setPickTerm(e.target.value)} className="bg-gray-50 pl-9" autoFocus />
            </div>
            {availableExperiences.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {experiencias.length === 0 ? 'No tenés experiencias habilitadas todavía.' : usedExperienceIds.size >= experiencias.length ? 'Ya tenés un enlace para todas tus experiencias.' : 'No se encontraron experiencias.'}
              </p>
            ) : (
              <ul className="space-y-1" role="listbox">
                {availableExperiences.map((experience) => (
                  <li key={experience.id}>
                    <button
                      type="button"
                      onClick={() => setPickId(experience.id)}
                      className={cn('flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors', pickId === experience.id ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50')}
                    >
                      <span className="min-w-0">
                        <span className={cn('block truncate text-sm font-medium', pickId === experience.id ? 'text-blue-700' : 'text-gray-900')}>{experience.title}</span>
                        <span className="block truncate text-xs text-gray-500">/{experience.slug}</span>
                      </span>
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', pickId === experience.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300')}>
                        {pickId === experience.id && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="border-t bg-gray-50 px-6 py-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={!pickId || busy === 'create'} className="gap-2">
              {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />} Generar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLink} onOpenChange={(o) => !o && setDeleteLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el enlace {deleteLink?.code}?</AlertDialogTitle>
            <AlertDialogDescription>Dejará de existir y no se podrá usar. Si solo querés pausarlo, desactivalo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                const l = deleteLink;
                setDeleteLink(null);
                if (l) run(l.id, () => api('DELETE', { linkId: l.id }), 'Enlace eliminado');
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function VendorEnlacesPage() {
  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <EnlacesView />
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
