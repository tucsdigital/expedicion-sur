'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthPortalShell from '@/components/auth/AuthPortalShell';
import { configureAuthPersistence } from '@/lib/auth/authConfig';
import { ADMIN_EMAIL } from '@/lib/constants';
import { normalizeDni, validatePasswordStrength } from '@/lib/auth/password-recovery';

type ViewState = 'login' | 'recover-dni' | 'recover-reset' | 'recover-success';

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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

  useEffect(() => {
    if (user) {
      router.replace('/admin');
    }
  }, [router, user]);

  const canInteract = !loading;
  const passwordHint = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);

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
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

      toast.success('Sesión iniciada', {
        description: 'Accediste correctamente al panel administrador.',
      });
      router.push('/admin');
    } catch (error) {
      let description = 'Verificá tus credenciales.';
      if (error && typeof error === 'object' && 'code' in error) {
        switch ((error as { code: string }).code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            description = 'Email o contraseña incorrectos.';
            break;
          case 'auth/too-many-requests':
            description = 'Demasiados intentos. Esperá unos minutos.';
            break;
          case 'auth/user-disabled':
            description = 'Tu cuenta se encuentra deshabilitada.';
            break;
          case 'auth/network-request-failed':
            description = 'No pudimos conectarnos. Revisá tu internet.';
            break;
          default:
            description = 'No se pudo iniciar sesión.';
        }
      }

      toast.error('Error al iniciar sesión', { description });
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
        body: JSON.stringify({ role: 'admin', dni: normalized }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.challengeToken) {
        throw new Error(data?.error || 'No pudimos validar tu identidad.');
      }

      setChallengeToken(String(data.challengeToken));
      setView('recover-reset');
      toast.success('Identidad validada', {
        description: 'Ahora podés definir una nueva contraseña.',
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
      toast.success('Contraseña actualizada', {
        description: 'Ya podés ingresar con tu nueva clave.',
      });
    } catch (error) {
      toast.error('No pudimos actualizar la contraseña', {
        description: error instanceof Error ? error.message : 'Probá nuevamente.',
      });
    } finally {
      setRecoveryLoading(false);
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
            placeholder={ADMIN_EMAIL}
            autoComplete="email"
            disabled={!canInteract}
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
            disabled={!canInteract}
            className="h-12 rounded-2xl border-[#D6DEEC] bg-white px-11 pr-11 text-[15px] shadow-none"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPassword((value) => !value)}
            disabled={!canInteract}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#7F8AA5] transition hover:bg-[#F2F5FB] hover:text-[#223460]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock ? (
          <p className="text-xs text-amber-700">Bloq Mayús activado.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-[#50607F]">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
            disabled={!canInteract}
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
        disabled={!canInteract}
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#0F1F52_0%,#0B2F7D_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,31,82,0.26)] transition hover:opacity-95"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Iniciar sesión
      </Button>
    </form>
  );

  const renderRecoverDni = () => (
    <form onSubmit={handleStartRecovery} className="space-y-5">
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
        <p className="font-semibold text-[#24335B]">Tu nueva contraseña debe incluir:</p>
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
        Tu contraseña fue actualizada correctamente. Ya podés volver al panel e ingresar con la nueva clave.
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

  if (view === 'recover-dni') {
    return (
      <AuthPortalShell
        roleLabel="Panel Admin"
        title="Recuperar contraseña"
        subtitle="Ingresá tu DNI para validar tu identidad y continuar con el cambio de contraseña."
        icon={<ShieldCheck className="h-9 w-9" />}
        backLabel="Volver al login"
        onBack={resetRecoveryState}
      >
        {renderRecoverDni()}
      </AuthPortalShell>
    );
  }

  if (view === 'recover-reset') {
    return (
      <AuthPortalShell
        roleLabel="Panel Admin"
        title="Nueva contraseña"
        subtitle="Definí una nueva clave segura. El acceso de recuperación es temporal y de un solo uso."
        icon={<KeyRound className="h-9 w-9" />}
        backLabel="Volver al login"
        onBack={resetRecoveryState}
      >
        {renderRecoverReset()}
      </AuthPortalShell>
    );
  }

  if (view === 'recover-success') {
    return (
      <AuthPortalShell
        roleLabel="Panel Admin"
        title="Contraseña actualizada"
        subtitle="El proceso finalizó correctamente y tu cuenta ya quedó protegida con la nueva contraseña."
        icon={<Check className="h-9 w-9" />}
        status="success"
      >
        {renderRecoverSuccess()}
      </AuthPortalShell>
    );
  }

  return (
    <AuthPortalShell
      roleLabel="Panel Admin"
      title="Panel Admin"
      subtitle="Accedé a tu cuenta para continuar con la gestión interna de Expedicion Sur."
      icon={<ShieldCheck className="h-9 w-9" />}
    >
      {renderLogin()}
    </AuthPortalShell>
  );
}
