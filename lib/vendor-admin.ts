import { NextResponse } from 'next/server';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { requireAdminToken } from '@/lib/adminAuth';
import { normalizeDni } from '@/lib/auth/password-recovery';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';

export const VENDORS_COLLECTION = 'vendors';
export const REFERRAL_LINKS_COLLECTION = 'referralLinks';
export const RESERVATIONS_COLLECTION = 'reservas';

export { normalizeDni };

export function isValidDni(dni: string): boolean {
  return /^\d{7,8}$/.test(dni);
}

export function adminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
    siteConfig.company.adminEmailDefault;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

type GuardOk = { auth: Auth; db: Firestore };

/** Verifica Firebase Admin y una sesión Firebase válida, sin exigir email en la allowlist. */
export async function guardAuthenticated(request: Request): Promise<GuardOk | NextResponse> {
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      {
        error:
          'Firebase Admin no está configurado. Define FIREBASE_SERVICE_ACCOUNT en .env.local con el JSON del Service Account.',
      },
      { status: 500 }
    );
  }
  try {
    await requireAdminToken(request);
  } catch {
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }
  return { auth: adminAuth, db: adminDb };
}

/** Verifica que Firebase Admin esté configurado y que quien llama sea admin. */
export async function guardAdmin(request: Request): Promise<GuardOk | NextResponse> {
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      {
        error:
          'Firebase Admin no está configurado. Define FIREBASE_SERVICE_ACCOUNT en .env.local con el JSON del Service Account.',
      },
      { status: 500 }
    );
  }
  try {
    const adminUser = await requireAdminToken(request);
    const email = String(adminUser.email || '').toLowerCase();
    if (!email || !adminEmails().includes(email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }
  return { auth: adminAuth, db: adminDb };
}

export async function sendVendorAccessEmail(to: string, action: 'create' | 'reset') {
  if (!isResendConfigured() || !resend) {
    console.warn('[resend] not configured, skipping sendVendorAccessEmail');
    return;
  }
  const fromName = `${SITE_NAME} • Portal de Vendedores`;
  const fromEmail = getFromEmail(false);
  const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);
  const subject =
    action === 'create'
      ? `Tu acceso al Portal de Vendedores — ${SITE_NAME}`
      : 'Contraseña restablecida — Portal de Vendedores';
  const loginUrl = `${SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ''}/vendedor/login`;
  const lead = action === 'create' ? 'Tu usuario ha sido creado.' : 'Tu contraseña fue restablecida.';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.6">
      <h2 style="margin:0 0 12px">${SITE_NAME} — Portal de Vendedores</h2>
      <p>${lead}</p>
      <p>
        Usuario (email): <strong>${to}</strong><br/>
        Contraseña: <strong>tu número de DNI</strong> (solo números, sin puntos)
      </p>
      <p>Ingresá aquí: <a href="${loginUrl}">${loginUrl}</a></p>
      <hr/>
      <p style="font-size:12px; color:#666">Si no solicitaste este acceso, ignorá este correo.</p>
    </div>
  `;
  const text =
    `${lead}\n` +
    `Usuario (email): ${to}\n` +
    `Contraseña: tu número de DNI (solo números, sin puntos)\n` +
    `Ingresá aquí: ${loginUrl}\n` +
    `Si no solicitaste este acceso, ignorá este correo.`;
  try {
    const result: any = await resend.emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, html, text, replyTo });
    if (result?.error) console.error('[resend] sendVendorAccessEmail error', result.error);
  } catch (err) {
    console.error('[resend] sendVendorAccessEmail exception', err instanceof Error ? err.message : String(err));
  }
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === 'auth/email-already-exists') return 'Ya existe un usuario con ese email.';
    if (code === 'auth/invalid-email') return 'Email inválido.';
    if (code === 'auth/invalid-password') return 'DNI inválido para usar como contraseña.';
  }
  return error instanceof Error ? error.message : 'Error';
}
