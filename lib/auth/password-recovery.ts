export type PasswordRecoveryRole = 'admin' | 'vendor';

export const PASSWORD_RECOVERY_TTL_MINUTES = 10;
export const PASSWORD_RECOVERY_COLLECTION = 'passwordRecoverySessions';

export function normalizeDni(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '').trim();
}

export function validatePasswordStrength(password: string): string | null {
  const value = String(password ?? '');
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(value)) return 'La contraseña debe incluir al menos una mayúscula.';
  if (!/[a-z]/.test(value)) return 'La contraseña debe incluir al menos una minúscula.';
  if (!/[0-9]/.test(value)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'La contraseña debe incluir al menos un símbolo.';
  return null;
}

export function buildPasswordRecoveryChallenge(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parsePasswordRecoveryChallenge(value: unknown): { sessionId: string; secret: string } | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const [sessionId, secret] = raw.split('.');
  if (!sessionId || !secret) return null;
  return { sessionId: sessionId.trim(), secret: secret.trim() };
}
