'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExperiencias, deleteExperiencia, getExperienciaById } from '@/lib/experiencias';
import type { Experience } from '@/components/landing-reserva/types';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Trash2, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import DragDropTable from '@/components/admin/DragDropTable';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ExperienciasPage() {
  const [experiencias, setExperiencias] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc'; mode: 'default' | 'custom' }>({
    key: 'orden',
    direction: 'asc',
    mode: 'default',
  });

  const fetchExperiencias = async () => {
    try {
      const data = await getExperiencias({ visibleOnly: false });
      setExperiencias(data);
    } catch (error) {
      console.error('Error fetching experiencias:', error);
      toast.error('Error al cargar experiencias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiencias();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const experiencia = await getExperienciaById(deleteId);
      if (experiencia) {
        const keysToDelete = new Set<string>();
        if (experiencia.cardImageKey) keysToDelete.add(experiencia.cardImageKey);
        (experiencia.imageKeys ?? []).forEach((key) => {
          if (key) keysToDelete.add(key);
        });
        const cardKeyFallback = getBlobKeyFromUrl(experiencia.cardImage ?? experiencia.images?.[0] ?? '');
        if (cardKeyFallback) keysToDelete.add(cardKeyFallback);
        (experiencia.images ?? []).forEach((url) => {
          const key = getBlobKeyFromUrl(url);
          if (key) keysToDelete.add(key);
        });
        if (keysToDelete.size > 0) {
          await Promise.allSettled(
            Array.from(keysToDelete).map((key) =>
              deleteBlobByKey(key).catch((error) => {
                console.error('[experiencias] error borrando blob:', error);
              })
            )
          );
        }
      }
      await deleteExperiencia(deleteId);
      setExperiencias((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success('Experiencia eliminada');
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting experiencia:', error);
      toast.error('Error al eliminar');
      setDeleteId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return experiencias;
    const term = searchTerm.toLowerCase().trim();
    return experiencias.filter(
      (e) =>
        e.title.toLowerCase().includes(term) ||
        e.slug.toLowerCase().includes(term)
    );
  }, [experiencias, searchTerm]);

  const sorted = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = sort.key;
    const copy = [...filtered];

    copy.sort((a, b) => {
      const aVal =
        key === 'orden'
          ? (a.orden ?? 0)
          : key === 'titulo'
            ? (a.title ?? '')
            : key === 'estado'
              ? (a.visible !== false ? 1 : 0)
              : '';
      const bVal =
        key === 'orden'
          ? (b.orden ?? 0)
          : key === 'titulo'
            ? (b.title ?? '')
            : key === 'estado'
              ? (b.visible !== false ? 1 : 0)
              : '';

      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' }) * dir;
    });

    return copy;
  }, [filtered, sort.direction, sort.key]);


  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-72 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="relative max-w-md">
              <div className="h-9 w-full bg-gray-200 rounded-xl animate-pulse" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`exp-row-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Experiencias</h1>
              <p className="text-gray-600 mt-1">Gestioná las experiencias (landings por destino). Orden y posición en lista y en crear/editar.</p>
            </div>
            <Button asChild>
              <Link href="/admin/experiencias/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nueva experiencia
              </Link>
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por título o slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center">
              <p className="text-gray-600">
                {searchTerm ? 'No hay experiencias que coincidan con la búsqueda.' : 'Aún no hay experiencias.'}
              </p>
              {!searchTerm && (
                <Button asChild className="mt-4">
                  <Link href="/admin/experiencias/nuevo">Crear primera experiencia</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <DragDropTable<Experience>
                items={sorted}
                collectionName="experiencias"
                onItemsChange={(items) => {
                  setExperiencias((prev) => {
                    const byId = new Map(prev.map((e) => [e.id, e]));
                    items.forEach((item, i) => byId.set(item.id, { ...item, orden: i + 1 }));
                    return prev.map((e) => byId.get(e.id) ?? e).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
                  });
                }}
                onDelete={setDeleteId}
                editPath="/admin/experiencias"
                viewPath="/experiencias"
                sort={sort}
                onSortChange={setSort}
                columns={[
                  {
                    key: 'orden',
                    label: 'Orden',
                    sortable: true,
                    render: (item) => (
                      <Badge variant="outline" className="font-mono">
                        #{item.orden ?? '-'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'titulo',
                    label: 'Título / Slug',
                    sortable: true,
                    render: (item) => (
                      <div>
                        <div className="font-medium text-gray-900">{item.title}</div>
                        <div className="text-gray-500">/{item.slug}</div>
                      </div>
                    ),
                  },
                  {
                    key: 'estado',
                    label: 'Estado',
                    sortable: true,
                    render: (item) =>
                      item.visible !== false ? (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
                          <Eye className="h-3 w-3" /> Visible
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-600">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </Badge>
                      ),
                  },
                ]}
              />
            </>
          )}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar experiencia?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La experiencia dejará de mostrarse en el sitio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}
