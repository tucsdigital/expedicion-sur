import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit as firestoreLimit, query, where } from 'firebase/firestore';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
});

async function vendorExists(email: string): Promise<boolean> {
  const q = query(collection(db, 'vendors'), where('email', '==', email.toLowerCase()), firestoreLimit(1));
  const snap = await getDocs(q);
  const d0 = snap.docs[0];
  if (!d0) return false;
  const data = d0.data() as any;
  return Boolean(data?.active);
}

function buildEmailHtml(resetUrl: string) {
  const brandUrl = SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  return `
  <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #111827;">
    <div style="text-align:center; padding: 24px 0;">
      <a href="${brandUrl}" style="text-decoration:none; display:inline-flex; align-items:center; gap:10px;">
        <span style="display:inline-block; width:44px; height:44px; background:#111827; border-radius:12px;"></span>
        <span style="font-size:18px; font-weight:700; color:#111827;">${SITE_NAME}</span>
      </a>
    </div>
    <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:24px;">
      <h1 style="margin:0 0 8px; font-size:20px;">Restablecer contraseña</h1>
      <p style="margin:0 0 12px; color:#374151;">
        Recibimos una solicitud para restablecer tu contraseña del <strong>Portal de Vendedores</strong>.
      </p>
      <p style="margin:0 0 18px; color:#374151;">
        Hacé clic en el botón para crear una nueva contraseña. Este enlace expira en poco tiempo por seguridad.
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${resetUrl}" style="display:inline-block; background:#111827; color:#ffffff; padding:12px 18px; border-radius:10px; font-weight:600; text-decoration:none;">
          Restablecer contraseña
        </a>
      </div>
      <p style="margin:0 0 6px; color:#6b7280; font-size:14px;">
        Si el botón no funciona, copiá y pegá este enlace en tu navegador:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#6b7280;">${resetUrl}</p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
      <p style="margin:0; color:#6b7280; font-size:12px;">
        Si no solicitaste este cambio, ignorá este correo. Por seguridad nadie fuera de vos puede cambiar tu contraseña sin este enlace.
      </p>
    </div>
    <p style="text-align:center; color:#9ca3af; font-size:12px; margin-top:16px;">© ${new Date().getFullYear()} ${SITE_NAME}</p>
  </div>
  `;
}

export async function POST(request: Request) {
  // Siempre respondemos 200 para no revelar existencia de cuentas
  let email = '';
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    email = parsed.email.toLowerCase();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Chequear vendor activo
    const exists = await vendorExists(email);
    if (!exists) {
      console.warn('[vendor/password-reset] vendor not active or not found', { email });
      return NextResponse.json({ ok: true });
    }

    // Requiere Firebase Admin para generar el link
    if (!adminAuth) {
      console.warn('[vendor/password-reset] adminAuth not configured, skipping reset link generation');
      return NextResponse.json({ ok: true });
    }
    const AUTH = adminAuth as Auth;

    const continueUrl = `${SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ''}/vendedor/login`;
    const resetLink = await AUTH.generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: false,
    });

    // Enviar email propio si Resend está configurado
    const configured = isResendConfigured() && Boolean(resend);
    if (configured) {
      const fromEmail = getFromEmail(false);
      const fromName = `${SITE_NAME} • Portal de Vendedores`;
      const replyTo = process.env.SUPPORT_EMAIL || fromEmail;
      const text =
        `Solicitaste restablecer tu contraseña del Portal de Vendedores.\n` +
        `Usá este enlace (expira en poco tiempo): ${resetLink}\n` +
        `Si no solicitaste este cambio, ignorá este correo.`;
      try {
        console.info('[resend] vendor/password-reset send start', { to: email });
        const result: any = await resend!.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: `Restablecé tu contraseña — Portal de Vendedores | ${SITE_NAME}`,
          html: buildEmailHtml(resetLink),
          text,
          replyTo,
        });
        if (result?.error) {
          console.error('[resend] vendor/password-reset error', result.error);
        } else {
          console.info('[resend] vendor/password-reset ok', { id: result?.id, to: email });
        }
      } catch (err) {
        console.error('[resend] vendor/password-reset exception', err instanceof Error ? err.message : String(err));
      }
    } else {
      console.warn('[resend] not configured, skipping vendor/password-reset send');
    }
  } catch (e) {
    // No exponer información, responder igual
  }
  return NextResponse.json({ ok: true });
}
