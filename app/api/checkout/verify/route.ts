import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurado.' }, { status: 500 });
  }

  const url = new URL(request.url);
  const parsed = schema.safeParse({ sessionId: url.searchParams.get('sessionId') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
  }

  const sessionId = parsed.data.sessionId;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentStatus = session.payment_status ?? 'unknown';

    const reservaSnap = await getDoc(doc(db, 'reservas', sessionId));
    const reservaExists = reservaSnap.exists();
    const reservaStatus = reservaExists ? (reservaSnap.data() as { status?: string }).status ?? null : null;

    const emailClienteSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_cliente`)).catch(() => null);
    const emailAdminSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_admin`)).catch(() => null);
    const emailJobs = {
      cliente: emailClienteSnap && 'exists' in emailClienteSnap && emailClienteSnap.exists()
        ? ((emailClienteSnap.data() as { status?: string }).status ?? 'unknown')
        : 'missing',
      admin: emailAdminSnap && 'exists' in emailAdminSnap && emailAdminSnap.exists()
        ? ((emailAdminSnap.data() as { status?: string }).status ?? 'unknown')
        : 'missing',
    };

    return NextResponse.json({
      ok: true,
      sessionId,
      paymentStatus,
      reservaExists,
      reservaStatus,
      emailJobs,
    });
  } catch (err) {
    console.error('[checkout/verify]', err);
    return NextResponse.json({ error: 'No se pudo verificar la sesión' }, { status: 500 });
  }
}

