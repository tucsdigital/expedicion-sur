'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { sendPasswordResetEmail, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2, Shield, AlertTriangle, Lock } from 'lucide-react';
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

export default function VendorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [mustChangeOpen, setMustChangeOpen] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [vendorDocId, setVendorDocId] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  useEffect(() => {
    const check = async () => {
      if (user && user.email) {
        const q = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
        const snap = await getDocs(q);
        if (snap.docs[0]) router.replace('/vendedor');
      }
    };
    check();
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const q = query(collection(db, 'vendors'), where('email', '==', email.trim()), limit(1));
      const snap = await getDocs(q);
      const d0 = snap.docs[0];
      if (!d0 || !(d0.data() as any).active) {
        try {
          await getAuthInstance().signOut?.();
        } catch {}
        toast.error('No estás autorizado como vendedor');
        return;
      }
      setVendorDocId(d0.id);
      const must = Boolean((d0.data() as any).mustChangePassword);
      if (must) {
        setMustChangeOpen(true);
      } else {
        router.replace('/vendedor');
      }
    } catch (error) {
      let description = 'Error de autenticación';
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as any).code as string;
        switch (code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            description = 'Email o contraseña incorrectos';
            break;
          case 'auth/invalid-api-key':
            description = 'Configuración de Firebase inválida (API key)';
            break;
          case 'auth/user-disabled':
            description = 'Cuenta deshabilitada';
            break;
          case 'auth/network-request-failed':
            description = 'Error de conexión. Verificá tu internet';
            break;
          default:
            description = 'No se pudo iniciar sesión';
        }
        // eslint-disable-next-line no-console
        console.warn('[VendorLogin] auth error:', code);
      }
      toast.error(description);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email) {
      toast.error('Ingresá tu email para enviar el enlace.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error('reset-failed');
      toast.success('Si existe una cuenta para este email, recibirás un enlace para restablecer tu contraseña.');
    } catch {
      // Fallback silencioso al email por defecto de Firebase si el endpoint falla
      try {
        const auth = getAuthInstance();
        await sendPasswordResetEmail(auth, email.trim());
      } catch {}
      toast.success('Si existe una cuenta para este email, recibirás un enlace para restablecer tu contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = (val: string) => {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  };

  const handleChangePassword = async () => {
    const v1 = newPwd.trim();
    const v2 = newPwd2.trim();
    if (v1 !== v2) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (pwdStrength(v1) < 4) {
      toast.error('La contraseña debe ser fuerte (8+, may/min, número y símbolo)');
      return;
    }
    try {
      const auth = getAuthInstance();
      if (!auth.currentUser) {
        toast.error('Sesión no disponible');
        return;
      }
      await updatePassword(auth.currentUser, v1);
      if (vendorDocId) {
        await updateDoc(doc(db, 'vendors', vendorDocId), { mustChangePassword: false });
      }
      toast.success('Contraseña actualizada');
      setMustChangeOpen(false);
      router.replace('/vendedor');
    } catch {
      toast.error('No se pudo actualizar la contraseña');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-linear-to-br from-white/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-linear-to-tr from-white/10 to-transparent rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 flex items-center justify-center bg-primary rounded-2xl shadow-lg p-3 border border-white/10">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="w-full h-full object-contain" />
              ) : (
                <Image src={logoSrc} alt={logoAlt} width={48} height={48} className="w-full h-full object-contain" />
              )}
            </div>
            <div className="text-center">
              <div className="font-logo text-primary text-3xl leading-none">{siteConfig.branding.logo.titleText}</div>
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Portal de Vendedores</h1>
              <p className="text-base text-gray-500">Accede con tu email autorizado</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-2.5 p-3.5 bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200/60 rounded-xl shadow-sm">
            <div className="shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-base text-emerald-700 font-medium">Conexión segura y cifrada</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-semibold text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendedor@expedicionsur.com"
                required
                disabled={loading}
                className="h-12 text-lg border-gray-300 focus:border-primary focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-semibold text-gray-700">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => setCapsLock((e as any).getModifierState?.('CapsLock') ?? false)}
                  onKeyUp={(e) => setCapsLock((e as any).getModifierState?.('CapsLock') ?? false)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="h-12 text-lg pr-10 border-gray-300 focus:border-primary focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Bloq Mayús activado
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </Button>
          </form>

          <button
            className="w-full text-left text-sm text-primary hover:underline"
            onClick={resetPassword}
            disabled={loading}
          >
            Olvidé mi contraseña
          </button>

          <div className="mt-2 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              Si es tu primer inicio con contraseña temporal, se te pedirá cambiarla.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 relative z-10">
        <p className="text-sm text-gray-400 font-medium tracking-wide">
          Desarrollado por <span className="text-gray-600 font-semibold">Tucs Digital</span>
        </p>
      </div>

      <Dialog open={mustChangeOpen} onOpenChange={(o) => o || setMustChangeOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Cambiar contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Debes establecer una contraseña nueva y segura para continuar.
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPwd">Nueva contraseña</Label>
              <Input
                id="newPwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="********"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPwd2">Confirmar contraseña</Label>
              <Input
                id="newPwd2"
                type="password"
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
                placeholder="********"
              />
            </div>
            <div className="h-2 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${pwdStrength(newPwd) >= 4 ? 'bg-emerald-500' : 'bg-orange-500'} transition-all`}
                style={{ width: `${Math.min(100, pwdStrength(newPwd) * 20 + 20)}%` }}
              />
            </div>
            <ul className="text-[11px] text-gray-600 grid grid-cols-2 gap-x-3 gap-y-1">
              <li>• 8+ caracteres</li>
              <li>• Mayúscula y minúscula</li>
              <li>• Número</li>
              <li>• Símbolo</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} className="gap-2">
              Guardar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
