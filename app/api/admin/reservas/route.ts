import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addReservaAttachments,
  getReservaById,
  removeReservaAttachmentsById,
  updateReservaStatus,
} from '@/lib/reservas';
import { getPaqueteById } from '@/lib/paquetes';
import { requireAdminToken } from '@/lib/adminAuth';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { randomUUID } from 'crypto';
import { arrayUnion, collection, doc, getDoc, runTransaction, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getVendorById, getReferralByCode } from '@/lib/vendors';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { buildBaseSeatReservationSeats, getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import {
  normalizeDigits,
  normalizeEmail,
  reserveNextReservationCodeInTransaction,
} from '@/lib/reservas/code';
import type { SeatLayoutTemplate, SeatStatus } from '@/types';
import { buildDefaultEmailDelivery } from '@/lib/sales/status';
import { buildEmailDeliveryState, buildEmailJobDocument, emailDeliveryPathForJobType } from '@/lib/sales/email-jobs';
import { getFromEmail } from '@/lib/resend';
import {
  buildAdminNuevaReservaHtml,
  buildAdminNuevaReservaText,
  buildClienteCompraConfirmadaHtml,
  buildClienteCompraConfirmadaText,
  buildClienteVoucher48hsHtml,
  buildClienteVoucher48hsText,
} from '@/lib/emails/reserva-confirmada';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import {
  computeReservationPricing,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
} from '@/lib/packages/resolve-departure';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';

const COLLECTION = 'reservas';

export const runtime = 'nodejs';

const reservationStatusEnum = z.enum(['pending', 'reserved', 'completed', 'cancelled']);
const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  uploadedBy: z.enum(['admin', 'user']).default('admin'),
  key: z.string().optional(),
});

const paymentMovementSchema = z.object({
  movementType: z.enum(['payment', 'extra', 'discount', 'refund', 'adjustment']),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(10).optional(),
  method: z.string().min(2).max(30),
  reference: z.string().max(80).optional(),
  message: z.string().min(2).max(160),
  occurredAt: z.string().datetime().optional(),
});

const travelerSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  age: z.number().int().min(0).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(40),
  document: z.string().min(3).max(40),
  travelerType: z.enum(['adult', 'minor']).nullable().optional(),
});

const adminReservaSchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1).optional(),
  peopleAdults: z.number().int().min(0).max(50).optional(),
  peopleMinors: z.number().int().min(0).max(50).optional(),
  depositPercentAdults: z.number().min(0).max(100).optional(),
  depositPercentMinors: z.number().min(0).max(100).optional(),
  allowOverbook: z.boolean().optional(),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerComments: z.string().max(500).optional(),
  passengerDetails: z.array(travelerSchema).max(49).optional(),
  attachments: z.array(attachmentSchema).optional(),
  status: reservationStatusEnum.optional(),
  statusNote: z.string().max(500).optional(),
  vendorId: z.string().min(1).optional(),
  referralCode: z.string().max(60).optional(),
  roomType: z.enum(['matrimonial', 'twin', 'full-day']).optional(),
  pickupPoint: z.string().max(120).optional(),
  pickupPointTime: z.string().max(20).nullable().optional(),
  selectedExtraCodes: z.array(z.enum(['cocheCama', 'panoramicos', 'cafeteras'])).max(10).optional(),
  selectedSeats: z.array(z.string().min(1).max(20)).max(200).optional(),
}).refine((data) => {
  const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
  const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
  const total = a + m;
  if (total > 0) return total >= 1 && total <= 50;
  return typeof data.people === 'number' && data.people >= 1 && data.people <= 50;
}).superRefine((data, ctx) => {
  const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
  const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
  const total = a + m;
  const people = total > 0 ? total : typeof data.people === 'number' ? data.people : 0;
  const additionalTravelers = Math.max(0, people - 1);
  if (!data.customerBirthDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerBirthDate'],
      message: 'La fecha de nacimiento es obligatoria.',
    });
  }
  const passengerCount = Array.isArray(data.passengerDetails) ? data.passengerDetails.length : 0;
  if (passengerCount !== additionalTravelers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['passengerDetails'],
      message: 'La cantidad de pasajeros no coincide con la reserva.',
    });
  }
});

const adminUpdateSchema = z.object({
  reservationId: z.string().min(1),
  status: reservationStatusEnum.optional(),
  note: z.string().max(500).optional(),
  attachments: z.array(attachmentSchema).optional(),
  removeAttachments: z.array(z.object({ id: z.string().min(1) })).optional(),
  date: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  referralCode: z.string().max(60).optional(),
  clearReferredBy: z.boolean().optional(),
  enqueueCustomerVoucherEmail: z.boolean().optional(),
  enqueueAdminNotificationEmail: z.boolean().optional(),
  addPaymentEvent: paymentMovementSchema.optional(),
});

