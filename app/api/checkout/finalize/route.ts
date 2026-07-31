import { NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import { getFromEmail } from '@/lib/resend';
import { getExperienciaById } from '@/lib/experiencias';
import {
  buildAdminNuevaReservaHtml,
  buildClienteReservaConfirmadaHtml,
  buildAdminNuevaReservaText,
  buildClienteReservaConfirmadaText,
} from '@/lib/emails/reserva-confirmada';
import { resolveReferralFromCode, computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';

export const runtime = 'nodejs';

const schema = z.object({
  sessionId: z.string().min(1),
});

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

async function computeEmailJobsStatus(sessionId: string) {
  const emailClienteSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_cliente`)).catch(() => null);
  const emailAdminSnap = await getDoc(doc(db, 'emailJobs', `stripe_${sessionId}_admin`)).catch(() => null);
  return {
    cliente:
      emailClienteSnap && 'exists' in emailClienteSnap && emailClienteSnap.exists()
        ? ((emailClienteSnap.data() as { status?: string }).status ?? 'unknown')
        : 'missing',
    admin:
      emailAdminSnap && 'exists' in emailAdminSnap && emailAdminSnap.exists()
        ? ((emailAdminSnap.data() as { status?: string }).status ?? 'unknown')
        : 'missing',
  };
}

type CheckoutIntentData = {
  experienceId?: string | null;
  experienceSlug?: string | null;
  experienceTitle?: string | null;
  date?: string | null;
  people?: number | null;
  unitAmount?: number | null;
  unitPrice?: number | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentMethod?: 'stripe' | 'pix' | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerCountry?: string | null;
  customerDocument?: string | null;
  customerComments?: string | null;
};

async function findCheckoutIntentBySessionId(sessionId: string): Promise<{ id: string; data: CheckoutIntentData } | null> {
  try {
    const col = collection(db, 'checkoutIntents');
    const q = query(col, where('stripeSessionId', '==', sessionId), firestoreLimit(1));
    const snap = await getDocs(q);
    const doc0 = snap.docs[0];
    if (!doc0) return null;
    return { id: doc0.id, data: doc0.data() as CheckoutIntentData };
  } catch {
    return null;
  }
}

async function ensureReservationForPaidSession(session: Stripe.Checkout.Session) {
  const intentIdFromMeta = (session.metadata?.intentId as string) || '';
  const intentFromMetaSnap = intentIdFromMeta
    ? await getDoc(doc(db, 'checkoutIntents', intentIdFromMeta)).catch(() => null)
    : null;
  const intentFromMetaData =
    intentFromMetaSnap && 'exists' in intentFromMetaSnap && intentFromMetaSnap.exists()
      ? (intentFromMetaSnap.data() as CheckoutIntentData)
      : null;

  const intentBySession = await findCheckoutIntentBySessionId(session.id);
  const intentData = intentFromMetaData ?? intentBySession?.data ?? null;
  const intentId = intentIdFromMeta || intentBySession?.id || '';

  const experienceId =
    (session.metadata?.experienceId as string | undefined) ||
    (intentData?.experienceId ?? undefined) ||
    undefined;
  const experienceSlug =
    (session.metadata?.experienceSlug as string | undefined) ||
    (intentData?.experienceSlug ?? undefined) ||
    undefined;
  const experienceTitleMeta =
    (session.metadata?.experienceTitle as string | undefined) ||
    (intentData?.experienceTitle ?? undefined) ||
    undefined;
  const date =
    ((session.metadata?.date as string | undefined) ?? intentData?.date ?? 'sin-fecha') || 'sin-fecha';
  const peopleFromMetaStr = session.metadata?.people as string | undefined;
  const peopleFromMeta = peopleFromMetaStr ? parseInt(peopleFromMetaStr, 10) : 0;
  const people = peopleFromMeta || intentData?.people || 0;
  const paymentMethodRaw =
    (session.metadata?.paymentMethod as string | undefined) ||
    (intentData?.paymentMethod ?? undefined) ||
    'stripe';
  const paymentMethod = (paymentMethodRaw === 'pix' ? 'pix' : 'stripe') as 'stripe' | 'pix';

  if (!experienceId || !experienceSlug || people < 1) return { ok: false as const };

  const exp = await getExperienciaById(experienceId);
  const experienceTitle = experienceTitleMeta ?? exp?.title ?? '';
  if (!experienceTitle) return { ok: false as const };

  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0;
  const currency = (session.currency as string) ?? 'ars';
  const baseCapacity = getBaseCapacityForDate(exp, date);

  const unitAmountFromIntent = typeof intentData?.unitAmount === 'number' ? intentData.unitAmount : null;
  const unitPriceFromIntent = typeof intentData?.unitPrice === 'number' ? intentData.unitPrice : null;
  const computedUnitAmount =
    people > 0 && amountTotal > 0 && amountTotal % people === 0 ? Math.round(amountTotal / people) : null;
  const unitAmountFinal = unitAmountFromIntent ?? computedUnitAmount ?? null;
  const unitPriceFinal = unitPriceFromIntent ?? (typeof unitAmountFinal === 'number' ? unitAmountFinal / 100 : null);

  const customerEmail =
    (session.customer_details?.email as string) ||
    (session.metadata?.customerEmail as string) ||
    (intentData?.customerEmail ?? '') ||
    '';
  const customerName =
    (session.customer_details?.name as string) ||
    (session.metadata?.customerName as string) ||
    (intentData?.customerName ?? '') ||
    '';

  const customerPhone =
    (session.metadata?.customerPhone as string | undefined) ||
    (intentData?.customerPhone ?? undefined) ||
    null;
  const customerCountry =
    (session.metadata?.customerCountry as string | undefined) ||
    (intentData?.customerCountry ?? undefined) ||
    null;
  const customerDocument =
    (session.metadata?.customerDocument as string | undefined) ||
    (intentData?.customerDocument ?? undefined) ||
    null;
  const customerComments =
    (session.metadata?.customerComments as string | undefined) ||
    (intentData?.customerComments ?? undefined) ||
    null;
  const referralCode =
    (session.metadata?.referralCode as string | undefined) ||
    (intentData && (intentData as any)?.referral?.code as string | undefined) ||
    undefined;

  const amountFormatted = formatAmount(amountTotal, currency);
  const dateFormatted = formatDate(date);
  const peopleLabel = people === 1 ? '1 persona' : `${people} personas`;
  const emailData = {
    customerName,
    experienceTitle: experienceTitle ?? SITE_NAME,
    dateFormatted,
    peopleLabel,
    amountFormatted,
    sessionId: session.id,
    customerEmail,
    customerPhone: customerPhone ?? undefined,
    customerCountry: customerCountry ?? undefined,
    customerComments: customerComments ?? undefined,
  };
  const htmlCliente = buildClienteReservaConfirmadaHtml(emailData);
  const textCliente = buildClienteReservaConfirmadaText(emailData);
  const htmlAdmin = buildAdminNuevaReservaHtml(emailData);
  const textAdmin = buildAdminNuevaReservaText(emailData);
  const from = getFromEmail(true);
  const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);

  const now = Timestamp.now();
  const reservaRef = doc(db, 'reservas', session.id);
  const stockRef = doc(db, 'stockMovimientos', `stripe_${session.id}`);
  const emailClienteRef = doc(db, 'emailJobs', `stripe_${session.id}_cliente`);
  const emailAdminRef = doc(db, 'emailJobs', `stripe_${session.id}_admin`);

  await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    const stockSnap = await tx.get(stockRef);
    const emailClienteSnap = await tx.get(emailClienteRef);
    const emailAdminSnap = await tx.get(emailAdminRef);

    if (!reservaSnap.exists()) {
      let referredBy: any = undefined;
      if (referralCode) {
        const resolved = await resolveReferralFromCode(referralCode);
        if (resolved) {
          const commissionOverride =
            exp?.bookingConfig?.referralCommission
              ? {
                  type: exp.bookingConfig.referralCommission.type,
                  value: exp.bookingConfig.referralCommission.value,
                  currency: exp.bookingConfig.referralCommission.currency,
                }
              : undefined;
          const comm = computeCommission({ amountTotal, people, vendor: resolved.vendor, commissionOverride });
          const payoutStatus = nextPayoutStatusForReservationStatus('completed');
          referredBy = {
            vendorId: resolved.vendor.id,
            vendorName: resolved.vendor.name,
            code: resolved.code,
            channel: 'link',
            commissionType: comm.type,
            commissionValue: comm.value,
            commissionCurrency: comm.currency,
            commissionAmount: comm.commissionAmount,
            payoutStatus,
          };
        }
      }
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
        // Firestore no permite `undefined`: usar null cuando no exista.
        customerPhone,
        customerCountry,
        customerDocument,
        customerComments,
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
            note: 'Pago confirmado (finalización success)',
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
        ...(referredBy ? { referredBy } : {}),
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
        note: 'Reserva Stripe (pago confirmado)',
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
        from,
        replyTo,
        subject: `Reserva confirmada: ${experienceTitle ?? SITE_NAME}`,
        html: htmlCliente,
        text: textCliente,
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
        from,
        replyTo,
        subject: `Nueva reserva: ${experienceTitle ?? 'Experiencia'} — ${customerName || customerEmail}`,
        html: htmlAdmin,
        text: textAdmin,
        attempts: 0,
        lastError: null,
        stripeSessionId: session.id,
        reservationId: session.id,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  if (intentId) {
    await updateDoc(doc(db, 'checkoutIntents', intentId), {
      stripeSessionId: session.id,
      status: 'completed',
      updatedAt: Timestamp.now(),
    }).catch(() => null);
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurado.' }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const sessionId = parsed.data.sessionId;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentStatus = session.payment_status ?? 'unknown';

    if (paymentStatus !== 'paid') {
      const emailJobs = await computeEmailJobsStatus(sessionId);
      const reservaSnap = await getDoc(doc(db, 'reservas', sessionId));
      return NextResponse.json({
        ok: true,
        sessionId,
        paymentStatus,
        reservaExists: reservaSnap.exists(),
        reservaStatus: reservaSnap.exists() ? ((reservaSnap.data() as { status?: string }).status ?? null) : null,
        emailJobs,
      });
    }

    await ensureReservationForPaidSession(session);

    const reservaSnap = await getDoc(doc(db, 'reservas', sessionId));
    const emailJobs = await computeEmailJobsStatus(sessionId);
    return NextResponse.json({
      ok: true,
      sessionId,
      paymentStatus,
      reservaExists: reservaSnap.exists(),
      reservaStatus: reservaSnap.exists() ? ((reservaSnap.data() as { status?: string }).status ?? null) : null,
      emailJobs,
    });
  } catch (err) {
    console.error('[checkout/finalize]', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'No se pudo finalizar la reserva', detail }, { status: 500 });
  }
}

