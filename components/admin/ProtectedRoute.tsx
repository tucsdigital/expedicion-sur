'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { validateAdminDomain } from '@/lib/auth/authConfig';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [domainValid, setDomainValid] = useState(true);

  useEffect(() => {
    // Verificar dominio permitido
    const isValidDomain = validateAdminDomain();
    setDomainValid(isValidDomain);
    
    if (!isValidDomain) {
      console.warn('⚠️ Acceso denegado: dominio no autorizado');
      return;
    }

    // Redirigir al login si no hay usuario autenticado
    if (!loading && !user) {
      router.replace('/admin/login');
      return;
    }
  }, [user, loading, router]);

  // Mostrar error de dominio no autorizado
  if (!domainValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-4">
            Este dominio no está autorizado para acceder al panel de administración.
          </p>
          <p className="text-base text-gray-500">
            Contacta al administrador del sistema si crees que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-gray-900 mx-auto mb-2" />
          <p className="text-base text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, no mostrar nada (se redirige al login)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

