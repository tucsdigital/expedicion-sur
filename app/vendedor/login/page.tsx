'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import {
  Check,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  LockKeyhole,
  Mail,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { configureAuthPersistence } from '@/lib/auth/authConfig';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthPortalShell from '@/components/auth/AuthPortalShell';
import { normalizeDni, validatePasswordStrength } from '@/lib/auth/password-recovery';

type ViewState = 'login' | 'recover-dni' | 'recover-reset' | 'recover-success';

export default function VendorLoginPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<ViewState>('login');
  const [dni, setDni] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [mustChangeOpen, setMustChangeOpen] = useState(false);
  const [mustChangePasswordValue, setMustChangePasswordValue] = useState('');
  const [mustChangePasswordConfirm, setMustChangePasswordConfirm] = useState('');
  const [vendorDocId, setVendorDocId] = useState<string | null>(null);

  const passwordHint = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);
  const mustChangePasswordHint = useMemo(
    () => validatePasswordStrength(mustChangePasswordValue),
    [mustChangePasswordValue]
  );

  useEffect(() => {
    const check = async () => {
      if (!user?.email) return;
      const q = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
      const snap = await getDocs(q);
      if (snap.docs[0]) router.replace('/vendedor');
    };
    check();
  }, [router, user]);

  const resetRecoveryState = () => {
    setDni('');
    setChallengeToken('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryLoading(false);
    setView('login');
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await configureAuthPersistence(auth, rememberMe);
      await signInWithEmailAndPassword(auth, email.trim(), password);

      const q = query(collection(db, 'vendors'), where('email', '==', email.trim().toLowerCase()), limit(1));
      const snap = await getDocs(q);
      const vendor = snap.docs[0];
      if (!vendor || !(vendor.data() as any).active) {
        await auth.signOut().catch(() => null);
        toast.error('No estás autorizado como vendedor.');
        return;
      }

      setVendorDocId(vendor.id);
      if (Boolean((vendor.data() as any).mustChangePassword)) {
        setMustChangeOpen(true);
        toast.message('Necesitás actualizar tu contraseña para continuar.');
        return;
      }

      toast.success('Sesión iniciada');
      router.replace('/vendedor');
    } catch (error) {
      let description = 'No se pudo iniciar sesión.';
      if (error && typeof error === 'object' && 'code' in error) {
        switch ((error as { code: string }).code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            description = 'Email o contraseña incorrectos.';
            break;
          case 'auth/user-disabled':
            description = 'La cuenta está deshabilitada.';
            break;
          case 'auth/network-request-failed':
            description = 'No pudimos conectarnos. Revisá tu internet.';
            break;
        }
      }
      toast.error(description);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDni(dni);
    if (normalized.length < 7) {
      toast.error('Ingresá un DNI válido.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const response = await fetch('/api/auth/password-recovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'vendor', dni: normalized }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.challengeToken) {
        throw new Error(data?.error || 'No pudimos validar tu identidad.');
      }

      setChallengeToken(String(data.challengeToken));
      setView('recover-reset');
      toast.success('Identidad validada', {
        description: 'Ahora podés crear una nueva contraseña.',
      });
    } catch (error) {
      toast.error('No pudimos continuar', {
        description: error instanceof Error ? error.message : 'Probá nuevamente.',
      });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleCompleteRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challengeToken) {
      toast.error('La sesión de recuperación ya no es válida.');
      setView('recover-dni');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (passwordHint) {
      toast.error(passwordHint);
      return;
    }

    setRecoveryLoading(true);
    try {
      const response = await fetch('/api/auth/password-recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          newPassword,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'No pudimos cambiar tu contraseña.');
      }

      setView('recover-success');
      setChallengeToken('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Contraseña actualizada');
    } catch (error) {
      toast.error('No pudimos actualizar la contraseña', {
        description: error instanceof Error ? error.message : 'Probá nuevamente.',
      });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleMustChangePassword = async () => {
    if (mustChangePasswordValue !== mustChangePasswordConfirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (mustChangePasswordHint) {
      toast.error(mustChangePasswordHint);
      return;
    }

    try {
      const auth = getAuthInstance();
      if (!auth.currentUser) {
        toast.error('La sesión ya no está disponible.');
        return;
      }
      await updatePassword(auth.currentUser, mustChangePasswordValue);
      if (vendorDocId) {
        await updateDoc(doc(db, 'vendors', vendorDocId), { mustChangePassword: false });
      }
      setMustChangeOpen(false);
      setMustChangePasswordValue('');
      setMustChangePasswordConfirm('');
      toast.success('Contraseña actualizada');
      router.replace('/vendedor');
    } catch {
      toast.error('No se pudo actualizar la contraseña.');
    }
  };

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold text-[#24335B]">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7F8AA5]" />
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Ingresá tu email"
            autoComplete="email"
            disabled={loading}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-4 pr-11 text-[15px] shadow-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold text-[#24335B]">
          Contraseña
        </Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7F8AA5]" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => setCapsLock((event as any).getModifierState?.('CapsLock') ?? false)}
            onKeyUp={(event) => setCapsLock((event as any).getModifierState?.('CapsLock') ?? false)}
            placeholder="Ingresá tu contraseña"
            autoComplete="current-password"
            disabled={loading}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-11 pr-11 text-[15px] shadow-none"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPassword((value) => !value)}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#7F8AA5] transition hover:bg-[#F2F5FB] hover:text-[#223460]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock ? <p className="text-xs text-amber-700">Bloq Mayús activado.</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-[#50607F]">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
            disabled={loading}
            className="border-[#C7D2E5] data-[state=checked]:border-[#0F1F52] data-[state=checked]:bg-[#0F1F52]"
          />
          Recordarme
        </label>

        <button
          type="button"
          onClick={() => setView('recover-dni')}
          className="font-medium text-[#2354E6] transition hover:text-[#1639A8]"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#0F1F52_0%,#0B2F7D_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,31,82,0.26)] transition hover:opacity-95"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Iniciar sesión
      </Button>
    </form>
  );

  const renderRecoverDni = () => (
    <form onSubmit={handleStartRecovery} className="space-y-5">
      <div className="rounded-2xl border border-[#E4EAF4] bg-[#F8FAFD] px-4 py-3 text-xs leading-5 text-[#5E6B88]">
        Usá el DNI cargado en tu perfil de vendedor. Si todavía no está configurado, primero debe actualizarse desde el panel administrador.
      </div>
      <div className="space-y-2">
        <Label htmlFor="dni" className="text-sm font-semibold text-[#24335B]">
          DNI
        </Label>
        <div className="relative">
          <IdCard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7F8AA5]" />
          <Input
            id="dni"
            inputMode="numeric"
            value={dni}
            onChange={(event) => setDni(normalizeDni(event.target.value))}
            placeholder="Ingresá tu número de DNI"
            disabled={recoveryLoading}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-11 text-[15px] shadow-none"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={recoveryLoading}
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#0F1F52_0%,#0B2F7D_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,31,82,0.26)] transition hover:opacity-95"
      >
        {recoveryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Validar identidad
      </Button>
    </form>
  );

  const renderRecoverReset = () => (
    <form onSubmit={handleCompleteRecovery} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-sm font-semibold text-[#24335B]">
          Nueva contraseña
        </Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7F8AA5]" />
          <Input
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Creá una contraseña segura"
            disabled={recoveryLoading}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-11 pr-11 text-[15px] shadow-none"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#7F8AA5] transition hover:bg-[#F2F5FB] hover:text-[#223460]"
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-semibold text-[#24335B]">
          Confirmar contraseña
        </Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7F8AA5]" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repetí la nueva contraseña"
            disabled={recoveryLoading}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-11 pr-11 text-[15px] shadow-none"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#7F8AA5] transition hover:bg-[#F2F5FB] hover:text-[#223460]"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E1E7F2] bg-[#F8FAFD] px-4 py-3 text-xs leading-5 text-[#5E6B88]">
        <p className="font-semibold text-[#24335B]">La nueva contraseña debe incluir:</p>
        <ul className="mt-1 space-y-1">
          <li>8 caracteres o más</li>
          <li>Mayúscula, minúscula, número y símbolo</li>
          {newPassword ? <li>{passwordHint ?? 'La estructura es válida.'}</li> : null}
        </ul>
      </div>

      <Button
        type="submit"
        disabled={recoveryLoading}
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#0F1F52_0%,#0B2F7D_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,31,82,0.26)] transition hover:opacity-95"
      >
        {recoveryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Guardar nueva contraseña
      </Button>
    </form>
  );

  const renderRecoverSuccess = () => (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
        La contraseña fue actualizada correctamente. Ya podés volver a ingresar al portal de vendedores.
      </div>
      <Button
        type="button"
        onClick={resetRecoveryState}
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#0F1F52_0%,#0B2F7D_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,31,82,0.26)] transition hover:opacity-95"
      >
        Volver al inicio de sesión
      </Button>
    </div>
  );

  return (
    <>
      {view === 'login' ? (
        <AuthPortalShell
          roleLabel="Portal de Vendedores"
          title="Panel Vendedor"
          subtitle="Ingresá a tu cuenta para gestionar reservas, ventas y seguimiento comercial."
          icon={<ShieldCheck className="h-9 w-9" />}
        >
          {renderLogin()}
        </AuthPortalShell>
      ) : view === 'recover-dni' ? (
        <AuthPortalShell
          roleLabel="Portal de Vendedores"
          title="Recuperar contraseña"
          subtitle="Validá tu identidad con el DNI registrado para habilitar el cambio de contraseña."
          icon={<ShieldCheck className="h-9 w-9" />}
          backLabel="Volver al login"
          onBack={resetRecoveryState}
        >
          {renderRecoverDni()}
        </AuthPortalShell>
      ) : view === 'recover-reset' ? (
        <AuthPortalShell
          roleLabel="Portal de Vendedores"
          title="Nueva contraseña"
          subtitle="Definí una nueva clave segura. Este acceso de recuperación es temporal y de un solo uso."
          icon={<KeyRound className="h-9 w-9" />}
          backLabel="Volver al login"
          onBack={resetRecoveryState}
        >
          {renderRecoverReset()}
        </AuthPortalShell>
      ) : (
        <AuthPortalShell
          roleLabel="Portal de Vendedores"
          title="Contraseña actualizada"
          subtitle="Tu cuenta ya quedó protegida con la nueva contraseña y podés volver a ingresar."
          icon={<Check className="h-9 w-9" />}
          status="success"
        >
          {renderRecoverSuccess()}
        </AuthPortalShell>
      )}

      <Dialog open={mustChangeOpen} onOpenChange={(open) => !open || setMustChangeOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Actualizá tu contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Esta cuenta tiene una contraseña temporal. Definí una nueva para continuar.
            </div>
            <div className="space-y-2">
              <Label htmlFor="mustChangePasswordValue">Nueva contraseña</Label>
              <Input
                id="mustChangePasswordValue"
                type="password"
                value={mustChangePasswordValue}
                onChange={(event) => setMustChangePasswordValue(event.target.value)}
                placeholder="Ingresá una nueva contraseña"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mustChangePasswordConfirm">Confirmar contraseña</Label>
              <Input
                id="mustChangePasswordConfirm"
                type="password"
                value={mustChangePasswordConfirm}
                onChange={(event) => setMustChangePasswordConfirm(event.target.value)}
                placeholder="Repetí la contraseña"
              />
            </div>
            {mustChangePasswordValue ? (
              <div className="text-xs text-[#5E6B88]">
                {mustChangePasswordHint ?? 'La contraseña cumple con los requisitos.'}
              </div>
            ) : null}
            {capsLock ? (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Bloq Mayús activado.
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={handleMustChangePassword} className="gap-2">
              Guardar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
