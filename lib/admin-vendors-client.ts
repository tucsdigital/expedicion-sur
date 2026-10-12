import { getAuthInstance } from '@/lib/firebase';

export type AdminVendorOption = {
  id: string;
  name: string;
  email: string;
  dni: string;
  active: boolean;
  allowedExperiences: string[] | null;
};

export type AdminVendorLink = {
  id: string;
  code: string;
  active: boolean;
  vendorId: string;
  experienceId: string | null;
  experienceName: string;
};

async function get<T>(query: string): Promise<T> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error('Sesión admin no encontrada');
  const token = await user.getIdToken();
  const res = await fetch(`/api/admin/vendors${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la información de vendedores');
  return data as T;
}

export async function fetchAdminVendors(includeId?: string): Promise<AdminVendorOption[]> {
  const qs = includeId ? `?include=${encodeURIComponent(includeId)}` : '';
  return (await get<{ vendors: AdminVendorOption[] }>(qs)).vendors;
}

export async function fetchAdminVendorLinks(vendorId: string): Promise<AdminVendorLink[]> {
  return (await get<{ links: AdminVendorLink[] }>(`?vendorId=${encodeURIComponent(vendorId)}`)).links;
}
