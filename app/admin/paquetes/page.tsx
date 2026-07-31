'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Paquete } from '@/types';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { getPaqueteTipoLabel } from '@/lib/paqueteMeta';
import { duplicatePaquete } from '@/lib/duplicatePaquete';
import { revalidateFrontPaths } from '@/lib/revalidate';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, X, CheckCircle2, XCircle, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import DragDropTable from '@/components/admin/DragDropTable';
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

type SortState = { key: string; direction: 'asc' | 'desc'; mode: 'default' | 'custom' };

function matchesSearch(paquete: Paquete, searchTerm: string) {
  if (!searchTerm.trim()) return true;
  const searchLower = searchTerm.toLowerCase().trim();
  return (
    paquete.titulo.toLowerCase().includes(searchLower) ||
    (paquete.destino && paquete.destino.toLowerCase().includes(searchLower)) ||
    paquete.slug.toLowerCase().includes(searchLower) ||
    (paquete.descripcion && paquete.descripcion.toLowerCase().includes(searchLower))
  );
}

function sortPaquetes(items: Paquete[], sort: SortState) {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const key = sort.key;
  const copy = [...items];

  copy.sort((a, b) => {
    const aVal =
      key === 'orden'
        ? (a.orden ?? 0)
        : key === 'titulo'
          ? (a.titulo ?? '')
          : key === 'destino'
            ? (a.destino ?? '')
            : key === 'tipo'
              ? (a.tipo ?? '')
              : key === 'precio'
                ? (a.precio ?? 0)
                : '';

    const bVal =
      key === 'orden'
        ? (b.orden ?? 0)
        : key === 'titulo'
          ? (b.titulo ?? '')
          : key === 'destino'
            ? (b.destino ?? '')
            : key === 'tipo'
              ? (b.tipo ?? '')
              : key === 'precio'
                ? (b.precio ?? 0)
                : '';

    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
    return String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' }) * dir;
  });

  return copy;
}

