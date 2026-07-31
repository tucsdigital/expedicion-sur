'use client';

import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getReferralLinksByVendor, createReferralLink, deactivateReferralLink, deleteReferralLink } from '@/lib/vendors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReferralLink } from '@/types/vendor';
import { Copy, Link2, Loader2, Plus, Trash2, Search, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const siteUrl = () => (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || '');
const CURRENCIES: Array<'ars' | 'brl' | 'usd'> = ['ars', 'brl', 'usd'];

export default function VendorEnlacesPage() {
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const [experiences, setExperiences] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [allowedExperiences, setAllowedExperiences] = useState<string[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.email) return;
      setLoading(true);
      try {
        const vq = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
        const vs = await getDocs(vq);
        const v = vs.docs[0];
        if (!v) return;
        setVendorId(v.id);
        const vdata = v.data() as any;
        const allowed = Array.isArray(vdata?.allowedExperiences) ? (vdata.allowedExperiences as string[]) : null;
        setAllowedExperiences(allowed);
        const list = await getReferralLinksByVendor(v.id);
        setLinks(list);
        // Cargar experiencias
        const expSnap = await getDocs(collection(db, 'experiencias'));
        const all = expSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .map((e: any) => ({ id: e.id, title: String(e.title ?? ''), slug: String(e.slug ?? '') }))
          .filter((e) => e.title && e.slug);
        const filtered = Array.isArray(allowed) && allowed.length > 0 ? all.filter((e) => allowed.includes(e.id)) : all;
        filtered.sort((a, b) => a.title.localeCompare(b.title, 'es'));
        setExperiences(filtered);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const experiencesFromLinks = useMemo(() => {
    const set = new Map<string, string>();
    for (const l of links) {
      if (l.experienceId) {
        set.set(l.experienceId, l.experienceName ?? l.experienceId);
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [links]);

  const filtered = useMemo(() => {
    return links.filter((l) => {
      const statusOk =
        statusFilter === 'todos' ||
        (statusFilter === 'activos' && l.active) ||
        (statusFilter === 'inactivos' && !l.active);
      const expOk = experienceFilter === 'all' || l.experienceId === experienceFilter;
      return statusOk && expOk;
    });
  }, [links, statusFilter, experienceFilter]);

  const availableExperiences = useMemo(() => {
    const taken = new Set(links.map(l => l.experienceId).filter(Boolean) as string[]);
    const list = experiences.filter(e => !taken.has(e.id));
    return list;
  }, [experiences, links]);

  const filteredCreateExperiences = useMemo(() => {
    if (!searchTerm) return availableExperiences;
    const lower = searchTerm.toLowerCase();
    return availableExperiences.filter(e => 
      e.title.toLowerCase().includes(lower) || 
      e.slug.toLowerCase().includes(lower)
    );
  }, [availableExperiences, searchTerm]);

  const nf = (currency: 'ARS' | 'BRL' | 'USD') =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 });
  const toUnits = (cents?: number) => (typeof cents === 'number' ? cents / 100 : 0);
  const currencyLabel = (c: 'ars' | 'brl' | 'usd') => (c === 'ars' ? 'ARS' : c === 'brl' ? 'BRL' : 'USD');
  const normalizeSiteUrl = (u: string) => (u.endsWith('/') ? u.slice(0, -1) : u);

  const publicUrlForLink = (l: ReferralLink) => {
    const base = normalizeSiteUrl(siteUrl());
    const slug =
      l.experienceSlug ||
      (l.experienceId ? experiences.find((e) => e.id === l.experienceId)?.slug : undefined);
    const path = slug ? `/experiencias/${encodeURIComponent(slug)}` : '/';
    return `${base}${path}?ref=${encodeURIComponent(l.code)}`;
  };

  const exportCsv = () => {
    const rows: string[] = [];
    const header = [
      'Codigo',
      'Experiencia',
      'Estado',
      'Ventas',
      'Ingresos ARS',
      'Ingresos BRL',
      'Ingresos USD',
      'Comision ARS',
      'Comision BRL',
      'Comision USD',
      'Creado',
      'URL',
    ];
    rows.push(header.join(','));
    const formatDate = (v: any) => {
      try {
        if (!v) return '';
        if (typeof v === 'string') return new Date(v).toISOString();
        if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
        if ('seconds' in v) return new Date((v.seconds ?? 0) * 1000).toISOString();
      } catch {}
      return '';
    };
    for (const l of filtered) {
      const r = l.revenueByCurrency ?? {};
      const k = l.commissionByCurrency ?? {};
      const row = [
        `"${l.code}"`,
        `"${l.experienceName ?? (l.experienceId ? l.experienceId : 'Todas')}"`,
        l.active ? 'Activo' : 'Inactivo',
        `${l.salesCount ?? 0}`,
        `${toUnits(r.ars ?? 0)}`,
        `${toUnits(r.brl ?? 0)}`,
        `${toUnits(r.usd ?? 0)}`,
        `${toUnits(k.ars ?? 0)}`,
        `${toUnits(k.brl ?? 0)}`,
        `${toUnits(k.usd ?? 0)}`,
        `"${formatDate((l as any).createdAt)}"`,
        `"${publicUrlForLink(l)}"`,
      ];
      rows.push(row.join(','));
    }
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-enlaces.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openCreateDialog = () => {
    if (availableExperiences.length === 0) {
      toast.info('Ya tenés enlaces para todas las experiencias habilitadas');
      return;
    }
    setSelectedExperienceId('');
    setSearchTerm('');
    setCreateOpen(true);
  };

  const createLinkConfirmed = async () => {
    if (!vendorId) return;
    const expId = selectedExperienceId.trim();
    if (!expId) {
      toast.error('Seleccioná una experiencia');
      return;
    }
    if (links.some((l) => l.experienceId === expId)) {
      toast.error('Ya tenés un enlace para esa experiencia');
      return;
    }
    if (Array.isArray(allowedExperiences) && allowedExperiences.length > 0 && !allowedExperiences.includes(expId)) {
      toast.error('No estás autorizado para esa experiencia');
      return;
    }
    setCreating(true);
    try {
      let attempts = 0;
      while (attempts < 5) {
        try {
          const code = genCode();
          await createReferralLink({
            vendorId,
            code,
            active: true,
            utm: null,
            experienceId: expId,
          });
          const list = await getReferralLinksByVendor(vendorId);
          setLinks(list);
          toast.success('Enlace creado');
          setCreateOpen(false);
          return;
        } catch (e: any) {
          const msg = e?.message ?? '';
          if (msg === 'CODE_TAKEN') {
            attempts++;
            continue;
          }
          if (msg === 'DUPLICATE_EXPERIENCE') {
            toast.error('Ya existe un enlace para esa experiencia');
            return;
          }
          if (msg === 'NOT_ALLOWED_EXPERIENCE') {
            toast.error('No tenés permiso para esa experiencia');
            return;
          }
          if (msg === 'MISSING_EXPERIENCE') {
            toast.error('Falta la experiencia');
            return;
          }
          throw e;
        }
      }
      toast.error('No se pudo generar un código único. Probá nuevamente.');
    } catch {
      toast.error('No se pudo crear el enlace');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (l: ReferralLink) => {
    try {
      const url = publicUrlForLink(l);
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  

  const deactivate = async (id: string) => {
    if (!vendorId) return;
    try {
      await deactivateReferralLink(id);
      const list = await getReferralLinksByVendor(vendorId);
      setLinks(list);
      toast.success('Enlace desactivado');
    } catch {
      toast.error('No se pudo desactivar');
    }
  };

  const requestDelete = (l: ReferralLink) => {
    if ((l.salesCount ?? 0) > 0) {
      toast.error('No podés eliminar un enlace con ventas. Podés desactivarlo.');
      return;
    }
    setDeleteId(l.id);
  };

  const confirmDelete = async () => {
    if (!vendorId || !deleteId) return;
    try {
      await deleteReferralLink(deleteId);
      const list = await getReferralLinksByVendor(vendorId);
      setLinks(list);
      toast.success('Enlace eliminado');
    } catch {
      toast.error('No se pudo eliminar el enlace');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Mis enlaces</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
              <Button onClick={openCreateDialog} className="gap-2" disabled={availableExperiences.length === 0}>
                <Plus className="h-4 w-4" />
                Nuevo enlace
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Códigos de referido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Estado</span>
                  <select
                    className="border rounded-md px-2 py-1 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="todos">Todos</option>
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Experiencia</span>
                  <select
                    className="border rounded-md px-2 py-1 text-sm"
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    {experiencesFromLinks.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {loading ? (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-9 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={`head-${i}`} className="h-4 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                  {Array.from({ length: 6 }).map((_, r) => (
                    <div key={`row-${r}`} className="grid grid-cols-9 gap-3">
                      {Array.from({ length: 9 }).map((__, c) => (
                        <div key={`cell-${r}-${c}`} className="h-4 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-600">Aún no tenés enlaces. Creá el primero.</p>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Código</th>
                        <th className="px-4 py-3 text-left font-medium">Enlace</th>
                        <th className="px-4 py-3 text-left font-medium">Experiencia</th>
                        <th className="px-4 py-3 text-left font-medium">Ventas</th>
                        <th className="px-4 py-3 text-left font-medium">Ingresos</th>
                        <th className="px-4 py-3 text-left font-medium">Comisión</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Creado</th>
                        <th className="px-4 py-3 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(l => (
                        <tr key={l.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-mono">{l.code}</td>
                          <td className="px-4 py-3">
                            <a
                              href={publicUrlForLink(l)}
                              className="text-primary hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {publicUrlForLink(l)}
                            </a>
                          </td>
                          <td className="px-4 py-3">{l.experienceName ?? 'Todas'}</td>
                          <td className="px-4 py-3">{typeof l.salesCount === 'number' ? l.salesCount : 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {CURRENCIES.map(c => {
                                const v = l.revenueByCurrency?.[c] ?? 0;
                                if (!v) return null;
                                const cur = currencyLabel(c) as 'ARS'|'BRL'|'USD';
                                return (
                                  <span key={c} className="inline-block rounded bg-gray-100 px-2 py-0.5">
                                    {nf(cur).format(toUnits(v))}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {CURRENCIES.map(c => {
                                const v = l.commissionByCurrency?.[c] ?? 0;
                                if (!v) return null;
                                const cur = currencyLabel(c) as 'ARS'|'BRL'|'USD';
                                return (
                                  <span key={c} className="inline-block rounded bg-emerald-50 text-emerald-800 px-2 py-0.5">
                                    {nf(cur).format(toUnits(v))}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">{l.active ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</td>
                          <td className="px-4 py-3">
                            {(() => {
                              const v: any = (l as any).createdAt;
                              if (!v) return '—';
                              try {
                                if (typeof v === 'string') return new Date(v).toLocaleDateString();
                                if (v && typeof v.toDate === 'function') return v.toDate().toLocaleDateString();
                                if ('seconds' in v) return new Date((v.seconds ?? 0) * 1000).toLocaleDateString();
                              } catch {}
                              return '—';
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => copyLink(l)} className="gap-2">
                                <Copy className="h-4 w-4" /> Copiar enlace
                              </Button>
                              {l.active && (
                                <Button variant="ghost" size="sm" onClick={() => deactivate(l.id)} className="gap-2 text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" /> Desactivar
                                </Button>
                              )}
                              {!l.active && (
                                <Button variant="ghost" size="sm" onClick={() => requestDelete(l)} className="gap-2 text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" /> Eliminar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Compartí el link y tus ventas quedarán registradas automáticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </VendorLayout>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl bg-white p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Nuevo enlace de referido</DialogTitle>
            <p className="text-sm text-gray-500 font-normal">
              Elegí una experiencia para generar tu enlace único.
            </p>
          </DialogHeader>
          
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar experiencia..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-50"
              />
            </div>

            <div className="space-y-1">
              {filteredCreateExperiences.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No se encontraron experiencias
                </div>
              ) : (
                filteredCreateExperiences.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => setSelectedExperienceId(e.id)}
                    className={cn(
                      "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border",
                      selectedExperienceId === e.id 
                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" 
                        : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className={cn(
                        "font-medium text-sm truncate",
                        selectedExperienceId === e.id ? "text-blue-700" : "text-gray-900"
                      )}>
                        {e.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        /{e.slug}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <a
                        href={`${siteUrl()}/experiencias/${e.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-blue-50 rounded-full"
                        title="Ver página de experiencia"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                        selectedExperienceId === e.id
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 bg-white"
                      )}>
                        {selectedExperienceId === e.id && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-gray-500">
                {selectedExperienceId ? '1 experiencia seleccionada' : 'Ninguna seleccionada'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={createLinkConfirmed} 
                  disabled={creating || !selectedExperienceId} 
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Generar enlace
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar enlace definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El enlace dejará de existir y no podrá usarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VendorProtectedRoute>
  );
}
