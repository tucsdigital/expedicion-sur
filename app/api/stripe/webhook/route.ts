import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getFromEmail } from '@/lib/resend';
import { getExperienciaById } from '@/lib/experiencias';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import {
  buildClienteReservaConfirmadaHtml,
  buildClienteReservaConfirmadaText,
  buildAdminNuevaReservaHtml,
  buildAdminNuevaReservaText,
} from '@/lib/emails/reserva-confirmada';
import { db } from '@/lib/firebase';
import { resolveReferralFromCode, computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  arrayUnion,
  limit as firestoreLimit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

async function recordStripeEvent(params: {
  eventId: string;
  type: string;
  livemode: boolean;
  created: number;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  reason?: string | null;
  reservationId?: string | null;
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  checkoutIntentId?: string | null;
  error?: string | null;
}) {
  try {
    await setDoc(
      doc(db, 'stripeEvents', params.eventId),
      {
        ...params,
        processedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch {
    // no-op
  }
}

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    console.error('[stripe-webhook] Falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: 'Webhook no configurado.' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Falta firma.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida';
    console.error('[stripe-webhook]', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const keyIsLive = key.startsWith('sk_live_');
  const keyIsTest = key.startsWith('sk_test_');
  const expectedLivemode = keyIsLive ? true : keyIsTest ? false : event.livemode;
  if (event.livemode !== expectedLivemode) {
    await recordStripeEvent({
      eventId: event.id,
      type: event.type,
      livemode: Boolean(event.livemode),
      created: event.created,
      status: 'ignored',
      reason: 'livemode_mismatch',
    });
    console.error('[stripe-webhook] livemode mismatch', {
      eventLivemode: event.livemode,
      expectedLivemode,
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json({ received: true });
  }

  await recordStripeEvent({
    eventId: event.id,
    type: event.type,
    livemode: Boolean(event.livemode),
    created: event.created,
    status: 'received',
  });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail =
      (session.customer_details?.email as string) ||
      (session.metadata?.customerEmail as string);
    const customerName =
      (session.customer_details?.name as string) ||
      (session.metadata?.customerName as string);
    const intentIdFromMeta = (session.metadata?.intentId as string) || '';

    const intentFromMetaSnap = intentIdFromMeta
      ? await getDoc(doc(db, 'checkoutIntents', intentIdFromMeta)).catch(() => null)
      : null;
    const intentFromMetaData =
      intentFromMetaSnap && 'exists' in intentFromMetaSnap && intentFromMetaSnap.exists()
        ? (intentFromMetaSnap.data() as any)
        : null;

    const intentBySession = await (async () => {
      try {
        const col = collection(db, 'checkoutIntents');
        const q = query(col, where('stripeSessionId', '==', session.id), firestoreLimit(1));
        const snap = await getDocs(q);
        const d0 = snap.docs[0];
        if (!d0) return null;
        return { id: d0.id, data: d0.data() as any };
      } catch {
        return null;
      }
    })();

    const intentData = intentFromMetaData ?? intentBySession?.data ?? null;
    const intentId = intentIdFromMeta || intentBySession?.id || '';

    const date = ((session.metadata?.date as string | undefined) ?? intentData?.date ?? 'sin-fecha') || 'sin-fecha';
    const peopleStr = session.metadata?.people as string | undefined;
    const peopleFromMeta = peopleStr ? parseInt(peopleStr, 10) : 0;
    const people = peopleFromMeta || intentData?.people || 0;
    const experienceSlug = (session.metadata?.experienceSlug as string | undefined) || intentData?.experienceSlug || '';
    const experienceId = (session.metadata?.experienceId as string | undefined) || intentData?.experienceId || '';

    const exp = experienceId ? await getExperienciaById(experienceId) : null;
    const experienceTitle =
      (session.metadata?.experienceTitle as string | undefined) ??
      intentData?.experienceTitle ??
      exp?.title ??
      '';

    const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0;
    const currency = (session.currency as string) ?? 'ars';
    const paymentMethodRaw =
      (session.metadata?.paymentMethod as string | undefined) ||
      (intentData?.paymentMethod as string | undefined) ||
      'stripe';
    const paymentMethod = (paymentMethodRaw === 'pix' ? 'pix' : 'stripe') as 'stripe' | 'pix';
    const baseCapacity = getBaseCapacityForDate(exp, date);

    // Si existe intent, lo usamos para snapshot de pricing.
    const unitAmountFromIntent = typeof intentData?.unitAmount === 'number' ? intentData.unitAmount : null;
    const unitPriceFromIntent = typeof intentData?.unitPrice === 'number' ? intentData.unitPrice : null;
    const computedUnitAmount =
      people > 0 && amountTotal > 0 && amountTotal % people === 0 ? Math.round(amountTotal / people) : null;
    const unitAmountFinal = unitAmountFromIntent ?? computedUnitAmount ?? null;
    const unitPriceFinal =
      unitPriceFromIntent ?? (typeof unitAmountFinal === 'number' ? unitAmountFinal / 100 : null);

    const amountFormatted = formatAmount(amountTotal, currency);
    const dateFormatted = formatDate(date);
    const peopleLabel = people === 1 ? '1 persona' : `${people} personas`;
    const customerPhone =
      (session.metadata?.customerPhone as string | undefined) ||
      (intentData?.customerPhone as string | undefined) ||
      undefined;
    const customerCountry =
      (session.metadata?.customerCountry as string | undefined) ||
      (intentData?.customerCountry as string | undefined) ||
      undefined;
    const customerComments =
      (session.metadata?.customerComments as string | undefined) ||
      (intentData?.customerComments as string | undefined) ||
      undefined;

    const emailData = {
      customerName: customerName ?? '',
      experienceTitle: experienceTitle ?? SITE_NAME,
      dateFormatted,
      peopleLabel,
      amountFormatted,
      sessionId: session.id,
      customerEmail: customerEmail ?? '',
      customerPhone,
      customerCountry,
      customerComments,
    };
    const htmlCliente = buildClienteReservaConfirmadaHtml(emailData);
    const textCliente = buildClienteReservaConfirmadaText(emailData);
    const htmlAdmin = buildAdminNuevaReservaHtml(emailData);
    const textAdmin = buildAdminNuevaReservaText(emailData);
    const from = getFromEmail(true);
    const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);

    let createdNow = false;
    try {
      if (experienceId && experienceSlug && experienceTitle && people >= 1) {
        const now = Timestamp.now();
        const reservaRef = doc(db, 'reservas', session.id);
        const stockRef = doc(db, 'stockMovimientos', `stripe_${session.id}`);
        const emailClienteRef = doc(db, 'emailJobs', `stripe_${session.id}_cliente`);
        const emailAdminRef = doc(db, 'emailJobs', `stripe_${session.id}_admin`);

        const txResult = await runTransaction(db, async (tx) => {
          const reservaSnap = await tx.get(reservaRef);
          const stockSnap = await tx.get(stockRef);
          const emailClienteSnap = await tx.get(emailClienteRef);
          const emailAdminSnap = await tx.get(emailAdminRef);

          const isPaid = (session.payment_status ?? 'unpaid') === 'paid';
          const isPixPending = paymentMethod === 'pix' && !isPaid;

          if (!reservaSnap.exists()) {
            let referredBy: any = undefined;
            const referralCode =
              (session.metadata?.referralCode as string | undefined) ||
              (intentData && (intentData as any)?.referral?.code as string | undefined) ||
              undefined;
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
            createdNow = true;
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
              customerEmail: customerEmail ?? '',
              customerName: customerName ?? '',
              // Firestore no permite `undefined`: usar null cuando no exista.
              customerPhone: (customerPhone ?? null),
              customerCountry: (customerCountry ?? null),
              customerDocument: ((session.metadata?.customerDocument as string | undefined) || (intentData?.customerDocument as string | undefined) || null),
              customerComments: (customerComments ?? null),
              status: isPixPending ? 'pending' : 'completed',
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
                  status: isPixPending ? 'pending' : 'completed',
                  actor: 'system',
                  note: isPixPending ? 'Checkout completado (PIX pendiente de acreditación)' : 'Pago confirmado por Stripe',
                  createdAt: now,
                },
              ],
              createdAt: now,
              updatedAt: now,
              ...(referredBy ? { referredBy } : {}),
            });
          } else if (isPixPending) {
            // Si ya existía y es PIX pendiente, aseguramos estado 'pending' sin tocar emails/stock.
            tx.update(reservaRef, {
              status: 'pending',
              updatedAt: now,
              statusHistory: arrayUnion({
                status: 'pending',
                actor: 'system',
                note: 'Checkout completado (PIX pendiente de acreditación)',
                createdAt: now,
              }),
            } as any);
          }

          // Movimiento stock idempotente (solo si hay fecha y pago acreditado).
          if (!stockSnap.exists() && date && date !== 'sin-fecha' && !isPixPending) {
            tx.set(stockRef, {
              experienceId,
              date,
              type: 'reserva',
              quantity: -people,
              author: 'system',
              referenceId: session.id,
              note: 'Reserva Stripe (pago confirmado)',
              baseCapacityAtThatTime: baseCapacity,
              createdAt: now,
            });
          }

          // Encolar emails solo si el pago ya está acreditado.
          if (!emailClienteSnap.exists() && customerEmail && !isPixPending) {
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
          if (!emailAdminSnap.exists() && CONTACT_INFO.email && !isPixPending) {
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

          return {
            hadReserva: reservaSnap.exists(),
            hadStock: stockSnap.exists(),
            hadEmailCliente: emailClienteSnap.exists(),
            hadEmailAdmin: emailAdminSnap.exists(),
          };
        });

        console.log('[stripe-webhook] upsert ok', {
          sessionId: session.id,
          createdNow,
          hadReserva: txResult.hadReserva,
          hadStock: txResult.hadStock,
          hadEmailCliente: txResult.hadEmailCliente,
          hadEmailAdmin: txResult.hadEmailAdmin,
        });

        await recordStripeEvent({
          eventId: event.id,
          type: event.type,
          livemode: Boolean(event.livemode),
          created: event.created,
          status: 'processed',
          reservationId: session.id,
          stripeSessionId: session.id,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          checkoutIntentId: intentId || null,
        });
      }
    } catch (err) {
      console.error('[stripe-webhook] Error guardando reserva/stock (tx):', err);
      await recordStripeEvent({
        eventId: event.id,
        type: event.type,
        livemode: Boolean(event.livemode),
        created: event.created,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        reservationId: session.id,
        stripeSessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        checkoutIntentId: intentId || null,
      });
    }

    // Actualizar intent si existe.
    if (intentId) {
      try {
        const isPaid = (session.payment_status ?? 'unpaid') === 'paid';
        await updateDoc(doc(db, 'checkoutIntents', intentId), {
          status: isPaid ? 'completed' : 'pending',
          stripeSessionId: session.id,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('[stripe-webhook] Error actualizando checkoutIntent:', err);
      }
    }
  } else if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const intentId = (session.metadata?.intentId as string) || '';
    if (intentId) {
      try {
        await updateDoc(doc(db, 'checkoutIntents', intentId), {
          status: 'expired',
          stripeSessionId: session.id,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('[stripe-webhook] Error actualizando checkoutIntent (expired):', err);
      }
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const intentId = (session.metadata?.intentId as string) || '';
    if (intentId) {
      try {
        await updateDoc(doc(db, 'checkoutIntents', intentId), {
          status: 'failed',
          stripeSessionId: session.id,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('[stripe-webhook] Error actualizando checkoutIntent (failed):', err);
      }
    }
  } else if (event.type === 'payment_intent.succeeded') {
    // Manejar PaymentIntent (por ejemplo: Pix flow personalizado)
    const pi = event.data.object as Stripe.PaymentIntent;
    const metadata = pi.metadata ?? {};
    const intentIdFromMeta = metadata.intentId || '';
    const intentFromMetaSnap = intentIdFromMeta
      ? await getDoc(doc(db, 'checkoutIntents', String(intentIdFromMeta))).catch(() => null)
      : null;
    const intentFromMetaData =
      intentFromMetaSnap && 'exists' in intentFromMetaSnap && intentFromMetaSnap.exists()
        ? (intentFromMetaSnap.data() as any)
        : null;
    const intentByPi = intentFromMetaData
      ? null
      : await (async () => {
          try {
            const col = collection(db, 'checkoutIntents');
            const q = query(col, where('paymentIntentId', '==', pi.id), firestoreLimit(1));
            const snap = await getDocs(q);
            const d0 = snap.docs[0];
            if (!d0) return null;
            return { id: d0.id, data: d0.data() as any };
          } catch {
            return null;
          }
        })();

    const intentRefId = intentIdFromMeta || intentByPi?.id || '';
    const intentData = intentFromMetaData ?? intentByPi?.data ?? null;
    const stripeSessionIdFromIntent =
      (typeof intentData?.stripeSessionId === 'string' && intentData.stripeSessionId) ||
      (typeof metadata.stripeSessionId === 'string' && metadata.stripeSessionId) ||
      '';
    const reservationId = stripeSessionIdFromIntent || pi.id;

    const experienceId = (metadata.experienceId as string | undefined) || (intentData?.experienceId ?? undefined) || '';
    const experienceSlug = (metadata.experienceSlug as string | undefined) || (intentData?.experienceSlug ?? undefined) || '';
    const experienceTitleMeta = (metadata.experienceTitle as string | undefined) || (intentData?.experienceTitle ?? undefined) || undefined;
    const date = ((metadata.date as string | undefined) ?? intentData?.date ?? 'sin-fecha') || 'sin-fecha';
    const peopleFromMeta = metadata.people ? parseInt(metadata.people, 10) : (intentData?.people ?? 0);
    const people = peopleFromMeta || 0;

    const exp = experienceId ? await getExperienciaById(experienceId) : null;
    const experienceTitle = experienceTitleMeta ?? exp?.title ?? '';

    const amountTotal = typeof pi.amount === 'number' ? pi.amount : 0;
    const currency = (pi.currency as string) ?? 'ars';
    const paymentMethod = 'pix';
    const baseCapacity = getBaseCapacityForDate(exp, date);

    // Crear reserva análoga al checkout.session.completed
    try {
      if (experienceId && experienceSlug && experienceTitle && people >= 1) {
        const now = Timestamp.now();
        const reservaRef = doc(db, 'reservas', reservationId);
        const stockRef = doc(db, 'stockMovimientos', `stripe_${reservationId}`);
        const emailClienteRef = doc(db, 'emailJobs', `stripe_${reservationId}_cliente`);
        const emailAdminRef = doc(db, 'emailJobs', `stripe_${reservationId}_admin`);
        const from = getFromEmail(true);
        const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);

        const txResult = await runTransaction(db, async (tx) => {
          const reservaSnap = await tx.get(reservaRef);
          const stockSnap = await tx.get(stockRef);
          const emailClienteSnap = await tx.get(emailClienteRef);
          const emailAdminSnap = await tx.get(emailAdminRef);

          if (!reservaSnap.exists()) {
            let referredBy: any = undefined;
            const referralCode =
              (metadata.referralCode as string | undefined) ||
              (intentData && (intentData as any)?.referral?.code as string | undefined) ||
              undefined;
            if (referralCode) {
              const resolved = await resolveReferralFromCode(referralCode);
              if (resolved) {
                const commissionOverride2 =
                  exp?.bookingConfig?.referralCommission
                    ? {
                        type: exp.bookingConfig.referralCommission.type,
                        value: exp.bookingConfig.referralCommission.value,
                        currency: exp.bookingConfig.referralCommission.currency,
                      }
                    : undefined;
                const comm = computeCommission({ amountTotal, people, vendor: resolved.vendor, commissionOverride: commissionOverride2 });
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
              stripeSessionId: reservationId,
              checkoutIntentId: intentRefId || null,
              customerEmail: (metadata.customerEmail as string) || (intentData?.customerEmail ?? '') || '',
              customerName: (metadata.customerName as string) || (intentData?.customerName ?? '') || '',
              customerPhone: (metadata.customerPhone as string) || (intentData?.customerPhone ?? null) || null,
              customerCountry: (metadata.customerCountry as string) || (intentData?.customerCountry ?? null) || null,
              customerDocument: (metadata.customerDocument as string) || (intentData?.customerDocument ?? null) || null,
              customerComments: (metadata.customerComments as string) || (intentData?.customerComments ?? null) || null,
              status: 'completed',
              createdByAdmin: false,
              attachments: [],
              pricingSnapshot: {
                unitPrice: intentData?.unitPrice ?? null,
                unitAmount: intentData?.unitAmount ?? null,
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
                  note: 'Pago confirmado por Stripe (PIX)',
                  createdAt: now,
                },
              ],
              createdAt: now,
              updatedAt: now,
              ...(referredBy ? { referredBy } : {}),
            });
          } else {
            // Si ya existía (p. ej., creada como 'pending' en checkout.session.completed), actualizar a 'completed'
            tx.update(reservaRef, {
              status: 'completed',
              updatedAt: now,
              statusHistory: arrayUnion({
                status: 'completed',
                actor: 'system',
                note: 'Pago acreditado (PIX)',
                createdAt: now,
              }),
            } as any);
          }

          if (!stockSnap.exists() && date && date !== 'sin-fecha') {
            tx.set(stockRef, {
              experienceId,
              date,
              type: 'reserva',
              quantity: -people,
              author: 'system',
              referenceId: pi.id,
              note: 'Reserva Stripe (PIX)',
              baseCapacityAtThatTime: baseCapacity,
              createdAt: now,
            });
          }

          if (!emailClienteSnap.exists() && ((metadata.customerEmail as string) || (intentData?.customerEmail ?? null))) {
            const customerEmail = (metadata.customerEmail as string) || (intentData?.customerEmail ?? '');
            const customerName = (metadata.customerName as string) || (intentData?.customerName ?? '');
            const emailData = {
              customerName: customerName ?? '',
              experienceTitle: experienceTitle ?? SITE_NAME,
              dateFormatted: formatDate(date),
              peopleLabel: people === 1 ? '1 persona' : `${people} personas`,
              amountFormatted: formatAmount(amountTotal, currency),
              sessionId: reservationId,
              customerEmail: customerEmail ?? '',
              customerPhone: (metadata.customerPhone as string) || (intentData?.customerPhone ?? undefined),
              customerCountry: (metadata.customerCountry as string) || (intentData?.customerCountry ?? undefined),
              customerComments: (metadata.customerComments as string) || (intentData?.customerComments ?? undefined),
            };
            const htmlCliente = buildClienteReservaConfirmadaHtml(emailData);
            const textCliente = buildClienteReservaConfirmadaText(emailData);
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
              stripeSessionId: reservationId,
              reservationId: reservationId,
              nextAttemptAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }
          if (!emailAdminSnap.exists() && CONTACT_INFO.email) {
            const emailDataAdmin = {
              customerName: (metadata.customerName as string) ?? (intentData?.customerName ?? ''),
              experienceTitle: experienceTitle ?? SITE_NAME,
              dateFormatted: formatDate(date),
              peopleLabel: people === 1 ? '1 persona' : `${people} personas`,
              amountFormatted: formatAmount(amountTotal, currency),
              sessionId: reservationId,
              customerEmail: (metadata.customerEmail as string) ?? (intentData?.customerEmail ?? ''),
              customerPhone: (metadata.customerPhone as string) || (intentData?.customerPhone ?? undefined),
              customerCountry: (metadata.customerCountry as string) || (intentData?.customerCountry ?? undefined),
              customerComments: (metadata.customerComments as string) || (intentData?.customerComments ?? undefined),
            };
            const htmlAdmin = buildAdminNuevaReservaHtml(emailDataAdmin);
            const textAdmin = buildAdminNuevaReservaText(emailDataAdmin);
            tx.set(emailAdminRef, {
              type: 'admin_aviso',
              status: 'pending',
              to: CONTACT_INFO.email,
              from,
              replyTo,
              subject: `Nueva reserva: ${experienceTitle ?? 'Experiencia'} — ${(metadata.customerName as string) || (intentData?.customerName ?? '') || (metadata.customerEmail as string) || (intentData?.customerEmail ?? '')}`,
              html: htmlAdmin,
              text: textAdmin,
              attempts: 0,
              lastError: null,
              stripeSessionId: reservationId,
              reservationId: reservationId,
              nextAttemptAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          return {
            hadReserva: reservaSnap.exists(),
            hadStock: stockSnap.exists(),
            hadEmailCliente: emailClienteSnap.exists(),
            hadEmailAdmin: emailAdminSnap.exists(),
          };
        });

        console.log('[stripe-webhook] payment_intent.succeeded upsert ok', { paymentIntentId: pi.id, createdNow: txResult.hadReserva === false });

        await recordStripeEvent({
          eventId: event.id,
          type: event.type,
          livemode: Boolean(event.livemode),
          created: event.created,
          status: 'processed',
          reservationId,
          stripeSessionId: stripeSessionIdFromIntent || null,
          paymentIntentId: pi.id,
          checkoutIntentId: intentRefId || null,
        });
      }
    } catch (err) {
      console.error('[stripe-webhook] Error guardando reserva/stock (pi tx):', err);
      await recordStripeEvent({
        eventId: event.id,
        type: event.type,
        livemode: Boolean(event.livemode),
        created: event.created,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        reservationId,
        stripeSessionId: stripeSessionIdFromIntent || null,
        paymentIntentId: pi.id,
        checkoutIntentId: intentRefId || null,
      });
    }

    // Actualizar intent si existe.
    if (intentRefId) {
      try {
        await updateDoc(doc(db, 'checkoutIntents', intentRefId), {
          status: 'completed',
          paymentIntentId: pi.id,
          ...(stripeSessionIdFromIntent ? { stripeSessionId: stripeSessionIdFromIntent } : {}),
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('[stripe-webhook] Error actualizando checkoutIntent (pi):', err);
      }
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    // Marcar intent como failed si encontramos un checkoutIntent asociado.
    const metadata = pi.metadata ?? {};
    const intentIdFromMeta = metadata.intentId || '';
    const intentFromMetaSnap = intentIdFromMeta
      ? await getDoc(doc(db, 'checkoutIntents', String(intentIdFromMeta))).catch(() => null)
      : null;
    const intentFromMetaData =
      intentFromMetaSnap && 'exists' in intentFromMetaSnap && intentFromMetaSnap.exists()
        ? (intentFromMetaSnap.data() as any)
        : null;
    const intentByPi = intentFromMetaData
      ? null
      : await (async () => {
          try {
            const col = collection(db, 'checkoutIntents');
            const q = query(col, where('paymentIntentId', '==', pi.id), firestoreLimit(1));
            const snap = await getDocs(q);
            const d0 = snap.docs[0];
            if (!d0) return null;
            return { id: d0.id, data: d0.data() as any };
          } catch {
            return null;
          }
        })();
    const intentRefId = intentIdFromMeta || (intentByPi && intentByPi.id) || '';
    if (intentRefId) {
      try {
        await updateDoc(doc(db, 'checkoutIntents', intentRefId), {
          status: 'failed',
          paymentIntentId: pi.id,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('[stripe-webhook] Error actualizando checkoutIntent (pi failed):', err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
