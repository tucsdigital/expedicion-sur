import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { arrayUnion, collection, doc, getDoc, getDocs, limit, query, runTransaction, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getExperienciaById } from '@/lib/experiencias-catalog';
import { createReserva } from '@/lib/reservas';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { getVendorById } from '@/lib/vendors';
import type { SeatLayoutTemplate } from '@/types';
import { guardVendor, toJson } from '@/lib/vendor-guard';
import { isManualReservation, loadVendorReservations, toVendorRow } from '@/lib/vendor-reservations';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import { normalizeDigits, normalizeEmail } from '@/lib/reservas/code';
import { getPeopleBreakdownTotal, normalizePeopleBreakdown, normalizePeopleCategories } from '@/lib/packages/people-categories';
import {
  computeExperiencePricing,
  resolveExperienceDepartureConfig,
  resolveExperienceExtraSelections,
} from '@/lib/experience-booking';

export const runtime = 'nodejs';

/** Lista y detalle de ventas del vendedor autenticado. */
export async function GET(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  const id = new URL(request.url).searchParams.get('id')?.trim();

  try {
    if (!id) {
      return NextResponse.json({ ok: true, reservations: await loadVendorReservations(ctx.db, ctx.vendorId) });
    }

    const ref = ctx.db.collection('reservas').doc(id);
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as any)?.referredBy?.vendorId !== ctx.vendorId) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const data = snap.data() as any;
    const paymentsSnap = await ref.collection('payments').get();
    const payments = paymentsSnap.docs
      .map((payment) => toJson({ id: payment.id, ...payment.data() }))
      .sort((a: any, b: any) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

    return NextResponse.json({
      ok: true,
      reservation: {
        ...toVendorRow(snap),
        paymentMethod: data.paymentMethod ?? null,
        peopleAdults: data.peopleAdults ?? null,
        peopleMinors: data.peopleMinors ?? null,
        customerPhone: data.customerPhone ?? null,
        customerCountry: data.customerCountry ?? null,
        customerDocument: data.customerDocument ?? null,
        customerBirthDate: data.customerBirthDate ?? null,
        customerComments: data.customerComments ?? null,
        passengerDetails: toJson(data.passengerDetails ?? []),
        selectedExtras: toJson(data.selectedExtras ?? []),
        selectedSeats: data.selectedSeats ?? [],
        baseSubtotalAmount: Number(data.baseSubtotalAmount) || 0,
        extrasTotalAmount: Number(data.extrasTotalAmount) || 0,
        attachments: toJson(data.attachments ?? []),
        statusHistory: toJson(data.statusHistory ?? []),
        commission: {
          type: data.referredBy?.commissionType ?? null,
          value: data.referredBy?.commissionValue ?? null,
        },
        payments,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cargar la reserva' }, { status: 500 });
  }
}

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

const vendorPatchSchema = z.object({
  reservationId: z.string().min(1),
  action: z.enum(['cancel', 'update']).default('update'),
  note: z.string().max(500).optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  customerEmail: z.string().trim().email().optional(),
  customerPhone: z.string().trim().max(40).nullable().optional(),
  customerCountry: z.string().trim().max(40).nullable().optional(),
  customerDocument: z.string().trim().max(40).nullable().optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerComments: z.string().trim().max(500).nullable().optional(),
  passengerDetails: z.array(travelerSchema).max(49).optional(),
});

const manualExtraSchema = z.object({
  title: z.string().min(1).max(120),
  price: z.number().min(0).max(999999999),
  scope: z.enum(['per_booking', 'per_person']).optional(),
});

const bodySchema = z.object({
  experienceId: z.string().min(1).optional(),
  /** Compatibilidad con formularios/ventas anteriores durante la transición. */
  packageId: z.string().min(1).optional(),
  date: z.string().min(1),
  people: z.number().int().min(1),
  peopleBreakdown: z.record(z.string(), z.number().int().min(0).max(50)).optional(),
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
  if (!data.experienceId && !data.packageId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['experienceId'], message: 'Seleccioná una experiencia.' });
  }
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

  const experienceId = String(payload.experienceId ?? payload.packageId ?? '').trim();
  const experience = await getExperienciaById(experienceId);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
  }

    const vendorFull = await getVendorById(vendor.id).catch(() => null);
  if (!vendorFull || !vendorFull.active) {
    return NextResponse.json({ error: 'Vendedor no habilitado' }, { status: 403 });
  }
    const allowedExperiences = vendorFull.allowedExperiences ?? vendorFull.allowedPackages ?? null;
    if (Array.isArray(allowedExperiences) && allowedExperiences.length > 0 && !allowedExperiences.includes(experienceId)) {
      return NextResponse.json({ error: 'No tenés permiso para esta experiencia.' }, { status: 403 });
    }

  try {
    const experienceSlug = experience.slug ?? experience.id;
    const bc = experience.bookingConfig;
    const departureConfig = resolveExperienceDepartureConfig(experience, payload.date);
    const maxPeople = departureConfig.maxPeople;
    const peopleCategories = normalizePeopleCategories(bc?.peopleCategories, maxPeople);
    const rawBreakdown = (payload as any).peopleBreakdown;
    const peopleBreakdown = rawBreakdown ? normalizePeopleBreakdown({ breakdown: rawBreakdown, categories: peopleCategories }) : null;
    if (peopleBreakdown && getPeopleBreakdownTotal(peopleBreakdown) !== payload.people) {
      return NextResponse.json({ error: 'La suma de pasajeros por categoría no coincide con el total.' }, { status: 400 });
    }
    if (rawBreakdown) {
      for (const category of peopleCategories) {
        const count = Number(rawBreakdown[category.key]);
        if (!Number.isInteger(count) || count < category.min || count > category.max) {
          return NextResponse.json({ error: `Cantidad inválida para ${category.label}.` }, { status: 400 });
        }
      }
    }
    if (payload.people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (payload.date !== 'sin-fecha') {
      if (!departureConfig.exists || !departureConfig.enabled) {
        return NextResponse.json(
          { error: 'La fecha seleccionada no está habilitada para esta experiencia.' },
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
    const selectedExtras = resolveExperienceExtraSelections({
      experiencia: experience,
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
    const repriced = computeExperiencePricing(experience, payload.date, {
      people: payload.people,
      peopleBreakdown,
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
    if (!repriced.hasValidPricing) {
      return NextResponse.json({ error: 'Falta configurar el precio de todas las categorías para esta salida.' }, { status: 400 });
    }
    const amountTotal = repriced.subtotalAmount;

    const baseCapacity = payload.date !== 'sin-fecha' ? departureConfig.baseCapacity : 0;
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
      experienceSlug,
      experienceTitle: String(experience.titulo ?? (experience as any).title ?? ''),
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
        categoryPriceBreakdown: repriced.categoryPriceBreakdown,
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
        id: experience.id,
        slug: experienceSlug,
        title: String(experience.titulo ?? (experience as any).title ?? ''),
      },
      selectedExtras: selectedExtras.length ? (selectedExtras as any) : null,
      peopleBreakdown: repriced.peopleBreakdown,
      categoryPriceBreakdown: repriced.categoryPriceBreakdown,
      customerBirthDate: payload.customerBirthDate,
      passengerDetails: payload.passengerDetails ?? [],
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

  const parsedBody = vendorPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.errors.map((issue) => issue.message).join(', ') || 'Datos inválidos' }, { status: 400 });
  }
  const body = parsedBody.data;
  const reservationId = body.reservationId;

  const reservaSnap = await getDoc(doc(db, 'reservas', reservationId));
  if (!reservaSnap.exists()) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }
  const reserva = reservaSnap.data() as any;
  if (reserva.referredBy?.vendorId !== vendor.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const manual = isManualReservation(reserva);
  if (!manual) {
    return NextResponse.json({ error: 'Las ventas online son de solo lectura. Contactá al equipo si necesitás un cambio.' }, { status: 403 });
  }
  if (reserva.status !== 'pending' && reserva.status !== 'reserved') {
    return NextResponse.json({ error: 'Solo se pueden modificar ventas pendientes o reservadas.' }, { status: 409 });
  }

  if (body.action === 'cancel') {
    try {
      const now = Timestamp.now();
      const experienceId = String(reserva.experienceId ?? reserva.packageId ?? '');
      const date = String(reserva.date ?? '');
      const experience = experienceId ? await getExperienciaById(experienceId) : null;
      const departure = experience && date && date !== 'sin-fecha' ? resolveExperienceDepartureConfig(experience, date) : null;
      const selectedSeats = Array.isArray(reserva.selectedSeats) ? reserva.selectedSeats.map(String) : [];
      const seatLayoutId = String(reserva.seatLayoutId ?? departure?.seatLayoutId ?? '');

      if (selectedSeats.length && seatLayoutId && departure?.seatsEnabled) {
        const seatDepartureId = getSeatDepartureId(experienceId, date);
        const seatReservationRef = doc(db, 'seatReservations', seatDepartureId);
        const templateRef = doc(db, 'seatLayouts', seatLayoutId);
        await runTransaction(db, async (transaction) => {
          const [templateSnap, seatsSnap] = await Promise.all([
            transaction.get(templateRef),
            transaction.get(seatReservationRef),
          ]);
          if (!templateSnap.exists() || !seatsSnap.exists()) throw new Error('No se pudo liberar el mapa de butacas. Contactá al equipo.');
          const template = { id: templateSnap.id, ...templateSnap.data() } as SeatLayoutTemplate;
          const ids = seatIdsFromLabels(template, selectedSeats);
          if (ids.length !== selectedSeats.length) throw new Error('Una o más butacas no existen en el mapa.');
          const seatsMap: Record<string, any> = { ...((seatsSnap.data() as any)?.seats ?? {}) };
          for (const id of ids) {
            const seat = seatsMap[id];
            if (!seat || String(seat.reservationId ?? '') !== reservationId) continue;
            seatsMap[id] = {
              status: 'available', holdId: null, cartId: null, cartItemId: null,
              orderId: null, reservationId: null, expiresAt: null, blockedBy: null, updatedAt: now,
            };
          }
          transaction.set(seatReservationRef, { seats: seatsMap, updatedAt: now }, { merge: true });
        });
      }

      if (date && date !== 'sin-fecha' && Number(reserva.people) > 0) {
        const baseCapacity = departure?.baseCapacity ?? 0;
        await registrarMovimientoStock({
          experienceId,
          date,
          type: 'entrada',
          quantity: Number(reserva.people),
          author: vendor.name,
          referenceId: reservationId,
          note: body.note?.trim() || 'Cancelada por el vendedor',
          baseCapacityAtThatTime: baseCapacity,
          amountTotal: Number(reserva.amountTotal) || 0,
          currency: String(reserva.currency ?? 'ars'),
        });
      }

      await updateDoc(doc(db, 'reservas', reservationId), {
        status: 'cancelled',
        updatedAt: now,
        statusHistory: arrayUnion({
          status: 'cancelled',
          actor: 'vendor',
          note: body.note?.trim() || 'Cancelada por el vendedor',
          createdAt: now,
        }),
        ...(reserva.referredBy ? { 'referredBy.payoutStatus': nextPayoutStatusForReservationStatus('cancelled') } : {}),
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cancelar la reserva' }, { status: 500 });
    }
  }

  const updates: Record<string, any> = {
    updatedAt: Timestamp.now(),
  };
  if (body.customerName !== undefined) {
    updates.customerName = String(body.customerName).trim();
    updates.customerNameLower = updates.customerName.toLowerCase();
  }
  if (body.customerEmail !== undefined) {
    updates.customerEmail = String(body.customerEmail).trim();
    updates.customerEmailLower = normalizeEmail(updates.customerEmail);
  }
  if (body.customerPhone !== undefined) {
    updates.customerPhone = body.customerPhone || null;
    updates.customerPhoneNormalized = normalizeDigits(body.customerPhone);
  }
  if (body.customerDocument !== undefined) {
    updates.customerDocument = body.customerDocument || null;
    updates.customerDocumentNormalized = normalizeDigits(body.customerDocument);
  }
  if (body.customerCountry !== undefined) updates.customerCountry = body.customerCountry || null;
  if (body.customerBirthDate !== undefined) updates.customerBirthDate = body.customerBirthDate;
  if (body.customerComments !== undefined) updates.customerComments = body.customerComments || null;
  if (body.passengerDetails !== undefined) {
    if (body.passengerDetails.length !== Math.max(0, (Number(reserva.people) || 1) - 1)) {
      return NextResponse.json({ error: 'La cantidad de pasajeros no coincide con la reserva.' }, { status: 400 });
    }
    updates.passengerDetails = body.passengerDetails;
  }
  updates.statusHistory = arrayUnion({
    status: reserva.status,
    actor: 'vendor',
    note: body.note?.trim() || 'Datos actualizados por el vendedor',
    createdAt: Timestamp.now(),
  });

  try {
    await updateDoc(doc(db, 'reservas', reservationId), updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo actualizar la reserva';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
