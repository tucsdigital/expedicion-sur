import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
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
  roomType: z.enum(['matrimonial', 'twin', 'full-day']).optional(),
  pickupPoint: z.string().max(120).optional(),
  pickupPointTime: z.string().max(20).nullable().optional(),
  selectedExtraCodes: z.array(z.enum(['cocheCama', 'panoramicos', 'cafeteras'])).max(10).optional(),
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

function resolvePickupPointTime(paquete: any, pickupPoint: string, rawTime?: string | null): string | null {
  const incoming = String(rawTime ?? '').trim();
  if (incoming) return incoming;
  const config = Array.isArray(paquete?.pickupPointsConfig) ? paquete.pickupPointsConfig : [];
  const found = config.find((item: any) => String(item?.label ?? '').trim() === pickupPoint);
  const time = found ? String(found?.time ?? '').trim() : '';
  return time || null;
}

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

    const pickupPoint = typeof payload.pickupPoint === 'string' ? payload.pickupPoint.trim() : '';
    const pickupPointTime = pickupPoint
      ? resolvePickupPointTime(paquete, pickupPoint, payload.pickupPointTime ?? null)
      : null;
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
      pickupPoint: pickupPoint || null,
      selectedExtraCodes,
      seatLayoutTemplate: seatLayoutTemplateForExtras,
    });
    const repriced = computeReservationPricing(paquete, payload.date, {
      people: payload.people,
      roomType: payload.roomType ?? null,
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
      pickupPoint: pickupPoint || null,
      pickupPointTime,
      roomType: payload.roomType ?? null,
      selectedExtras: selectedExtras.length ? selectedExtras : null,
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
