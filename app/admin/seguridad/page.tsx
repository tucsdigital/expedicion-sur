'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAuthInstance } from '@/lib/firebase';
import { normalizeDni } from '@/lib/auth/password-recovery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function SeguridadAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const auth = getAuthInstance();
        const user = auth.currentUser;
        if (!user) throw new Error('Sesión no disponible');
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/security/admin-auth-profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'No se pudo cargar la configuración.');
        setEmail(String(data?.email ?? '').trim().toLowerCase());
        setDni(String(data?.dni ?? '').trim());
      } catch (error) {
        toast.error('No pudimos cargar la seguridad del panel', {
          description: error instanceof Error ? error.message : 'Probá nuevamente.',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    const normalized = normalizeDni(dni);
    if (normalized.length < 7) {
      toast.error('Ingresá un DNI válido.');
      return;
    }

    setSaving(true);
    try {
      const auth = getAuthInstance();
      const user = auth.currentUser;
      if (!user) throw new Error('Sesión no disponible');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/security/admin-auth-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dni: normalized }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo guardar el DNI.');

      setDni(String(data?.dni ?? normalized));
      toast.success('DNI actualizado', {
        description: 'El flujo de recuperación del admin ya puede validar esta identidad.',
      });
    } catch (error) {
      toast.error('No pudimos guardar la configuración', {
        description: error instanceof Error ? error.message : 'Probá nuevamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6 flex justify-center">

          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#0F1F52]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Configuración</CardTitle>
                  <CardDescription>
                    Ajustá los datos necesarios para recuperar el acceso al panel.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando configuración...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Correo del administrador</Label>
                    <Input value={email} readOnly className="bg-gray-50 text-gray-600" />
                    <p className="text-xs text-gray-500">
                      Se completa automáticamente con la cuenta actual.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-dni">DNI de recuperación</Label>
                    <Input
                      id="admin-dni"
                      inputMode="numeric"
                      placeholder="30111222"
                      value={dni}
                      onChange={(event) => setDni(normalizeDni(event.target.value))}
                    />
                    <p className="text-xs text-gray-500">
                      Ingresá el DNI que usarás para verificar tu identidad al recuperar la contraseña.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Guardar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
