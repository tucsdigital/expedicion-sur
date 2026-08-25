import { NextResponse } from 'next/server';
import { Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import {
  PASSWORD_RECOVERY_COLLECTION,
  parsePasswordRecoveryChallenge,
  validatePasswordStrength,
} from '@/lib/auth/password-recovery';
import { hashPasswordRecoveryToken } from '@/lib/auth/password-recovery.server';

export const runtime = 'nodejs';

const schema = z.object({
  challengeToken: z.string().min(10),
  newPassword: z.string().min(8).max(128),
});

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);

    const allowedOrigins = new Set<string>();
    allowedOrigins.add(requestUrl.origin);

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site) {
      try {
        allowedOrigins.add(new URL(site).origin);
      } catch {}
    }

    if (allowedOrigins.has(originUrl.origin)) return true;

    if (process.env.NODE_ENV !== 'production') {
      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
      if (
        localHosts.has(originUrl.hostname) &&
        localHosts.has(requestUrl.hostname) &&
        originUrl.port === requestUrl.port
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado.' }, { status: 403 });
  }

  if (!adminAuth) {
    return NextResponse.json({ error: 'La recuperación no está disponible en este entorno.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const challenge = parsePasswordRecoveryChallenge(parsed.data.challengeToken);
  if (!challenge) {
    return NextResponse.json({ error: 'El token de recuperación no es válido.' }, { status: 400 });
  }

  const passwordError = validatePasswordStrength(parsed.data.newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const sessionRef = doc(db, PASSWORD_RECOVERY_COLLECTION, challenge.sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) {
    return NextResponse.json({ error: 'La sesión de recuperación no existe.' }, { status: 404 });
  }

  const session = sessionSnap.data() as any;
  if (session?.usedAt) {
    return NextResponse.json({ error: 'Este enlace ya fue utilizado.' }, { status: 409 });
  }

  const expiresAtMs =
    typeof session?.expiresAt?.toMillis === 'function'
      ? session.expiresAt.toMillis()
      : Date.parse(String(session?.expiresAt ?? ''));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return NextResponse.json({ error: 'La sesión de recuperación expiró.' }, { status: 410 });
  }

  const providedHash = hashPasswordRecoveryToken(challenge.secret);
  if (providedHash !== String(session?.tokenHash ?? '')) {
    return NextResponse.json({ error: 'El token de recuperación no es válido.' }, { status: 400 });
  }

  const AUTH = adminAuth as Auth;
  const authUid = String(session?.authUid ?? '').trim();
  const email = String(session?.email ?? '').trim().toLowerCase();

  let uid = authUid;
  if (!uid && email) {
    const userRecord = await AUTH.getUserByEmail(email).catch(() => null);
    uid = userRecord?.uid ?? '';
  }

  if (!uid) {
    return NextResponse.json({ error: 'No pudimos ubicar la cuenta para actualizar la contraseña.' }, { status: 404 });
  }

  await AUTH.updateUser(uid, { password: parsed.data.newPassword, disabled: false });

  if (String(session?.referenceCollection ?? '').trim() && String(session?.referenceId ?? '').trim()) {
    const sourceRef = doc(
      db,
      String(session.referenceCollection).trim(),
      String(session.referenceId).trim()
    );
    await updateDoc(sourceRef, {
      ...(session.role === 'vendor' ? { mustChangePassword: false } : {}),
      updatedAt: Timestamp.now(),
    }).catch(() => null);
  }

  await updateDoc(sessionRef, {
    usedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return NextResponse.json({ ok: true });
}

