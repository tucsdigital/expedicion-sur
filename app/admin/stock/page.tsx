'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import StockDashboard from '@/components/admin/StockDashboard';
import { getExperiencias } from '@/lib/experiencias';
import type { Experience } from '@/components/landing-reserva/types';

export default function StockPage() {
  const [experiencias, setExperiencias] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExperiencias = async () => {
      try {
        const data = await getExperiencias({ visibleOnly: false });
        setExperiencias(data);
      } catch (error) {
        console.error('[StockPage] Error cargando experiencias:', error);
        toast.error('No pudimos cargar las experiencias');
      } finally {
        setLoading(false);
      }
    };

    fetchExperiencias();
  }, []);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-6 w-40 rounded-md bg-gray-200 animate-pulse" />
              <div className="h-4 w-72 rounded-md bg-gray-200 animate-pulse" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
              <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
            </div>
            <div className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : (
          <StockDashboard experiencias={experiencias} />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