export default function PaquetesPage() {
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<SortState>({
    key: 'orden',
    direction: 'asc',
    mode: 'default',
  });

  // Contar paquetes destacados
  const destacadosCount = useMemo(() => {
    return paquetes.filter(p => p.destacado).length;
  }, [paquetes]);

  const fetchPaquetes = async () => {
    try {
      const q = query(collection(db, 'paquetes'), orderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Paquete));
      setPaquetes(data);
    } catch (error) {
      console.error('Error fetching paquetes:', error);
      toast.error('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaquetes();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const paqueteDoc = await getDoc(doc(db, 'paquetes', deleteId));
      if (paqueteDoc.exists()) {
        const paqueteData = paqueteDoc.data() as Paquete;
        const keysToDelete = new Set<string>();

        if (paqueteData.imagenPrincipalKey) keysToDelete.add(paqueteData.imagenPrincipalKey);
        if (paqueteData.imagenTarjetaKey) keysToDelete.add(paqueteData.imagenTarjetaKey);
        if (paqueteData.imagenPortadaKey) keysToDelete.add(paqueteData.imagenPortadaKey);
        if (paqueteData.imagenPortadaMobileKey) keysToDelete.add(paqueteData.imagenPortadaMobileKey);
        if (paqueteData.imagenPortadaDesktopKey) keysToDelete.add(paqueteData.imagenPortadaDesktopKey);
        const principalFallback = getBlobKeyFromUrl(paqueteData.imagenPrincipal);
        if (principalFallback) keysToDelete.add(principalFallback);
        const cardFallback = getBlobKeyFromUrl(paqueteData.imagenTarjeta);
        if (cardFallback) keysToDelete.add(cardFallback);
        const coverFallback = getBlobKeyFromUrl(paqueteData.imagenPortada);
        if (coverFallback) keysToDelete.add(coverFallback);
        const coverMobileFallback = getBlobKeyFromUrl(paqueteData.imagenPortadaMobile);
        if (coverMobileFallback) keysToDelete.add(coverMobileFallback);
        const coverDesktopFallback = getBlobKeyFromUrl(paqueteData.imagenPortadaDesktop);
        if (coverDesktopFallback) keysToDelete.add(coverDesktopFallback);
        (paqueteData.galeriaKeys ?? []).forEach((key) => {
          if (key) keysToDelete.add(key);
        });
        (paqueteData.galeria ?? []).forEach((url) => {
          const key = getBlobKeyFromUrl(url);
          if (key) keysToDelete.add(key);
        });

        if (keysToDelete.size > 0) {
          toast.info('Eliminando imágenes...', { id: 'delete-images' });
          const deletions = Array.from(keysToDelete);
          const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
          results.forEach((result, idx) => {
            if (result.status === 'rejected') {
              console.error('[paquetes] error borrando archivo:', deletions[idx], result.reason);
            }
          });
          const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
          if (deletedCount > 0) {
            toast.success(`${deletedCount} imágenes eliminadas de R2`, { id: 'delete-images' });
            toast.dismiss('delete-images');
          } else {
            toast.warning('Excursión eliminada, pero hubo errores al eliminar las imágenes', { id: 'delete-images' });
          }
        }
      }

      await deleteDoc(doc(db, 'paquetes', deleteId));
      toast.success('Excursión eliminada correctamente');
      fetchPaquetes();
    } catch (error) {
      console.error('Error deleting paquete:', error);
      toast.error('Error al eliminar paquete');
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateId) return;

    setDuplicating(true);
    try {
      const result = await duplicatePaquete(duplicateId);
      await revalidateFrontPaths(['/paquetes', `/paquete/${result.paquete.slug}`]);
      const updatedPaquetes = [...paquetes, result.paquete];
      const sortedVisible = sortPaquetes(updatedPaquetes.filter((item) => matchesSearch(item, searchTerm)), sort);
      const visibleIndex = sortedVisible.findIndex((item) => item.id === result.paquete.id);
      setPaquetes(updatedPaquetes);
      if (visibleIndex >= 0) {
        setCurrentPage(Math.floor(visibleIndex / itemsPerPage) + 1);
      }
      toast.success('Excursión duplicada correctamente', {
        description: `Se creó "${result.paquete.titulo}" con un ID nuevo y todos los datos replicados.`,
      });
    } catch (error) {
      console.error('Error duplicando paquete:', error);
      toast.error('Error al duplicar la excursión', {
        description: error instanceof Error ? error.message : 'No se pudo completar la duplicación.',
      });
    } finally {
      setDuplicating(false);
      setDuplicateId(null);
    }
  };

  // Filtrar paquetes por búsqueda
  const paquetesFiltrados = useMemo(() => {
    return paquetes.filter((paquete) => matchesSearch(paquete, searchTerm));
  }, [paquetes, searchTerm]);

  const paquetesOrdenados = useMemo(() => {
    return sortPaquetes(paquetesFiltrados, sort);
  }, [paquetesFiltrados, sort.direction, sort.key]);

  // Paginación
  const paquetesPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return paquetesOrdenados.slice(startIndex, endIndex);
  }, [paquetesOrdenados, currentPage, itemsPerPage]);

  // Resetear página cuando cambie la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-60 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4 space-y-3">
              <div className="h-9 w-full sm:w-80 bg-gray-200 rounded-xl animate-pulse" />
              <div className="grid gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`paq-row-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Excursiones</h1>
                {destacadosCount > 0 && (
                  <Badge 
                    variant={destacadosCount >= 9 ? 'destructive' : 'secondary'}
                    className={destacadosCount >= 9 ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-blue-100 text-blue-800 hover:bg-blue-100'}
                  >
                    {destacadosCount}/9 destacados
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                Gestiona las excursiones
                {destacadosCount >= 9 && (
                  <span className="text-amber-600 ml-2">
                    • Solo los primeros 9 destacados se muestran en el inicio
                  </span>
                )}
              </p>
            </div>
            <Button asChild className="bg-black hover:bg-gray-800 text-white">
              <Link href="/admin/paquetes/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Excursión
              </Link>
            </Button>
          </div>

          {/* Búsqueda */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por título, destino o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <DragDropTable
            items={paquetesPaginados}
            collectionName="paquetes"
            viewPath="/paquete"
            columns={[
              {
                key: 'orden',
                label: 'Orden',
                sortable: true,
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      #{item.orden}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'titulo',
                label: 'Título',
                sortable: true,
                render: (item) => (
                  <div className="max-w-xs">
                    <span className="font-medium text-gray-900 line-clamp-2">
                      {item.titulo}
                    </span>
                  </div>
                )
              },
              {
                key: 'destino',
                label: 'Destino',
                sortable: true,
                render: (item) => <span className="text-gray-700">{item.destino}</span>
              },
              {
                key: 'tipo',
                label: 'Tipo',
                sortable: true,
                render: (item) => (
                  <Badge variant="outline" className="font-medium">
                    {getPaqueteTipoLabel(item.tipo)}
                  </Badge>
                )
              },
              {
                key: 'precio',
                label: 'Precio',
                sortable: true,
                render: (item) => (
                  <span className="font-medium text-gray-900">
                    ${item.precio.toLocaleString('es-AR')}
                  </span>
                )
              },
              {
                key: 'estado',
                label: 'Estado',
                render: (item) => (
                  <div className="flex gap-2 flex-wrap">
                    <Badge 
                      variant={item.visible ? 'default' : 'secondary'}
                      className={item.visible ? 'bg-green-100 text-green-800 hover:bg-green-100 font-medium' : 'font-medium'}
                    >
                      <span className="inline-flex items-center gap-1">
                        {item.visible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {item.visible ? 'Visible' : 'Oculto'}
                      </span>
                    </Badge>
                    {item.destacado && (
                      <Badge className="bg-black text-white hover:bg-black font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          Destacado
                        </span>
                      </Badge>
                    )}
                  </div>
                )
              },
            ]}
            onItemsChange={(newItems) => {
              setPaquetes(newItems);
              fetchPaquetes(); // Recargar después de guardar
            }}
            onDelete={setDeleteId}
            onDuplicate={setDuplicateId}
            editPath="/admin/paquetes"
            sort={sort}
            onSortChange={setSort}
          />
          
          {/* Paginación */}
          {paquetesFiltrados.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <AdminPagination
                currentPage={currentPage}
                totalItems={paquetesFiltrados.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemName="excursiones"
              />
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="z-[101]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará la excursión permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!duplicateId} onOpenChange={() => !duplicating && setDuplicateId(null)}>
          <AlertDialogContent className="z-[101]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Duplicar excursión?</AlertDialogTitle>
              <AlertDialogDescription>
                Se creará una copia de esta excursión para que puedas editarla por separado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={duplicating}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleDuplicate();
                }}
                disabled={duplicating}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {duplicating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Duplicando...
                  </>
                ) : (
                  'Duplicar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}