function parseDate(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return 'sin-fecha';
}

async function requireAuth(request: Request) {
  try {
    const user = await requireAdminToken(request);
    return user;
  } catch (error) {
    console.error('[admin/reservas] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

function getErrorMessage(error: unknown, fallback = 'Error desconocido'): string {
  return error instanceof Error ? error.message : fallback;
}

function getBaseCapacity(
  paquete: Awaited<ReturnType<typeof getPaqueteById>> | null,
  date: string
): number {
  if (!paquete) return 0;
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

function isEnabledDate(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, date: string): boolean {
  if (!paquete) return false;
  return resolveDepartureConfig(paquete, date).enabled;
}

function formatEmailDate(date: string): string {
  if (!date || date === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function formatEmailAmount(amountTotal: number, currency: string): string {
  const value = (amountTotal ?? 0) / 100;
  const normalized = String(currency || 'ARS').toUpperCase();
  if (normalized === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (normalized === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  if (normalized === 'USD') return `USD ${value.toLocaleString('en-US')}`;
  return `${value.toFixed(2)} ${normalized}`;
}

function normalizePaymentMovementStatus(movementType: z.infer<typeof paymentMovementSchema>['movementType']): string {
  if (movementType === 'payment') return 'paid';
  if (movementType === 'refund') return 'refunded';
  return 'recorded';
}

function normalizePaymentMovementMethod(method: string, movementType: z.infer<typeof paymentMovementSchema>['movementType']): string {
  const normalized = String(method || '').trim().toLowerCase();
  if (normalized) return normalized;
  return movementType === 'payment' ? 'admin' : 'manual';
}

async function resolveReservationReferralAssignment(params: {
  packageId: string;
  amountTotal: number;
  people: number;
  status: z.infer<typeof reservationStatusEnum>;
  vendorId?: string;
  referralCode?: string;
  existingPayoutStatus?: 'pending' | 'accrued' | 'paid' | 'cancelled' | null;
}) {
  const packageId = String(params.packageId || '').trim();
  if (!packageId) {
    throw new Error('No se pudo identificar el paquete de la venta.');
  }

  const paquete = await getPaqueteById(packageId).catch(() => null);
  const commissionOverride =
    paquete?.bookingConfig?.referralCommission
      ? {
          type: paquete.bookingConfig.referralCommission.type,
          value: paquete.bookingConfig.referralCommission.value,
          currency: paquete.bookingConfig.referralCommission.currency,
        }
      : undefined;
  const payoutStatus =
    params.existingPayoutStatus === 'paid'
      ? params.existingPayoutStatus
      : nextPayoutStatusForReservationStatus(params.status);

  const referralCode = String(params.referralCode ?? '').trim();
  if (referralCode) {
    const link = await getReferralByCode(referralCode).catch(() => null);
    if (!link) {
      throw new Error('El código de vendedor no existe o está inactivo.');
    }
    if (link.experienceId && String(link.experienceId) !== packageId) {
      throw new Error('El código elegido no corresponde a este paquete.');
    }
    const vendor = await getVendorById(link.vendorId).catch(() => null);
    if (!vendor || !vendor.active) {
      throw new Error('El vendedor asociado al código no está disponible.');
    }
    const allowedPackages = vendor.allowedPackages ?? vendor.allowedExperiences ?? null;
    if (Array.isArray(allowedPackages) && allowedPackages.length > 0 && !allowedPackages.includes(packageId)) {
      throw new Error('El vendedor no tiene habilitado este paquete.');
    }
    const comm = computeCommission({
      amountTotal: params.amountTotal,
      people: params.people,
      vendor,
      commissionOverride,
    });
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      code: link.code,
      channel: 'link' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      payoutStatus,
    };
  }

  const vendorId = String(params.vendorId ?? '').trim();
  if (vendorId) {
    const vendor = await getVendorById(vendorId).catch(() => null);
    if (!vendor || !vendor.active) {
      throw new Error('El vendedor seleccionado no está disponible.');
    }
    const allowedPackages = vendor.allowedPackages ?? vendor.allowedExperiences ?? null;
    if (Array.isArray(allowedPackages) && allowedPackages.length > 0 && !allowedPackages.includes(packageId)) {
      throw new Error('El vendedor seleccionado no opera este paquete.');
    }
    const comm = computeCommission({
      amountTotal: params.amountTotal,
      people: params.people,
      vendor,
      commissionOverride,
    });
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      channel: 'manual' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      payoutStatus,
    };
  }

  return null;
}

function resolvePickupPointTime(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, pickupPoint: string, rawTime?: string | null): string | null {
  const incoming = String(rawTime ?? '').trim();
  if (incoming) return incoming;
  const config = Array.isArray((paquete as any)?.pickupPointsConfig) ? (paquete as any).pickupPointsConfig : [];
  const found = config.find((item: any) => String(item?.label ?? '').trim() === pickupPoint);
  const time = found ? String(found?.time ?? '').trim() : '';
  return time || null;
}

function computeVoucherNextAttemptAt(params: {
  date: string;
  pickupPointTime?: string | null;
  now: Timestamp;
}): Timestamp {
  const date = String(params.date ?? '').trim();
  const time = String(params.pickupPointTime ?? '').trim();
  if (!date || date === 'sin-fecha') return params.now;
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const ts = new Date(`${date}T${hhmm}:00-03:00`).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return params.now;
  const dueMs = ts - 48 * 60 * 60 * 1000;
  const nowMs = params.now.toMillis();
  if (dueMs <= nowMs + 30 * 1000) return params.now;
  return Timestamp.fromMillis(dueMs);
}

async function enqueueReservationEmailJob(options: {
  reservationId: string;
  type: 'cliente_confirmacion_compra' | 'cliente_voucher_48hs' | 'admin_aviso';
  nextAttemptAt?: Timestamp;
  jobId?: string;
}) {
  const reservation = await getReservaById(options.reservationId);
  if (!reservation) throw new Error('Venta no encontrada');

  const reservationCode = String((reservation as any).reservationCode ?? reservation.id);
  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const lookupUrl = siteUrl
    ? `${siteUrl}/consultar-reserva?code=${encodeURIComponent(reservationCode)}`
    : undefined;
  const peopleLabel = reservation.people === 1 ? '1 persona' : `${reservation.people} personas`;
  const seatsLabel = Array.isArray((reservation as any).selectedSeats) && (reservation as any).selectedSeats.length > 0
    ? (reservation as any).selectedSeats.join(', ')
    : undefined;
  const emailData = {
    customerName: reservation.customerName ?? '',
    experienceTitle: reservation.packageTitle || reservation.experienceTitle || SITE_NAME,
    dateFormatted: formatEmailDate(reservation.date),
    peopleLabel,
    seatsLabel,
    amountFormatted: formatEmailAmount(reservation.amountTotal ?? 0, reservation.currency ?? 'ARS'),
    reservationCode,
    lookupUrl,
    sessionId: reservation.orderId || reservation.id,
    customerEmail: reservation.customerEmail ?? '',
    customerPhone: reservation.customerPhone,
    customerCountry: reservation.customerCountry,
    customerComments: reservation.customerComments,
    pickupPoint: (reservation as any).pickupPoint ?? null,
    pickupPointTime: (reservation as any).pickupPointTime ?? null,
  };

  const now = Timestamp.now();
  const jobId = options.jobId || `${options.reservationId}_${options.type}_${Date.now()}`;
  const emailJobRef = doc(db, 'emailJobs', jobId);
  const reservationRef = doc(db, COLLECTION, options.reservationId);
  const subject =
    options.type === 'cliente_confirmacion_compra'
      ? `Compra confirmada: ${reservation.packageTitle || reservation.experienceTitle || SITE_NAME}`
      : options.type === 'cliente_voucher_48hs'
        ? `Recordatorio de salida (48 hs): ${reservation.packageTitle || reservation.experienceTitle || SITE_NAME}`
      : `Nueva venta: ${reservation.packageTitle || reservation.experienceTitle || 'Paquete'} — ${reservation.customerName || reservation.customerEmail}`;
  const to =
    options.type === 'cliente_confirmacion_compra' || options.type === 'cliente_voucher_48hs'
      ? reservation.customerEmail
      : CONTACT_INFO.email;
  const html =
    options.type === 'cliente_confirmacion_compra'
      ? buildClienteCompraConfirmadaHtml(emailData)
      : options.type === 'cliente_voucher_48hs'
        ? buildClienteVoucher48hsHtml(emailData)
      : buildAdminNuevaReservaHtml(emailData);
  const text =
    options.type === 'cliente_confirmacion_compra'
      ? buildClienteCompraConfirmadaText(emailData)
      : options.type === 'cliente_voucher_48hs'
        ? buildClienteVoucher48hsText(emailData)
      : buildAdminNuevaReservaText(emailData);

  await setDoc(
    emailJobRef,
    buildEmailJobDocument({
      type: options.type,
      to,
      from: getFromEmail(),
      subject,
      html,
      text,
      reservationId: options.reservationId,
      now,
      nextAttemptAt: options.nextAttemptAt || now,
    })
  );

  await updateDoc(reservationRef, {
    [emailDeliveryPathForJobType(options.type)]: buildEmailDeliveryState({
      status: 'queued',
      now,
      jobId,
    }),
    updatedAt: now,
  }).catch(() => null);

  return jobId;
}

export async function POST(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Autenticación inválida') },
      { status: 401 }
    );
  }

  let payload: z.infer<typeof adminReservaSchema>;
  try {
    const body = await request.json();
    payload = adminReservaSchema.parse({
      ...body,
      date: parseDate(body.date),
    });
  } catch (error) {
    console.error('[admin/reservas] Error parseando payload:', error);
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

  try {
    const packageSlug = paquete.slug ?? paquete.id;
    const bc = paquete.bookingConfig;
    const departureConfig = resolveDepartureConfig(paquete, payload.date);
    const maxPeople = departureConfig.maxPeople;
    const adults = Math.max(0, Number((payload as any).peopleAdults ?? 0) || 0);
    const minors = Math.max(0, Number((payload as any).peopleMinors ?? 0) || 0);
    const derivedPeople = adults + minors;
    const people = derivedPeople > 0 ? derivedPeople : Math.max(1, Number((payload as any).people ?? 1) || 1);
    const peopleAdults = derivedPeople > 0 ? adults : null;
    const peopleMinors = derivedPeople > 0 ? minors : null;
    const depositPercentAdults = typeof (payload as any).depositPercentAdults === 'number' ? Number((payload as any).depositPercentAdults) : null;
    const depositPercentMinors = typeof (payload as any).depositPercentMinors === 'number' ? Number((payload as any).depositPercentMinors) : null;
    const allowOverbook = Boolean((payload as any).allowOverbook);

    if (people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (!isEnabledDate(paquete, payload.date)) {
      return NextResponse.json({ error: 'La fecha seleccionada no está habilitada para este paquete.' }, { status: 400 });
    }

    const computedPricing = computeReservationPricing(paquete, payload.date, {
      people,
      peopleAdults,
      peopleMinors,
      depositPercentAdults,
      depositPercentMinors,
    });
    const pickupPoint = typeof payload.pickupPoint === 'string' ? payload.pickupPoint.trim() : '';
    const pickupPointTimeRaw =
      typeof payload.pickupPointTime === 'string' ? payload.pickupPointTime.trim() : '';
    const resolvedPickupPointTime = pickupPoint
      ? resolvePickupPointTime(paquete, pickupPoint, pickupPointTimeRaw || null)
      : null;
    const roomType = typeof payload.roomType === 'string' ? payload.roomType : null;
    const currency = (computedPricing.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const unitAmount = computedPricing.unitAmount;
    if (computedPricing.pricingMode === 'percent' && computedPricing.baseUnitAmount < 1) {
      return NextResponse.json({ error: 'Falta precio base para calcular porcentaje.' }, { status: 400 });
    }
    if (!Number.isFinite(unitAmount) || unitAmount < 1 || computedPricing.subtotalAmount < 1) {
      return NextResponse.json({ error: 'Este paquete no tiene configurado un valor de reserva válido.' }, { status: 400 });
    }
    const amountTotal = computedPricing.subtotalAmount;

    const baseCapacity = payload.date !== 'sin-fecha' ? getBaseCapacity(paquete, payload.date) : 0;
    if (!allowOverbook && payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(paquete.id, payload.date, baseCapacity);
      if (people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    const selectedSeats = Array.isArray(payload.selectedSeats)
      ? Array.from(new Set(payload.selectedSeats.map((s) => String(s).trim()).filter(Boolean)))
      : [];
    const seatsEnabled = departureConfig.seatsEnabled;
    const seatLayoutId = departureConfig.seatLayoutId ?? '';
    if (seatsEnabled) {
      if (!seatLayoutId) {
        return NextResponse.json({ error: 'La salida requiere butacas, pero no tiene plantilla asignada.' }, { status: 400 });
      }
      if (selectedSeats.length !== people) {
        return NextResponse.json({ error: 'Debés seleccionar una butaca por pasajero.' }, { status: 400 });
      }
    }

    const selectedExtraCodes = Array.isArray(payload.selectedExtraCodes)
      ? Array.from(new Set(payload.selectedExtraCodes.map((code) => String(code).trim()).filter(Boolean)))
      : [];
    let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
    if (seatLayoutId && selectedExtraCodes.length > 0) {
      const templateSnap = await getDoc(doc(db, 'seatLayouts', seatLayoutId));
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
      people,
      peopleAdults,
      peopleMinors,
      depositPercentAdults,
      depositPercentMinors,
      roomType,
      selectedExtras,
    });

    const referredBy = await resolveReservationReferralAssignment({
      packageId: paquete.id,
      amountTotal: repriced.subtotalAmount,
      people,
      status: payload.status ?? 'reserved',
      vendorId: payload.vendorId,
      referralCode: payload.referralCode,
    });

    const now = Timestamp.now();
    const status = payload.status ?? 'reserved';
    const reservaRef = doc(collection(db, COLLECTION));
    const stockRef = payload.date !== 'sin-fecha' ? doc(db, 'stockMovimientos', `admin_${reservaRef.id}`) : null;

    try {
      await runTransaction(db, async (tx) => {
        if (stockRef && status !== 'cancelled') {
          const stockSnap = await tx.get(stockRef);
          if (!stockSnap.exists()) {
            tx.set(stockRef, {
              packageId: paquete.id,
              date: payload.date,
              type: 'reserva',
              quantity: -people,
              author: adminUser?.email ?? 'admin',
              referenceId: reservaRef.id,
              note: payload.statusNote ?? `Reserva manual creada (${status})${allowOverbook ? ' · OVERBOOK' : ''}`,
              baseCapacityAtThatTime: baseCapacity,
              amountTotal: repriced.subtotalAmount,
              currency,
              createdAt: now,
            });
          }
        }

        if (seatsEnabled && seatLayoutId && payload.date !== 'sin-fecha') {
          const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
          if (!templateSnap.exists()) {
            throw new Error('Plantilla de micro no encontrada.');
          }
          const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
          const baseSeats = buildBaseSeatReservationSeats(template);
          const departureId = getSeatDepartureId(paquete.id, payload.date);
          const seatResRef = doc(db, 'seatReservations', departureId);
          const seatResSnap = await tx.get(seatResRef);
          const seatResData: any = seatResSnap.exists() ? seatResSnap.data() : null;
          const currentLayoutId = seatResData ? String(seatResData?.seatLayoutId ?? '') : '';
          const seatsMap: Record<string, any> =
            seatResSnap.exists() && currentLayoutId === seatLayoutId
              ? { ...(seatResData?.seats ?? {}) }
              : { ...baseSeats };

          if (!seatResSnap.exists() || currentLayoutId !== seatLayoutId) {
            tx.set(
              seatResRef,
              {
                packageId: paquete.id,
                date: payload.date,
                seatLayoutId,
                seats: seatsMap,
                createdAt: now,
                updatedAt: now,
              },
              { merge: true }
            );
          }

          const seatIds = seatIdsFromLabels(template, selectedSeats);
          if (seatIds.length !== selectedSeats.length) throw new Error('Una o más butacas no existen en la plantilla.');

          for (const seatId of seatIds) {
            const current = seatsMap[seatId] ?? baseSeats[seatId];
            if (!current) throw new Error('Una o más butacas no existen en la plantilla.');
            const s = String(current.status ?? 'available') as SeatStatus;
            if (s !== 'available') throw new Error('Una o más butacas no están disponibles.');
          }

          const seatTargetStatus: SeatStatus = status === 'completed' ? 'paid' : 'reserved';
          for (const seatId of seatIds) {
            seatsMap[seatId] = {
              status: seatTargetStatus,
              holdId: null,
              cartId: null,
              cartItemId: null,
              orderId: null,
              reservationId: reservaRef.id,
              expiresAt: null,
              blockedBy: null,
              updatedAt: now,
            };
          }
          tx.set(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
        }

        const attachments =
          payload.attachments?.map((attachment) => ({
            id: randomUUID(),
            name: attachment.name,
            type: attachment.type,
            url: attachment.url,
            uploadedBy: attachment.uploadedBy ?? 'admin',
            key: attachment.key,
            createdAt: now,
          })) ?? [];

        const reservationCode = await reserveNextReservationCodeInTransaction(tx);
        const customerEmailLower = normalizeEmail(payload.customerEmail);
        const customerNameLower = String(payload.customerName ?? '').trim().toLowerCase() || null;
        const customerPhoneNormalized = normalizeDigits(payload.customerPhone);
        const customerDocumentNormalized = normalizeDigits(payload.customerDocument);

        tx.set(reservaRef, {
          packageId: paquete.id,
          packageSlug: paquete.slug,
          packageTitle: paquete.titulo,
          experienceId: paquete.id,
          experienceSlug: paquete.slug,
          experienceTitle: paquete.titulo,
          date: payload.date,
          people,
          peopleAdults,
          peopleMinors,
          seatLayoutId: seatsEnabled ? seatLayoutId : null,
          selectedSeats: seatsEnabled ? (selectedSeats.length ? selectedSeats : null) : null,
          pricingMode: computedPricing.pricingMode,
          pricingBaseUnitAmount: repriced.baseUnitAmount,
          unitAmountAdults: repriced.unitAmountAdults,
          unitAmountMinors: repriced.unitAmountMinors,
          depositPercentAdults: repriced.depositPercentAdults,
          depositPercentMinors: repriced.depositPercentMinors,
          baseSubtotalAmount: repriced.baseSubtotalAmount,
          extrasTotalAmount: repriced.extrasTotalAmount,
          pickupPoint: pickupPoint || null,
          pickupPointTime: resolvedPickupPointTime,
          roomType,
          selectedExtras: selectedExtras.length ? selectedExtras : null,
          amountTotal: repriced.subtotalAmount,
          currency,
          paymentMethod: 'admin',
          customerEmail: payload.customerEmail,
          customerEmailLower,
          customerName: payload.customerName,
          customerNameLower,
          customerPhone: payload.customerPhone ?? null,
          customerPhoneNormalized,
          customerCountry: payload.customerCountry ?? null,
          customerDocument: payload.customerDocument ?? null,
          customerDocumentNormalized,
          customerBirthDate: payload.customerBirthDate ?? null,
          customerComments: payload.customerComments ?? null,
          passengerDetails: payload.passengerDetails ?? [],
          reservationCode,
          attachments: attachments.length ? attachments : [],
          status,
          createdByAdmin: true,
          pricingSnapshot: buildReservationPricingSnapshot({
            unitAmount: repriced.subtotalAmount > 0 && people > 0 ? Math.round(repriced.subtotalAmount / people) : unitAmount,
            people,
            amountTotal: repriced.subtotalAmount,
            baseSubtotalAmount: repriced.baseSubtotalAmount,
            extrasTotalAmount: repriced.extrasTotalAmount,
            currency,
            paymentMethod: 'admin',
          }),
          capacitySnapshot: {
            date: payload.date,
            baseCapacity,
            maxPeoplePerBooking: departureConfig.maxPeople,
            hasSpecificDates: Boolean(paquete.salidas?.length),
            enabled: departureConfig.enabled,
          },
          experienceSnapshot: {
            id: paquete.id,
            slug: paquete.slug,
            title: paquete.titulo,
          },
          packageSnapshot: {
            id: paquete.id,
            slug: paquete.slug,
            title: paquete.titulo,
          },
          statusHistory: [
            {
              status,
              actor: 'admin',
              note: payload.statusNote ?? 'Reserva creada',
              createdAt: now,
            },
          ],
          paidAt: status === 'completed' ? now : null,
          voucherSent: false,
          voucherSentAt: null,
          emailDelivery: buildDefaultEmailDelivery(),
          createdAt: now,
          updatedAt: now,
          ...(referredBy ? { referredBy } : {}),
        });

        if (status === 'reserved' || status === 'completed') {
          const paymentRef = doc(collection(db, COLLECTION, reservaRef.id, 'payments'), `admin_${reservaRef.id}`);
          tx.set(
            paymentRef,
            {
              method: 'admin',
              status: 'paid',
              amount: repriced.subtotalAmount,
              currency,
              message: payload.statusNote ?? 'Pago registrado por admin',
              createdAt: now,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'No se pudo guardar la reserva', detail: getErrorMessage(error) },
        { status: 400 }
      );
    }

    return NextResponse.json({ id: reservaRef.id });
  } catch (error) {
    console.error('[admin/reservas] Error guardando reserva manual:', error);
    return NextResponse.json(
      { error: 'No se pudo guardar la reserva', detail: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Autenticación inválida') },
      { status: 401 }
    );
  }

  let payload: z.infer<typeof adminUpdateSchema>;
  try {
    payload = adminUpdateSchema.parse(await request.json());
  } catch (error) {
    console.error('[admin/reservas] Error parseando PATCH:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const reservation = await getReservaById(payload.reservationId);
  if (!reservation) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  try {
    if (payload.status && payload.status !== reservation.status) {
      // Validación de cupo si se reactiva una cancelada.
      if (reservation.status === 'cancelled' && payload.status !== 'cancelled' && reservation.date !== 'sin-fecha') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        const available = await getStockDisponible(reservation.packageId ?? reservation.experienceId, reservation.date, baseCapacity);
        if (reservation.people > available) {
          return NextResponse.json(
            { error: `No hay cupo suficiente para reactivar. Disponible: ${available}.` },
            { status: 400 }
          );
        }
      }

      const hasSeats = Array.isArray((reservation as any).selectedSeats) && (reservation as any).selectedSeats.length > 0;
      const seatLayoutId = (reservation as any).seatLayoutId ? String((reservation as any).seatLayoutId) : '';
      const shouldTouchSeats = hasSeats && seatLayoutId && reservation.date && reservation.date !== 'sin-fecha';
      if (shouldTouchSeats) {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const seatsEnabled = paquete ? resolveDepartureConfig(paquete, reservation.date).seatsEnabled : false;
        if (seatsEnabled) {
          const selectedSeatLabels = (reservation as any).selectedSeats.map((s: any) => String(s));
          const nextSeatStatus: SeatStatus = payload.status === 'completed' ? 'paid' : payload.status === 'cancelled' ? 'available' : 'reserved';
          const seatDepartureId = getSeatDepartureId(String(reservation.packageId ?? reservation.experienceId), reservation.date);
          const seatResRef = doc(db, 'seatReservations', seatDepartureId);
          const templateRef = doc(db, 'seatLayouts', seatLayoutId);
          try {
            await runTransaction(db, async (tx) => {
              const templateSnap = await tx.get(templateRef);
              if (!templateSnap.exists()) throw new Error('Plantilla de micro no encontrada.');
              const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
              const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
              if (seatIds.length !== selectedSeatLabels.length) throw new Error('Una o más butacas no existen en la plantilla.');

              const seatResSnap = await tx.get(seatResRef);
              if (!seatResSnap.exists()) throw new Error('No se encontró el mapa de butacas para esta salida.');
              const seatResData: any = seatResSnap.data();
              const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };

              if (payload.status !== 'cancelled') {
                for (const seatId of seatIds) {
                  const seat = seatsMap[seatId];
                  if (!seat) throw new Error('Una o más butacas no existen en la salida.');
                  const s = String(seat.status ?? 'available') as SeatStatus;
                  if (s === 'available') continue;
                  if (String(seat.reservationId ?? '') === reservation.id) continue;
                  throw new Error('Una o más butacas ya no están disponibles.');
                }
              }

              for (const seatId of seatIds) {
                const seat = seatsMap[seatId];
                if (!seat) continue;
                if (payload.status === 'cancelled') {
                  if (String(seat.reservationId ?? '') !== reservation.id) continue;
                  seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, orderId: null, reservationId: null, expiresAt: null, blockedBy: null, updatedAt: Timestamp.now() };
                } else {
                  seatsMap[seatId] = { status: nextSeatStatus, holdId: null, cartId: null, cartItemId: null, orderId: (reservation as any).orderId ?? null, reservationId: reservation.id, expiresAt: null, blockedBy: null, updatedAt: Timestamp.now() };
                }
              }

              tx.set(seatResRef, { seats: seatsMap, updatedAt: Timestamp.now() }, { merge: true });
            });
          } catch (error) {
            return NextResponse.json(
              { error: getErrorMessage(error, 'No se pudo actualizar butacas') },
              { status: 400 }
            );
          }
        }
      }

      if (payload.status === 'cancelled') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'entrada',
          quantity: reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? 'Cancelación de reserva',
          baseCapacityAtThatTime: baseCapacity,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      } else if (reservation.status === 'cancelled') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'reserva',
          quantity: -reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? 'Reserva reactivada',
          baseCapacityAtThatTime: baseCapacity,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      }
      await updateReservaStatus(payload.reservationId, payload.status, {
        note: payload.note,
      });
      if (payload.status === 'completed' || payload.status === 'cancelled') {
        const payoutStatus = nextPayoutStatusForReservationStatus(payload.status);
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          'referredBy.payoutStatus': payoutStatus,
          updatedAt: Timestamp.now(),
        }).catch(() => null);
      }
    }
    if (payload.date && payload.date !== reservation.date) {
      const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
      if (!paquete) {
        return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
      }
      if (!isEnabledDate(paquete, payload.date)) {
        return NextResponse.json({ error: 'La nueva fecha no está habilitada para este paquete.' }, { status: 400 });
      }
      const baseCapacityNew = payload.date !== 'sin-fecha' ? getBaseCapacity(paquete, payload.date) : 0;
      const baseCapacityOld = reservation.date !== 'sin-fecha' ? getBaseCapacity(paquete, reservation.date) : 0;

      // Si la reserva está activa, mover cupo: liberar fecha vieja y reservar fecha nueva.
      if (reservation.status !== 'cancelled' && reservation.date !== 'sin-fecha' && payload.date !== 'sin-fecha') {
        const availableNew = await getStockDisponible(reservation.packageId ?? reservation.experienceId, payload.date, baseCapacityNew);
        if (reservation.people > availableNew) {
          return NextResponse.json(
            { error: `No hay cupo suficiente en la nueva fecha. Disponible: ${availableNew}.` },
            { status: 400 }
          );
        }
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'entrada',
          quantity: reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? `Reprogramación: libera ${reservation.date}`,
          baseCapacityAtThatTime: baseCapacityOld,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: payload.date,
          type: 'reserva',
          quantity: -reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? `Reprogramación: reserva ${payload.date}`,
          baseCapacityAtThatTime: baseCapacityNew,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      }

      const historyEntry = {
        status: reservation.status,
        actor: 'admin' as const,
        note: payload.note ?? `Reprogramada a ${payload.date}`,
        createdAt: Timestamp.now(),
      };
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        date: payload.date,
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion(historyEntry),
        capacitySnapshot: {
          date: payload.date,
          baseCapacity: baseCapacityNew,
          maxPeoplePerBooking: typeof paquete.bookingConfig?.maxPeoplePerBooking === 'number' ? paquete.bookingConfig.maxPeoplePerBooking : null,
          hasSpecificDates: Boolean(paquete.bookingConfig?.hasSpecificDates),
          enabled: paquete.bookingConfig?.enabled !== false,
        },
      });

      const paidAt = (reservation as any).paidAt;
      const voucherAlreadySent = Boolean((reservation as any).voucherSent);
      const customerEmail = String((reservation as any).customerEmail ?? '').trim();
      if (payload.date === 'sin-fecha') {
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          voucherScheduledAt: null,
          updatedAt: Timestamp.now(),
        }).catch(() => null);
      } else if (paidAt && !voucherAlreadySent && customerEmail) {
        const now = Timestamp.now();
        const pickupPointTime = (reservation as any).pickupPointTime ? String((reservation as any).pickupPointTime).trim() : null;
        const nextAttemptAt = computeVoucherNextAttemptAt({ date: payload.date, pickupPointTime, now });
        const existingJobId = (reservation as any).emailDelivery?.customerVoucher?.jobId;
        const jobId = existingJobId ? String(existingJobId) : `${payload.reservationId}_cliente_voucher`;
        await enqueueReservationEmailJob({
          reservationId: payload.reservationId,
          type: 'cliente_voucher_48hs',
          nextAttemptAt,
          jobId,
        });
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          voucherScheduledAt: nextAttemptAt,
          voucherSent: false,
          voucherSentAt: null,
          updatedAt: now,
        }).catch(() => null);
      }
    }
    if (payload.attachments?.length) {
      await addReservaAttachments(payload.reservationId, payload.attachments);
    }
    if (payload.removeAttachments?.length) {
      await removeReservaAttachmentsById(
        payload.reservationId,
        payload.removeAttachments.map((item) => item.id)
      );
    }

    if (payload.clearReferredBy) {
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        referredBy: null,
        updatedAt: Timestamp.now(),
      });
    } else if (payload.vendorId || payload.referralCode) {
      const referredBy = await resolveReservationReferralAssignment({
        packageId: String(reservation.packageId ?? reservation.experienceId ?? ''),
        amountTotal: reservation.amountTotal ?? 0,
        people: reservation.people ?? 0,
        status: payload.status ?? reservation.status,
        vendorId: payload.vendorId,
        referralCode: payload.referralCode,
        existingPayoutStatus: (reservation as any).referredBy?.payoutStatus,
      });

      if (referredBy) {
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          referredBy,
          updatedAt: Timestamp.now(),
        });
      }
    }

    if (payload.addPaymentEvent) {
      const now = Timestamp.now();
      const movement = payload.addPaymentEvent;
      const paymentRef = doc(collection(db, COLLECTION, payload.reservationId, 'payments'), `manual_${randomUUID()}`);
      const occurredAt = movement.occurredAt
        ? Timestamp.fromDate(new Date(movement.occurredAt))
        : now;

      await setDoc(paymentRef, {
        method: normalizePaymentMovementMethod(movement.method, movement.movementType),
        movementType: movement.movementType,
        source: 'manual',
        status: normalizePaymentMovementStatus(movement.movementType),
        amount: movement.amount,
        currency: String(movement.currency || reservation.currency || 'ars').toLowerCase(),
        message: movement.message,
        reference: movement.reference?.trim() || null,
        recordedBy: adminUser?.email ?? 'admin',
        occurredAt,
        createdAt: now,
        updatedAt: now,
      });

      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        updatedAt: now,
        statusHistory: arrayUnion({
          status: reservation.status,
          actor: 'admin',
          note: `Movimiento financiero registrado: ${movement.message}`,
          createdAt: now,
        }),
      }).catch(() => null);
    }

    if (payload.enqueueCustomerVoucherEmail) {
      await enqueueReservationEmailJob({
        reservationId: payload.reservationId,
        type: 'cliente_voucher_48hs',
      });
    }

    if (payload.enqueueAdminNotificationEmail) {
      await enqueueReservationEmailJob({
        reservationId: payload.reservationId,
        type: 'admin_aviso',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reservas] Error actualizando reserva:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la reserva' }, { status: 500 });
  }
}
