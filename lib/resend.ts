import { Resend } from 'resend';

const apiKey = String(process.env.RESEND_API_KEY ?? '').trim();
const configuredFrom = String(process.env.RESEND_FROM_EMAIL ?? '').trim();
// Resend's shared test sender is useful in development, but it must never be
// silently used for customer emails in production.
const fromEnv = configuredFrom || (process.env.NODE_ENV === 'production' ? '' : 'onboarding@resend.dev');
const brandName = process.env.BRAND_NAME ?? 'VIAGGIO TUR';

export const resend = apiKey ? new Resend(apiKey) : null;

export function getFromEmail(branded = true): string {
  const val = String(fromEnv).trim();
  if (!val) return '';
  if (!branded) {
    const match = val.match(/<([^>]+)>/);
    return match ? match[1] : val;
  }
  if (val.includes('<') && val.includes('>')) {
    return val;
  }
  return `${brandName} <${val}>`;
}

export function getEmailJobFrom(savedFrom?: string | null): string {
  const saved = String(savedFrom ?? '').trim();
  if (!saved || /onboarding@resend\.dev/i.test(saved)) return getFromEmail(true);
  return saved;
}

export function isResendConfigured(): boolean {
  return Boolean(apiKey && fromEnv);
}

export function resendConfigurationError(): string | null {
  if (!apiKey) return 'Falta RESEND_API_KEY';
  if (!fromEnv) return 'Falta RESEND_FROM_EMAIL; configurá un remitente de un dominio verificado en Resend';
  return null;
}
