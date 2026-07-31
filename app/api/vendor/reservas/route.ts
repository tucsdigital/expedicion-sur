import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getExperienciaById } from '@/lib/experiencias';
import { createReserva } from '@/lib/reservas';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { getVendorById } from '@/lib/vendors';

export const runtime = 'nodejs';

function getBaseCapacityForDate(experience: any, date: string): number {
  if (!experience || !date || date === 'sin-fecha') return 0;
  const dates = experience.bookingConfig?.dates ?? [];
  const match = dates.find((d: any) => d.date === date);
  if (match) return Math.max(0, match.capacity ?? 0);
  return 0;
}

const reservationStatusEnum = z.enum(['pending', 'reserved', 'completed', 'cancelled']);

const bodySchema = z.object({
  experienceId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerComments: z.string().max(500).optional(),
  status: reservationStatusEnum.optional(),
});

async function getVendorForUser(auth: Auth, request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token faltante');
  const decoded = await auth.verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  if (!email) throw new Error('Email no disponible en el token');
  const q = query(
    collection(db, 'vendors'),
    where('email', '==', email),
    where('active', '==', true),
    limit(1)
  );
  const snap = await getDocs(q);
  const docSnap = snap.docs[0];
  if (!docSnap) throw new Error('Vendedor no encontrado o inactivo');
  const data = docSnap.data() as any;
  return { id: docSnap.id, name: String(data.name ?? email) };
}

export async function POST(request: Request) {
  if (!adminAuth) {
    return NextResponse.json(
      {
        error:
          'Firebase Admin no está configurado. Define FIREBASE_SERVICE_ACCOUNT en .env.local con el JSON del Service Account.',
      },
      { status: 500 }
    );
  }
  const AUTH = adminAuth as Auth;

  let vendor;
  try {
    vendor = await getVendorForUser(AUTH, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const experience = await getExperienciaById(payload.experienceId);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
  }

  const vendorFull = await getVendorById(vendor.id).catch(() => null);
  if (!vendorFull || !vendorFull.active) {
    return NextResponse.json({ error: 'Vendedor no habilitado' }, { status: 403 });
  }

  try {
    const experienciaSlug = experience.slug ?? experience.id;
    const currency = (experience.bookingConfig?.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const bc = experience.bookingConfig;
    const maxPeople = typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : (experience.maxPeople ?? 50);
    if (payload.people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (payload.date !== 'sin-fecha') {
      const dateEnabled =
        bc?.hasSpecificDates !== false
          ? !!bc?.dates?.some((d) => d.enabled && d.date === payload.date)
          : true;
      if (!dateEnabled) {
        return NextResponse.json(
          { error: 'La fecha seleccionada no está habilitada para esta experiencia.' },
          { status: 400 }
        );
      }
    }

    const unitPrice =
      typeof bc?.depositAmount === 'number'
        ? bc.depositAmount
        : typeof (experience as { price?: unknown }).price === 'number'
          ? (experience as { price?: number }).price ?? 0
          : 0;
    const unitAmount = Math.round(unitPrice * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 1) {
      return NextResponse.json(
        { error: 'Esta experiencia no tiene configurado un valor de reserva válido.' },
        { status: 400 }
      );
    }
    const amountTotal = unitAmount * payload.people;

    const baseCapacity = payload.date !== 'sin-fecha' ? getBaseCapacityForDate(experience, payload.date) : 0;
    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(experience.id, payload.date, baseCapacity);
      if (payload.people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    const commissionOverride =
      experience.bookingConfig?.referralCommission
        ? {
            type: experience.bookingConfig.referralCommission.type,
            value: experience.bookingConfig.referralCommission.value,
            currency: experience.bookingConfig.referralCommission.currency,
          }
        : undefined;
    const comm = computeCommission({
      amountTotal,
      people: payload.people,
      vendor: vendorFull,
      commissionOverride,
    });
    const payoutStatus = nextPayoutStatusForReservationStatus(payload.status ?? 'reserved');
    const referredBy = {
      vendorId: vendorFull.id,
      vendorName: vendorFull.name,
      channel: 'manual' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      payoutStatus,
    };

    const reservaId = await createReserva({
      experienceId: experience.id,
      experienceSlug: experienciaSlug,
      experienceTitle: experience.title,
      date: payload.date,
      people: payload.people,
      amountTotal,
      currency,
      paymentMethod: 'admin',
      stripeSessionId: `vendor-${vendor.id}-${Date.now()}`,
      customerEmail: payload.customerEmail,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone ?? undefined,
      customerCountry: payload.customerCountry ?? undefined,
      customerDocument: payload.customerDocument ?? undefined,
      customerComments: payload.customerComments ?? undefined,
      createdByAdmin: true,
      status: payload.status ?? 'reserved',
      pricingSnapshot: {
        unitPrice,
        unitAmount,
        people: payload.people,
        amountTotal,
        currency,
        paymentMethod: 'admin',
      },
      capacitySnapshot: {
        date: payload.date,
        baseCapacity,
        maxPeoplePerBooking: typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : null,
        hasSpecificDates: Boolean(bc?.hasSpecificDates),
        enabled: Boolean(bc?.enabled),
      },
      experienceSnapshot: {
        id: experience.id,
        slug: experienciaSlug,
        title: experience.title,
      },
      referredBy,
    });

    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      await registrarMovimientoStock({
        experienceId: experience.id,
        date: payload.date,
        type: 'reserva',
        quantity: -payload.people,
        author: vendorFull.email ?? vendorFull.name ?? 'vendor',
        referenceId: reservaId,
        note: 'Reserva manual creada por vendedor',
        baseCapacityAtThatTime: baseCapacity,
        amountTotal,
        currency,
      });
    }

    return NextResponse.json({ id: reservaId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo guardar la reserva';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
