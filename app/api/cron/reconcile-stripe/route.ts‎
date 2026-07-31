import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import { getFromEmail } from '@/lib/resend';
import {
  buildAdminNuevaReservaHtml,
  buildClienteReservaConfirmadaHtml,
} from '@/lib/emails/reserva-confirmada';
import { getExperienciaById } from '@/lib/experiencias';
import {
  Timestamp,
  doc,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';

export const runtime = 'nodejs';

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function formatAmount(amountTotal: number, currency: string): string {
  const value = amountTotal / 100;
  if (currency === 'brl') return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  if (currency === 'usd') return `USD ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function formatDate(date: string): string {
  if (!date || date === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function getBaseCapacityForDate(
  experience: Awaited<ReturnType<typeof getExperienciaById>> | null,
  date: string
): number {
  if (!experience || !date || date === 'sin-fecha') return 0;
  const dates = experience.bookingConfig?.dates ?? [];
  const match = dates.find((d) => d.date === date);
  if (match) return Math.max(0, match.capacity ?? 0);
  return 0;
}

async function ensureReservationForSession(session: Stripe.Checkout.Session) {
  const experienceId = session.metadata?.experienceId as string | undefined;
  const experienceSlug = session.metadata?.experienceSlug as string | undefined;
  const experienceTitleMeta = session.metadata?.experienceTitle as string | undefined;
  const date = (session.metadata?.date as string | undefined) ?? 'sin-fecha';
  const peopleStr = session.metadata?.people as string | undefined;
  const people = peopleStr ? parseInt(peopleStr, 10) : 0;
  const paymentMethod = ((session.metadata?.paymentMethod as string) === 'pix' ? 'pix' : 'stripe') as 'stripe' | 'pix';
  const intentId = (session.metadata?.intentId as string) || '';

  if (!experienceId || !experienceSlug || people < 1) return { created: false, skipped: true };

  const exp = await getExperienciaById(experienceId);
  const experienceTitle = experienceTitleMeta ?? exp?.title ?? '';
  if (!experienceTitle) return { created: false, skipped: true };

  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0;
  const currency = (session.currency as string) ?? 'ars';
  const baseCapacity = getBaseCapacityForDate(exp, date);
  const computedUnitAmount =
    people > 0 && amountTotal > 0 && amountTotal % people === 0 ? Math.round(amountTotal / people) : null;
  const unitAmountFinal = computedUnitAmount;
  const unitPriceFinal = typeof unitAmountFinal === 'number' ? unitAmountFinal / 100 : null;

  const amountFormatted = formatAmount(amountTotal, currency);
  const dateFormatted = formatDate(date);
  const peopleLabel = people === 1 ? '1 persona' : `${people} personas`;

  const customerEmail =
    (session.customer_details?.email as string) ||
    (session.metadata?.customerEmail as string) ||
    '';
  const customerName =
    (session.customer_details?.name as string) ||
    (session.metadata?.customerName as string) ||
    '';

  const emailData = {
    customerName,
    experienceTitle: experienceTitle ?? SITE_NAME,
    dateFormatted,
    peopleLabel,
    amountFormatted,
    sessionId: session.id,
    customerEmail,
    customerPhone: (session.metadata?.customerPhone as string) || undefined,
    customerCountry: (session.metadata?.customerCountry as string) || undefined,
    customerComments: (session.metadata?.customerComments as string) || undefined,
  };

  const htmlCliente = buildClienteReservaConfirmadaHtml(emailData);
  const htmlAdmin = buildAdminNuevaReservaHtml(emailData);

  const now = Timestamp.now();
  const reservaRef = doc(db, 'reservas', session.id);
  const stockRef = doc(db, 'stockMovimientos', `stripe_${session.id}`);
  const emailClienteRef = doc(db, 'emailJobs', `stripe_${session.id}_cliente`);
  const emailAdminRef = doc(db, 'emailJobs', `stripe_${session.id}_admin`);

  const result = await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    const stockSnap = await tx.get(stockRef);
    const emailClienteSnap = await tx.get(emailClienteRef);
    const emailAdminSnap = await tx.get(emailAdminRef);

    let created = false;
    if (!reservaSnap.exists()) {
      created = true;
      tx.set(reservaRef, {
        experienceId,
        experienceSlug,
        experienceTitle,
        date,
        people,
        amountTotal,
        currency,
        paymentMethod,
        stripeSessionId: session.id,
        checkoutIntentId: intentId || null,
        customerEmail,
        customerName,
        customerPhone: (session.metadata?.customerPhone as string) || undefined,
        customerCountry: (session.metadata?.customerCountry as string) || undefined,
        customerDocument: (session.metadata?.customerDocument as string) || undefined,
        customerComments: (session.metadata?.customerComments as string) || undefined,
        status: 'completed',
        createdByAdmin: false,
        attachments: [],
        pricingSnapshot: {
          unitPrice: unitPriceFinal,
          unitAmount: unitAmountFinal,
          people,
          amountTotal,
          currency,
          paymentMethod,
        },
        capacitySnapshot: {
          date,
          baseCapacity,
          maxPeoplePerBooking: typeof exp?.bookingConfig?.maxPeoplePerBooking === 'number' ? exp.bookingConfig.maxPeoplePerBooking : null,
          hasSpecificDates: Boolean(exp?.bookingConfig?.hasSpecificDates),
          enabled: Boolean(exp?.bookingConfig?.enabled),
        },
        experienceSnapshot: {
          id: experienceId,
          slug: experienceSlug,
          title: experienceTitle,
        },
        statusHistory: [
          {
            status: 'completed',
            actor: 'system',
            note: 'Reserva confirmada (reconciliación cron)',
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!stockSnap.exists() && date && date !== 'sin-fecha') {
      tx.set(stockRef, {
        experienceId,
        date,
        type: 'reserva',
        quantity: -people,
        author: 'system',
        referenceId: session.id,
        note: 'Reserva Stripe (reconciliación)',
        baseCapacityAtThatTime: baseCapacity,
        amountTotal,
        currency,
        createdAt: now,
      });
    }

    if (!emailClienteSnap.exists() && customerEmail) {
      tx.set(emailClienteRef, {
        type: 'cliente_confirmacion',
        status: 'pending',
        to: customerEmail,
        from: getFromEmail(),
        subject: `Reserva confirmada: ${experienceTitle ?? SITE_NAME}`,
        html: htmlCliente,
        attempts: 0,
        lastError: null,
        stripeSessionId: session.id,
        reservationId: session.id,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!emailAdminSnap.exists() && CONTACT_INFO.email) {
      tx.set(emailAdminRef, {
        type: 'admin_aviso',
        status: 'pending',
        to: CONTACT_INFO.email,
        from: getFromEmail(),
        subject: `Nueva reserva: ${experienceTitle ?? 'Experiencia'} — ${customerName || customerEmail}`,
        html: htmlAdmin,
        attempts: 0,
        lastError: null,
        stripeSessionId: session.id,
        reservationId: session.id,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      created,
      hadReserva: reservaSnap.exists(),
      hadStock: stockSnap.exists(),
      hadEmailCliente: emailClienteSnap.exists(),
      hadEmailAdmin: emailAdminSnap.exists(),
    };
  });

  if (intentId) {
    await updateDoc(doc(db, 'checkoutIntents', intentId), {
      stripeSessionId: session.id,
      status: 'completed',
      updatedAt: Timestamp.now(),
    }).catch(() => null);
  }

  return result;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurado (falta STRIPE_SECRET_KEY)' }, { status: 500 });
  }

  const url = new URL(request.url);
  const minutesParam = url.searchParams.get('minutes');
  const minutes = minutesParam ? Math.max(5, Math.min(24 * 60, parseInt(minutesParam, 10))) : 180;
  const gteSeconds = Math.floor(Date.now() / 1000) - minutes * 60;

  const sessions = await stripe.checkout.sessions.list({
    limit: 100,
    created: { gte: gteSeconds },
  });

  let scanned = 0;
  let created = 0;
  let ensured = 0;
  let skipped = 0;

  for (const s of sessions.data) {
    scanned += 1;
    if (s.mode !== 'payment') {
      skipped += 1;
      continue;
    }
    if (s.payment_status !== 'paid') {
      continue;
    }
    const r = await ensureReservationForSession(s);
    if ((r as any).skipped) {
      skipped += 1;
      continue;
    }
    ensured += 1;
    if ((r as any).created) created += 1;
  }

  return NextResponse.json({
    ok: true,
    minutes,
    scanned,
    ensured,
    created,
    skipped,
  });
}
