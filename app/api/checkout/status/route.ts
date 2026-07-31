import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({ sessionId: url.searchParams.get('sessionId') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
  }

  const sessionId = parsed.data.sessionId;

  try {
    const reservaSnap = await getDoc(doc(db, 'reservas', sessionId));
    const reservaExists = reservaSnap.exists();
    const reservaStatus = reservaExists ? (reservaSnap.data() as { status?: string }).status ?? null : null;

    const emailClienteSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_cliente`)).catch(() => null);
    const emailAdminSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_admin`)).catch(() => null);
    const emailJobs = {
      cliente:
        emailClienteSnap && 'exists' in emailClienteSnap && emailClienteSnap.exists()
          ? ((emailClienteSnap.data() as { status?: string }).status ?? 'unknown')
          : 'missing',
      admin:
        emailAdminSnap && 'exists' in emailAdminSnap && emailAdminSnap.exists()
          ? ((emailAdminSnap.data() as { status?: string }).status ?? 'unknown')
          : 'missing',
    };

    // Importante: este endpoint NO llama a Stripe (evita rate-limit y logs en loop).
    return NextResponse.json({
      ok: true,
      sessionId,
      paymentStatus: 'unknown',
      reservaExists,
      reservaStatus,
      emailJobs,
      source: 'firestore',
    });
  } catch (err) {
    console.error('[checkout/status]', err);
    return NextResponse.json({ error: 'No se pudo leer el estado' }, { status: 500 });
  }
}

