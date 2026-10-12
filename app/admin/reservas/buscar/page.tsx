import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import ReservaSearchDashboard from '@/components/admin/ReservaSearchDashboard';
import { getAllExperienciasAdmin } from '@/lib/experiencias-catalog';

export default async function AdminReservasBuscarPage() {
  const experiencias = await getAllExperienciasAdmin();
  return (
    <ProtectedRoute>
      <AdminLayout>
        <ReservaSearchDashboard experiencias={experiencias} />
      </AdminLayout>
    </ProtectedRoute>
  );
}
