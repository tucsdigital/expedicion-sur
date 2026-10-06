import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { collection, doc, getDoc, getDocs, limit, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getPaqueteById } from '@/lib/paquetes';
import { createReserva } from '@/lib/reservas';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { getVendorById } from '@/lib/vendors';
import type { SeatLayoutTemplate } from '@/types';
import {
  computeReservationPricing,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
} from '@/lib/packages/resolve-departure';

export const runtime = 'nodejs';

const reservationStatusEnum = z.enum(['pending', 'reserved', 'completed', 'cancelled']);

const travelerSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  age: z.number().int().min(0).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(40),
  document: z.string().min(3).max(40),
  travelerType: z.enum(['adult', 'minor']).nullable().optional(),
});

const manualExtraSchema = z.object({
  title: z.string().min(1).max(120),
  price: z.number().min(0).max(999999999),
  scope: z.enum(['per_booking', 'per_person']).optional(),
});

const bodySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerComments: z.string().max(500).optional(),
  passengerDetails: z.array(travelerSchema).max(49).optional(),
  selectedExtraCodes: z.array(z.enum(['cocheCama', 'panoramicos', 'cafeteras'])).max(10).optional(),
  addonIds: z.array(z.string().min(1).max(80)).max(20).optional(),
  manualExtras: z.array(manualExtraSchema).max(20).optional(),
  status: reservationStatusEnum.optional(),
}).superRefine((data, ctx) => {
  const additionalTravelers = Math.max(0, data.people - 1);
  const passengerCount = Array.isArray(data.passengerDetails) ? data.passengerDetails.length : 0;
  if (passengerCount !== additionalTravelers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['passengerDetails'],
      message: 'La cantidad de pasajeros no coincide con la reserva.',
    });
  }
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

  const paquete = await getPaqueteById(payload.packageId);
  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

    const vendorFull = await getVendorById(vendor.id).catch(() => null);
  if (!vendorFull || !vendorFull.active) {
    return NextResponse.json({ error: 'Vendedor no habilitado' }, { status: 403 });
  }
    const allowedPackages = vendorFull.allowedPackages ?? vendorFull.allowedExperiences ?? null;
    if (Array.isArray(allowedPackages) && allowedPackages.length > 0 && !allowedPackages.includes(payload.packageId)) {
      return NextResponse.json({ error: 'No tenés permiso para este paquete.' }, { status: 403 });
    }

  try {
    const packageSlug = paquete.slug ?? paquete.id;
    const bc = paquete.bookingConfig;
    const departureConfig = resolveDepartureConfig(paquete, payload.date);
    const maxPeople = departureConfig.maxPeople;
    if (payload.people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (payload.date !== 'sin-fecha') {
      if (!departureConfig.exists || !departureConfig.enabled) {
        return NextResponse.json(
          { error: 'La fecha seleccionada no está habilitada para este paquete.' },
          { status: 400 }
        );
      }
    }

    const selectedExtraCodes = Array.isArray(payload.selectedExtraCodes)
      ? Array.from(new Set(payload.selectedExtraCodes.map((code) => String(code).trim()).filter(Boolean)))
      : [];
    let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
    if (departureConfig.seatLayoutId && selectedExtraCodes.length > 0) {
      const templateSnap = await getDoc(doc(db, 'seatLayouts', departureConfig.seatLayoutId));
      if (!templateSnap.exists()) {
        return NextResponse.json({ error: 'Plantilla de micro no encontrada.' }, { status: 400 });
      }
      seatLayoutTemplateForExtras = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
    }
    const selectedExtras = resolveReservationExtraSelections({
      paquete,
      selectedExtraCodes,
      addonIds: Array.isArray((payload as any).addonIds)
        ? (payload as any).addonIds.map((id: unknown) => String(id ?? '').trim()).filter(Boolean)
        : [],
      manualExtras: Array.isArray((payload as any).manualExtras)
        ? (payload as any).manualExtras.map((extra: any) => ({
            label: String(extra?.title ?? '').trim(),
            amount: Math.max(0, Number(extra?.price ?? 0) || 0),
            perPerson: String(extra?.scope ?? 'per_booking') === 'per_person',
          }))
        : [],
      seatLayoutTemplate: seatLayoutTemplateForExtras,
    });
    const repriced = computeReservationPricing(paquete, payload.date, {
      people: payload.people,
      selectedExtras,
    });
    const currency = (repriced.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const unitAmount = repriced.unitAmount;
    if (!Number.isFinite(unitAmount) || unitAmount < 1 || repriced.subtotalAmount < 1) {
      return NextResponse.json(
        { error: 'Esta experiencia no tiene configurado un valor de reserva válido.' },
        { status: 400 }
      );
    }
    const amountTotal = repriced.subtotalAmount;

    const baseCapacity = payload.date !== 'sin-fecha' ? departureConfig.baseCapacity : 0;
    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(paquete.id, payload.date, baseCapacity);
      if (payload.people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    const commissionOverride =
      paquete.bookingConfig?.referralCommission
        ? {
            type: paquete.bookingConfig.referralCommission.type,
            value: paquete.bookingConfig.referralCommission.value,
            currency: paquete.bookingConfig.referralCommission.currency,
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
      packageId: paquete.id,
      packageSlug: packageSlug,
      packageTitle: paquete.titulo,
      // Legacy compatibility
      experienceId: paquete.id,
      experienceSlug: packageSlug,
      experienceTitle: paquete.titulo,
      date: payload.date,
      people: payload.people,
      amountTotal,
      currency,
      paymentMethod: 'admin',
      customerEmail: payload.customerEmail,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone ?? undefined,
      customerCountry: payload.customerCountry ?? undefined,
      customerDocument: payload.customerDocument ?? undefined,
      customerComments: payload.customerComments ?? undefined,
      createdByAdmin: true,
      status: payload.status ?? 'reserved',
      pricingSnapshot: buildReservationPricingSnapshot({
        unitAmount: amountTotal > 0 && payload.people > 0 ? Math.round(amountTotal / payload.people) : unitAmount,
        people: payload.people,
        amountTotal,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        extrasTotalAmount: repriced.extrasTotalAmount,
        currency,
        paymentMethod: 'admin',
      }),
      capacitySnapshot: {
        date: payload.date,
        baseCapacity,
        maxPeoplePerBooking: maxPeople,
        hasSpecificDates: Boolean(bc?.hasSpecificDates),
        enabled: departureConfig.enabled,
      },
      experienceSnapshot: {
        id: paquete.id,
        slug: packageSlug,
        title: paquete.titulo,
      },
      selectedExtras: selectedExtras.length ? (selectedExtras as any) : null,
      customerBirthDate: payload.customerBirthDate,
      passengerDetails: payload.passengerDetails ?? [],
      referredBy,
    });

    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      await registrarMovimientoStock({
        packageId: paquete.id,
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

export async function PATCH(request: Request) {
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

  const body = await request.json();
  const reservationId = body.reservationId;
  if (!reservationId) {
    return NextResponse.json({ error: 'reservationId obligatorio' }, { status: 400 });
  }

  const reservaSnap = await getDoc(doc(db, 'reservas', reservationId));
  if (!reservaSnap.exists()) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }
  const reserva = reservaSnap.data() as any;
  if (reserva.referredBy?.vendorId !== vendor.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const updates: Record<string, any> = {
    updatedAt: Timestamp.now(),
  };
  if (body.date !== undefined) updates.date = body.date;
  if (body.customerName !== undefined) updates.customerName = body.customerName;
  if (body.customerEmail !== undefined) updates.customerEmail = body.customerEmail;
  if (body.customerPhone !== undefined) updates.customerPhone = body.customerPhone;
  if (body.customerDocument !== undefined) updates.customerDocument = body.customerDocument;
  if (body.customerBirthDate !== undefined) updates.customerBirthDate = body.customerBirthDate;
  if (body.customerComments !== undefined) updates.customerComments = body.customerComments;
  if (body.people !== undefined) updates.people = body.people;
  if (body.peopleAdults !== undefined) updates.peopleAdults = body.peopleAdults;
  if (body.peopleMinors !== undefined) updates.peopleMinors = body.peopleMinors;
  if (body.selectedExtraCodes !== undefined) {
    const paquete = await getPaqueteById(reserva.packageId ?? reserva.experienceId);
    if (paquete) {
      const extras = resolveReservationExtraSelections({
        paquete,
        selectedExtraCodes: body.selectedExtraCodes,
      });
      updates.selectedExtras = extras;
      updates.extrasTotalAmount = extras.reduce((sum, e) => sum + e.amount, 0);
    }
  }

  try {
    await updateDoc(doc(db, 'reservas', reservationId), updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo actualizar la reserva';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
