import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';
import { adminDb } from '@/lib/firebaseAdmin';
import {
  PASSWORD_RECOVERY_COLLECTION,
  PASSWORD_RECOVERY_TTL_MINUTES,
  buildPasswordRecoveryChallenge,
  normalizeDni,
  type PasswordRecoveryRole,
} from '@/lib/auth/password-recovery';
import { generatePasswordRecoveryToken } from '@/lib/auth/password-recovery.server';

export const runtime = 'nodejs';

const schema = z.object({
  role: z.enum(['admin', 'vendor']),
  dni: z.string().min(7).max(16),
});

type RecoveryProfile = {
  role: PasswordRecoveryRole;
  referenceCollection: string;
  referenceId: string;
  email: string;
  authUid: string;
};

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

async function getAdminAuthConfig(): Promise<Record<string, any> | null> {
  try {
    if (adminDb) {
      const snap = await adminDb.collection('config').doc('adminAuth').get();
      return snap.exists ? (snap.data() as any) : null;
    }
  } catch {}
  try {
    const snap = await getDoc(doc(db, 'config', 'adminAuth'));
    return snap.exists() ? (snap.data() as any) : null;
  } catch {
    return null;
  }
}

async function findByDni(collectionName: string, normalized: string) {
  const normalizedQuery = query(
    collection(db, collectionName),
    where('normalizedDni', '==', normalized),
    firestoreLimit(1)
  );
  const normalizedSnap = await getDocs(normalizedQuery);
  if (!normalizedSnap.empty) return normalizedSnap.docs[0];

  const rawQuery = query(collection(db, collectionName), where('dni', '==', normalized), firestoreLimit(1));
  const rawSnap = await getDocs(rawQuery);
  return rawSnap.docs[0] ?? null;
}

async function resolveAdminProfile(normalized: string): Promise<RecoveryProfile | null> {
  const config = await getAdminAuthConfig();
  if (config) {
    const configuredDni = normalizeDni(config?.dni ?? config?.normalizedDni);
    if (configuredDni && configuredDni === normalized) {
      const email = String(config?.email ?? ADMIN_EMAIL ?? '').trim().toLowerCase();
      const authUid = String(config?.authUid ?? '').trim();
      if (!email && !authUid) return null;
      return {
        role: 'admin',
        referenceCollection: 'config',
        referenceId: 'adminAuth',
        email,
        authUid,
      };
    }
  }

  for (const collectionName of ['adminUsers', 'admins']) {
    const snap = await findByDni(collectionName, normalized);
    if (!snap) continue;
    const data = snap.data() as any;
    if (data?.active === false) return null;

    const email = String(data?.email ?? ADMIN_EMAIL ?? '').trim().toLowerCase();
    const authUid = String(data?.authUid ?? '').trim();
    if (!email && !authUid) return null;

    return {
      role: 'admin',
      referenceCollection: collectionName,
      referenceId: snap.id,
      email,
      authUid,
    };
  }

  return null;
}

async function resolveVendorProfile(normalized: string): Promise<RecoveryProfile | null> {
  const snap = await findByDni('vendors', normalized);
  if (!snap) return null;

  const data = snap.data() as any;
  if (!data?.active) return null;

  const email = String(data?.email ?? '').trim().toLowerCase();
  const authUid = String(data?.authUid ?? '').trim();
  if (!email && !authUid) return null;

  return {
    role: 'vendor',
    referenceCollection: 'vendors',
    referenceId: snap.id,
    email,
    authUid,
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ingresá un DNI válido.' }, { status: 400 });
  }

  const normalized = normalizeDni(parsed.data.dni);
  if (normalized.length < 7) {
    return NextResponse.json({ error: 'Ingresá un DNI válido.' }, { status: 400 });
  }

  const profile =
    parsed.data.role === 'admin'
      ? await resolveAdminProfile(normalized)
      : await resolveVendorProfile(normalized);

  if (!profile) {
    return NextResponse.json({ error: 'No pudimos validar tu identidad con ese DNI.' }, { status: 400 });
  }

  const sessionRef = doc(collection(db, PASSWORD_RECOVERY_COLLECTION));
  const tokenData = generatePasswordRecoveryToken();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + PASSWORD_RECOVERY_TTL_MINUTES * 60 * 1000));

  await setDoc(sessionRef, {
    role: profile.role,
    referenceCollection: profile.referenceCollection,
    referenceId: profile.referenceId,
    email: profile.email,
    authUid: profile.authUid,
    normalizedDni: normalized,
    tokenHash: tokenData.hash,
    createdAt: now,
    expiresAt,
    usedAt: null,
  });

  return NextResponse.json({
    ok: true,
    challengeToken: buildPasswordRecoveryChallenge(sessionRef.id, tokenData.token),
  });
}

