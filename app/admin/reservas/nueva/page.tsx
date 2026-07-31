'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import AdminReservaForm from '@/components/admin/AdminReservaForm';
import { getExperiencias } from '@/lib/experiencias';
import type { Experience } from '@/components/landing-reserva/types';

export default function AdminReservaNuevaPage() {
  const [experiencias, setExperiencias] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const fetchExperiencias = async () => {
      try {
        const data = await getExperiencias({ visibleOnly: false });
        if (!isCancelled) {
          setExperiencias(data);
        }
      } catch (error) {
        console.error('[admin/reservas/nueva] Error cargando experiencias:', error);
        toast.error('No pudimos cargar las experiencias disponibles');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchExperiencias();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-4 w-60 bg-gray-200 rounded-md animate-pulse" />
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`exp-skel-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          ) : experiencias.length === 0 ? (
            <Card className="mx-auto max-w-xl border border-dashed border-gray-200 bg-white/80 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  No hay experiencias aún
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-600">
                <p>
                  Primero necesitás crear al menos una experiencia en el panel. Una vez lista, vas
                  a poder crear reservas manuales sin pasar por el checkout.
                </p>
                <Button asChild variant="default">
                  <Link href="/admin/experiencias/nuevo">Crear nueva experiencia</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <AdminReservaForm experiencias={experiencias} />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
