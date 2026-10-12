'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { ADMIN_EMAIL } from '@/lib/constants';
import { VendorApiError, vendorFetch } from '@/lib/vendor-client';
import { VendorContextProvider, type VendorProfile } from '@/components/vendor/VendorContext';

export default function VendorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/vendedor/login');
      return;
    }
    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
      router.replace('/admin');
      return;
    }
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const data = await vendorFetch<{ vendor: VendorProfile }>(user, '/api/vendor/me');
        if (cancelled) return;
        setProfile(data.vendor);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof VendorApiError && (e.status === 401 || e.status === 403)) {
          router.replace('/vendedor/login');
          return;
        }
        setError(e instanceof Error ? e.message : 'No pudimos verificar tu acceso');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Verificando acceso...
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm rounded-xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button className="mt-3 text-sm font-medium text-gray-700 underline" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!profile) return null;
  return <VendorContextProvider value={profile}>{children}</VendorContextProvider>;
}
