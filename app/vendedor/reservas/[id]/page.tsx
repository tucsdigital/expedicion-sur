'use client';

import { useEffect, useState } from 'react';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { getReservaById } from '@/lib/reservas';
import { getPaqueteById } from '@/lib/paquetes';
import AdminReservaForm from '@/components/admin/AdminReservaForm';
import { Loader2 } from 'lucide-react';
import type { Reservation } from '@/components/landing-reserva/types';
import type { Paquete } from '@/types';

export default function VendorReservaEditPage() {
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Paquete | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const path = window.location.pathname;
        const id = path.split('/').pop();
        if (!id) {
          setError('Reserva no encontrada');
          return;
        }
        const data = await getReservaById(id);
        if (!data) {
          setError('Reserva no encontrada');
          return;
        }
        setReserva(data);
        if (data.packageId) {
          const pkg = await getPaqueteById(data.packageId);
          if (pkg) setSelectedPackage(pkg);
        }
      } catch {
        setError('No pudimos cargar la reserva');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <VendorProtectedRoute>
        <VendorLayout>
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        </VendorLayout>
      </VendorProtectedRoute>
    );
  }

  if (error || !reserva || !selectedPackage) {
    return (
      <VendorProtectedRoute>
        <VendorLayout>
          <div className="text-center py-20">
            <p className="text-red-600">{error ?? (selectedPackage ? 'Reserva no encontrada' : 'Paquete no encontrado')}</p>
          </div>
        </VendorLayout>
      </VendorProtectedRoute>
    );
  }

  const initialData = {
    packageId: reserva.packageId || reserva.experienceId,
    date: reserva.date,
    peopleAdults: reserva.peopleAdults ?? reserva.people ?? 1,
    peopleMinors: reserva.peopleMinors ?? 0,
    customerName: reserva.customerName,
    customerEmail: reserva.customerEmail,
    customerPhone: reserva.customerPhone ?? undefined,
    customerDocument: reserva.customerDocument ?? undefined,
    customerBirthDate: reserva.customerBirthDate ?? undefined,
    customerComments: reserva.customerComments ?? undefined,
    selectedExtraCodes: reserva.selectedExtras?.map((e) => e.code) ?? undefined,
  };

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6 pb-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Editar reserva</h1>
            <p className="text-sm text-gray-500">{reserva.packageTitle || reserva.experienceTitle}</p>
          </div>
          <AdminReservaForm
            paquetes={[selectedPackage]}
            hideReferral
            hideVendorSelect
            hideStatus
            hideOverbook
            apiEndpoint="/api/vendor/reservas"
            successRedirect="/vendedor/reservas"
            initialData={initialData}
          />
        </div>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
