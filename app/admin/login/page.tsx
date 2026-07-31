'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { SessionManager } from '@/lib/auth/sessionManager';
import { configureAuthPersistence, validateAdminDomain } from '@/lib/auth/authConfig';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const [sessionManager] = useState(() => SessionManager.getInstance());
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  // Verificar si el usuario ya está autenticado
  useEffect(() => {
    if (user && user.email?.toLowerCase() === ADMIN_EMAIL) {
      router.replace('/admin');
    }
  }, [user, router]);

  // Verificar dominio permitido
  useEffect(() => {
    if (!validateAdminDomain()) {
      toast.error('Acceso no autorizado', {
        description: 'Este dominio no está autorizado para el panel admin',
      });
    }
  }, []);

  // Verificar bloqueo y actualizar timer
  useEffect(() => {
    const checkBlockStatus = () => {
      if (email) {
        const blocked = sessionManager.isUserBlocked(email);
        setIsBlocked(blocked);
        
        if (blocked) {
          const timeRemaining = sessionManager.getBlockTimeRemaining(email);
          setBlockTimeRemaining(timeRemaining);
        }
      }
    };

    checkBlockStatus();
    
    // Actualizar cada segundo si está bloqueado
    let interval: NodeJS.Timeout;
    if (isBlocked && blockTimeRemaining > 0) {
      interval = setInterval(() => {
        const timeRemaining = sessionManager.getBlockTimeRemaining(email);
        setBlockTimeRemaining(timeRemaining);
        
        if (timeRemaining <= 0) {
          setIsBlocked(false);
          setBlockTimeRemaining(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [email, isBlocked, blockTimeRemaining, sessionManager]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones de seguridad
    if (!validateAdminDomain()) {
      toast.error('Dominio no autorizado');
      return;
    }

    if (isBlocked) {
      const minutes = Math.ceil(blockTimeRemaining / 60000);
      toast.error('Cuenta temporalmente bloqueada', {
        description: `Intenta nuevamente en ${minutes} minuto(s)`,
      });
      return;
    }

    // Verificar tiempo mínimo entre intentos
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    if (timeSinceLastAttempt < 3000 && lastAttemptTime > 0) {
      toast.warning('Espera un momento', {
        description: 'Debes esperar entre intentos de login',
      });
      return;
    }

    setLastAttemptTime(now);
    setLoading(true);

    try {
      // Obtener instancia de auth (lazy loading)
      const auth = getAuthInstance();
      
      // Configurar persistencia antes del login
      await configureAuthPersistence(auth, rememberMe);
      
      // Intentar login
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Registrar intento exitoso
      sessionManager.recordLoginAttempt(email, true);
      sessionManager.clearLoginAttempts(email);
      
      // Crear sesión
      sessionManager.createSession(userCredential.user, rememberMe);
      
      toast.success('¡Bienvenido!', {
        description: `Sesión iniciada ${rememberMe ? 'y guardada' : 'temporalmente'}`,
      });
      
      router.push('/admin');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      
      // Registrar intento fallido
      sessionManager.recordLoginAttempt(email, false);
      
      // Determinar mensaje de error
      const errorMessage = 'Error al iniciar sesión';
      let errorDescription = 'Verifica tus credenciales';
      
      // Firebase Auth errors have a 'code' property
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        switch (firebaseError.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorDescription = 'Email o contraseña incorrectos';
            break;
          case 'auth/too-many-requests':
            errorDescription = 'Demasiados intentos. Intenta más tarde';
            break;
          case 'auth/user-disabled':
            errorDescription = 'Cuenta deshabilitada';
            break;
          case 'auth/network-request-failed':
            errorDescription = 'Error de conexión. Verifica tu internet';
            break;
          default:
            errorDescription = 'Error de autenticación';
        }
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
      });
      
      // Verificar si ahora está bloqueado
      const nowBlocked = sessionManager.isUserBlocked(email);
      if (nowBlocked) {
        setIsBlocked(true);
        const timeRemaining = sessionManager.getBlockTimeRemaining(email);
        setBlockTimeRemaining(timeRemaining);
        
        const minutes = Math.ceil(timeRemaining / 60000);
        toast.warning('Cuenta bloqueada temporalmente', {
          description: `Demasiados intentos fallidos. Intenta en ${minutes} minuto(s)`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatBlockTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary px-4 py-12 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-linear-to-br from-white/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-linear-to-tr from-white/10 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Card principal */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Logo: mismo que navbar principal */}
            <div className="w-20 h-20 flex items-center justify-center rounded-2xl shadow-lg p-3 transform transition-transform hover:scale-105 border border-white/10">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="w-full h-full object-contain" />
              ) : (
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="text-center">
              <div className="font-logo text-primary text-3xl leading-none">{siteConfig.branding.logo.titleText}</div>
            </div>
            
            {/* Título mejorado */}
            <div className="text-center space-y-1">
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                Panel de Administración
              </h1>
              <p className="text-base text-gray-500">
                Accede a tu cuenta de administrador
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5">
          {/* Indicador de seguridad mejorado */}
          <div className="flex items-center gap-2.5 p-3.5 bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200/60 rounded-xl shadow-sm">
            <div className="shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-base text-emerald-700 font-medium">
              Conexión segura y cifrada
            </span>
          </div>

          {/* Alerta de bloqueo mejorada */}
          {isBlocked && (
            <div className="flex items-start gap-3 p-4 bg-linear-to-r from-red-50 to-rose-50 border border-red-200/60 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-red-900">Cuenta temporalmente bloqueada</p>
                <p className="text-sm text-red-700 mt-1.5 font-medium">
                  Tiempo restante: <span className="font-bold">{formatBlockTime(blockTimeRemaining)}</span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Campo Email mejorado */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-semibold text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ADMIN_EMAIL}
                required
                disabled={loading || isBlocked}
                className="h-12 text-lg border-gray-300 focus:border-primary focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="email"
              />
            </div>

            {/* Campo Contraseña mejorado */}
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
                  disabled={loading || isBlocked}
                  className="h-12 text-lg pr-10 border-gray-300 focus:border-primary focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading || isBlocked}
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
            
            {/* Checkbox "Recordarme" mejorado */}
            <div className="flex items-center space-x-3 pt-1">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={loading || isBlocked}
                className="h-5 w-5 border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-base font-medium text-gray-700 leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none"
              >
                Mantener sesión iniciada
              </Label>
            </div>
            
            {/* Botón mejorado */}
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading || isBlocked}
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

          {/* Información de seguridad mejorada */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              Tu sesión se mantendrá segura y se cerrará automáticamente por inactividad
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Marca de agua */}
      <div className="mt-8 relative z-10">
        <p className="text-sm text-gray-400 font-medium tracking-wide">
          Desarrollado por{' '}
          <span className="text-gray-600 font-semibold">Tucs Digital</span>
        </p>
      </div>
    </div>
  );
}
