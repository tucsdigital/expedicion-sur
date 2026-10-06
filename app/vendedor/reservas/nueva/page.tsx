'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import AdminReservaForm from '@/components/admin/AdminReservaForm';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SITE_NAME } from '@/lib/constants';
import type { Paquete } from '@/types';

export default function VendorNuevaReservaPage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    const load = async () => {
      setLoading(true);
      try {
        const vq = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
        const vs = await getDocs(vq);
        const v = vs.docs[0];
        if (!v) {
          toast.error('No se encontró tu perfil de vendedor');
          return;
        }
        const vendorData = v.data() as any;
        const allowed: string[] | null = Array.isArray(vendorData?.allowedPackages)
          ? (vendorData.allowedPackages as string[])
          : (Array.isArray(vendorData?.allowedExperiences) ? (vendorData.allowedExperiences as string[]) : null);
        const pkgSnap = await getDocs(collection(db, 'paquetes'));
        const all = pkgSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((e: any) => e.titulo && e.slug)
          .map((e: any) => ({
            id: e.id,
            titulo: e.titulo ?? e.title ?? '',
            slug: e.slug ?? '',
            moneda: e.moneda ?? 'ARS',
            precio: e.precio ?? 0,
            bookingConfig: e.bookingConfig,
            addons: e.addons ?? [],
            seatLayoutId: e.seatLayoutId ?? null,
            salidas: e.salidas ?? [],
          })) as Paquete[];
        const filtered = Array.isArray(allowed) && allowed.length > 0
          ? all.filter((e) => allowed.includes(e.id))
          : all;
        filtered.sort((a, b) => (a.titulo ?? '').localeCompare(b.titulo ?? '', 'es'));
        setPackages(filtered);
      } catch {
        toast.error('No pudimos cargar los datos para crear la reserva');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6 pb-10">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 p-6 text-center shadow-lg">
              <p className="text-gray-600">
                Consultá con el equipo de {SITE_NAME} para que te habiliten paquetes para crear reservas manuales.
              </p>
            </div>
          ) : (
            <AdminReservaForm
              paquetes={packages}
              hideReferral
              hideVendorSelect
              hideStatus
              hideOverbook
              apiEndpoint="/api/vendor/reservas"
              successRedirect="/vendedor/reservas"
            />
          )}
        </div>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
