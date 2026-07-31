import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { getExperienciaBySlug, getExperienciaById, toBookingPublicData } from '@/lib/experiencias';
import { getReservasCountByExperienceAndDate } from '@/lib/reservas';
import { collection, doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  slug: z.string().min(1).optional(),
  experienceId: z.string().min(1).optional(),
  date: z.string().optional(),
  people: z.number().int().min(1).max(50),
  paymentMethod: z.enum(['stripe', 'pix']).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().max(50).optional(),
  customerCountry: z.string().max(100).optional(),
  customerDocument: z.string().max(50).optional(),
  customerComments: z.string().max(500).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  referralCode: z.string().max(60).optional(),
});

const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function safeReturnUrl(input: string | undefined, fallback: string, baseUrl: string): string {
  if (!input) return fallback;
  try {
    const parsed = new URL(input);
    const base = new URL(baseUrl);
    // Evitar open-redirect: sólo permitir misma origin.
    if (parsed.origin !== base.origin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function buildSuccessUrl(params: {
  baseUrl: string;
  experienceSlug: string;
  date: string;
  people: number;
  sessionAmount: number;
  currency: string;
  paymentMethodLabel: 'pix' | 'card';
  override?: string;
}): string {
  const base = new URL(params.baseUrl);
  let url = new URL('/checkout/success', base);

  // Solo permitimos override si apunta exactamente a /checkout/success en la misma origin.
  if (params.override) {
    try {
      const candidate = new URL(params.override);
      if (candidate.origin === base.origin && candidate.pathname === '/checkout/success') {
        url = candidate;
      }
    } catch {
      // ignore
    }
  }

  url.searchParams.set('slug', params.experienceSlug);
  url.searchParams.set('date', params.date);
  url.searchParams.set('people', String(params.people));
  url.searchParams.set('sessionId', '{CHECKOUT_SESSION_ID}');
  url.searchParams.set('amount', String(params.sessionAmount));
  url.searchParams.set('currency', params.currency);
  url.searchParams.set('paymentMethod', params.paymentMethodLabel);
  return url.toString();
}

function buildCancelUrl(params: {
  baseUrl: string;
  experienceSlug: string;
  date: string;
  people: number;
  override?: string;
}): string {
  const base = new URL(params.baseUrl);
  let url = new URL('/checkout/cancel', base);

  if (params.override) {
    try {
      const candidate = new URL(params.override);
      if (candidate.origin === base.origin && candidate.pathname === '/checkout/cancel') {
        url = candidate;
      }
    } catch {
      // ignore
    }
  }

  url.searchParams.set('slug', params.experienceSlug);
  url.searchParams.set('date', params.date);
  url.searchParams.set('people', String(params.people));
  return url.toString();
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Falta configurar STRIPE_SECRET_KEY.' },
      { status: 500 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const {
    slug,
    experienceId,
    date: dateParam,
    people,
    paymentMethod = 'stripe',
    customerEmail,
    customerName,
    customerPhone,
    customerCountry,
    customerDocument,
    customerComments,
    successUrl: bodySuccessUrl,
    cancelUrl: bodyCancelUrl,
  } = parsed.data;
  const referralCode = parsed.data.referralCode?.trim() || undefined;
  const date = (dateParam?.trim() && dateParam !== 'sin-fecha') ? dateParam : 'sin-fecha';

  let experience = null;
  if (slug) {
    experience = await getExperienciaBySlug(slug);
  } else if (experienceId) {
    experience = await getExperienciaById(experienceId);
  }

  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada.' }, { status: 404 });
  }

  const bc = experience.bookingConfig;
  const maxPeople = typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : (experience.maxPeople ?? 50);
  if (people > maxPeople) {
    return NextResponse.json({ error: 'Cantidad de personas inválida.' }, { status: 400 });
  }

  if (date !== 'sin-fecha') {
    const reservedByDate = await getReservasCountByExperienceAndDate(experience.id);
    const booking = toBookingPublicData(experience, reservedByDate);
    const dateInfo = booking?.dates?.find((d) => d.date === date);
    const available = dateInfo?.available ?? 0;
    if (people > available) {
      return NextResponse.json(
        { error: 'No hay cupo suficiente para esa fecha. Actualizá la página y elegí otra fecha o menos personas.' },
        { status: 400 }
      );
    }
  }

  const unitPrice = typeof bc?.depositAmount === 'number' ? bc.depositAmount : (experience.price ?? 0);
  const isPix = paymentMethod === 'pix';
  const allowedStripe = bc?.paymentMethods?.stripe ?? true;
  const allowedPix = bc?.paymentMethods?.pix ?? false;
  if (isPix && !allowedPix) {
    return NextResponse.json({ error: 'PIX no está habilitado para esta experiencia.' }, { status: 400 });
  }
  if (!isPix && !allowedStripe) {
    return NextResponse.json({ error: 'Pago con tarjeta no está habilitado para esta experiencia.' }, { status: 400 });
  }
  let currency =
    (bc?.currency && ['ars', 'brl', 'usd'].includes(bc.currency) ? bc.currency : null) ??
    process.env.STRIPE_CURRENCY ??
    (isPix ? 'brl' : 'ars');
  if (isPix && currency !== 'brl') {
    currency = 'brl';
  }
  const unitAmount = Math.round(unitPrice * 100);
  if (unitAmount < 1) {
    return NextResponse.json({ error: 'Precio de reserva no configurado para esta experiencia.' }, { status: 400 });
  }
  console.log('[stripe-checkout] currency', currency, 'paymentMethod', paymentMethod, 'experience', experience.slug);

  const baseUrl = getSiteUrl();
  const sessionAmount = unitAmount * people;
  const successUrl = buildSuccessUrl({
    baseUrl,
    experienceSlug: experience.slug,
    date,
    people,
    sessionAmount,
    currency,
    paymentMethodLabel: isPix ? 'pix' : 'card',
    override: bodySuccessUrl,
  });

  const cancelUrl = buildCancelUrl({
    baseUrl,
    experienceSlug: experience.slug,
    date,
    people,
    override: bodyCancelUrl,
  });

  // Registrar intento de checkout para trazabilidad (sin bloquear cupos).
  const now = Timestamp.now();
  const intentRef = doc(collection(db, 'checkoutIntents'));
  const intentId = intentRef.id;
  await setDoc(intentRef, {
    status: 'created',
    experienceId: experience.id,
    experienceSlug: experience.slug,
    experienceTitle: experience.title,
    date,
    people,
    unitPrice,
    unitAmount,
    amountTotal: sessionAmount,
    currency,
    paymentMethod: isPix ? 'pix' : 'stripe',
    customerEmail: customerEmail ?? null,
    customerName: customerName ?? null,
    customerPhone: customerPhone ?? null,
    customerCountry: customerCountry ?? null,
    customerDocument: customerDocument ?? null,
    customerComments: customerComments ?? null,
    bookingConfigSnapshot: {
      currency: bc?.currency ?? null,
      depositAmount: typeof bc?.depositAmount === 'number' ? bc.depositAmount : null,
      maxPeoplePerBooking: typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : null,
      hasSpecificDates: Boolean(bc?.hasSpecificDates),
      enabled: Boolean(bc?.enabled),
      paymentMethods: bc?.paymentMethods ?? null,
    },
    returnUrls: {
      successUrl,
      cancelUrl,
    },
    referral: referralCode ? { code: referralCode } : null,
    createdAt: now,
    updatedAt: now,
  });

  const productImage = experience.cardImage ?? experience.images?.[0];
  // Intentar reutilizar un Customer existente por email; si no existe, crear uno.
  let customerId: string | undefined = undefined;
  try {
    if (customerEmail) {
      const list = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (list.data && list.data.length > 0) {
        customerId = list.data[0].id;
      } else {
        const cust = await stripe.customers.create({
          email: customerEmail,
          name: customerName ?? undefined,
          phone: customerPhone ?? undefined,
        });
        customerId = cust.id;
      }
    } else if (customerName || customerPhone) {
      const cust = await stripe.customers.create({
        name: customerName ?? undefined,
        phone: customerPhone ?? undefined,
      });
      customerId = cust.id;
    }
  } catch (err) {
    console.error('[stripe-checkout] error buscando/creando customer:', err);
    // Continuar sin customer; Checkout mostrará los campos si los requiere.
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: isPix ? ['pix'] : ['card'],
      customer: customerId ?? undefined,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: experience.title,
              description: experience.subtitle ?? undefined,
              images: productImage ? [productImage] : undefined,
            },
          },
          quantity: people,
        },
      ],
      metadata: {
        intentId,
        date,
        people: String(people),
        experienceId: experience.id,
        experienceSlug: experience.slug,
        experienceTitle: experience.title,
        paymentMethod: isPix ? 'pix' : 'stripe',
        ...(referralCode && { referralCode }),
        ...(customerEmail && { customerEmail }),
        ...(customerName && { customerName }),
        ...(customerPhone && { customerPhone }),
        ...(customerCountry && { customerCountry }),
        ...(customerDocument && { customerDocument }),
        ...(customerComments && { customerComments }),
      },
      client_reference_id: experience.id,
    });

    await updateDoc(intentRef, {
      status: 'redirected',
      stripeSessionId: session.id,
      checkoutUrl: session.url ?? null,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe-checkout]', error);
    try {
      await updateDoc(intentRef, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: Timestamp.now(),
      });
    } catch (persistError) {
      console.error('[stripe-checkout] Error guardando intent failed:', persistError);
    }
    return NextResponse.json(
      { error: 'No se pudo crear la sesión de Stripe.' },
      { status: 500 }
    );
  }
}
