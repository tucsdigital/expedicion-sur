import { NextResponse } from 'next/server';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { requireAdminToken } from '@/lib/adminAuth';
import { ADMIN_EMAIL } from '@/lib/constants';
import { normalizeDni } from '@/lib/auth/password-recovery';

export const runtime = 'nodejs';

const schema = z.object({
  dni: z.string().min(7).max(16),
});

function buildPayload(existing: any, input: { email: string; authUid: string; dni: string }) {
  return {
    ...existing,
    email: input.email,
    authUid: input.authUid,
    dni: input.dni,
    normalizedDni: normalizeDni(input.dni),
    updatedAt: Timestamp.now(),
  };
}

export async function GET(request: Request) {
  try {
    const adminUser = await requireAdminToken(request);
    const ref = doc(db, 'config', 'adminAuth');
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() as any) : null;

    return NextResponse.json({
      ok: true,
      email: String(data?.email ?? adminUser.email ?? ADMIN_EMAIL ?? '').trim().toLowerCase(),
      dni: String(data?.dni ?? '').trim(),
      normalizedDni: String(data?.normalizedDni ?? '').trim(),
      authUid: String(data?.authUid ?? adminUser.localId ?? '').trim(),
    });
  } catch {
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  let adminUser: any;
  try {
    adminUser = await requireAdminToken(request);
  } catch {
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ingresá un DNI válido.' }, { status: 400 });
  }

  const dni = normalizeDni(parsed.data.dni);
  if (dni.length < 7) {
    return NextResponse.json({ error: 'Ingresá un DNI válido.' }, { status: 400 });
  }

  const ref = doc(db, 'config', 'adminAuth');
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as any) : {};

  await setDoc(
    ref,
    {
      ...buildPayload(existing, {
        email: String(adminUser.email ?? ADMIN_EMAIL ?? '').trim().toLowerCase(),
        authUid: String(adminUser.localId ?? '').trim(),
        dni,
      }),
      createdAt: existing?.createdAt ?? Timestamp.now(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, dni });
}
