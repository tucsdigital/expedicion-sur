import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addReservaAttachments,
  createReserva,
  getReservaById,
  removeReservaAttachmentsById,
  updateReservaStatus,
} from '@/lib/reservas';
import { getExperienciaById } from '@/lib/experiencias';
import { requireAdminToken } from '@/lib/adminAuth';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { arrayUnion, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getVendorById, getReferralByCode } from '@/lib/vendors';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';

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

const adminReservaSchema = z.object({
  experienceId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerComments: z.string().max(500).optional(),
  attachments: z.array(attachmentSchema).optional(),
  status: reservationStatusEnum.optional(),
  statusNote: z.string().max(500).optional(),
  vendorId: z.string().min(1).optional(),
  referralCode: z.string().max(60).optional(),
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
  experience: Awaited<ReturnType<typeof getExperienciaById>> | null,
  date: string
): number {
  if (!experience) return 0;
  const bookings = experience.bookingConfig?.dates ?? [];
  const match = bookings.find((item) => item.date === date);
  if (match) return Math.max(0, match.capacity);
  if (experience.bookingConfig?.maxPeoplePerBooking) {
    return experience.bookingConfig.maxPeoplePerBooking;
  }
  if (typeof experience.maxPeople === 'number') {
    return Math.max(0, experience.maxPeople);
  }
  return 0;
}

function isEnabledDate(experience: Awaited<ReturnType<typeof getExperienciaById>> | null, date: string): boolean {
  const bc = experience?.bookingConfig;
  if (!bc?.hasSpecificDates) return true;
  if (!date || date === 'sin-fecha') return true;
  const slot = (bc.dates ?? []).find((d) => d.date === date);
  return Boolean(slot?.enabled);
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

  const experience = await getExperienciaById(payload.experienceId);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
  }

  try {
    const experienciaSlug = experience.slug ?? experience.id;
    const currency = (experience.bookingConfig?.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const bc = experience.bookingConfig;
    const maxPeople = typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : (experience.maxPeople ?? 50);
    if (payload.people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (!isEnabledDate(experience, payload.date)) {
      return NextResponse.json({ error: 'La fecha seleccionada no está habilitada para esta experiencia.' }, { status: 400 });
    }

    const unitPrice =
      typeof bc?.depositAmount === 'number'
        ? bc.depositAmount
        : typeof (experience as { price?: unknown }).price === 'number'
          ? (experience as { price?: number }).price ?? 0
          : 0;
    const unitAmount = Math.round(unitPrice * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 1) {
      return NextResponse.json({ error: 'Esta experiencia no tiene configurado un valor de reserva válido.' }, { status: 400 });
    }
    const amountTotal = unitAmount * payload.people;

    const baseCapacity = payload.date !== 'sin-fecha' ? getBaseCapacity(experience, payload.date) : 0;
    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(experience.id, payload.date, baseCapacity);
      if (payload.people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    let reservaId = '';
    try {
      let referredBy: any = undefined;
      // Prioridad: referralCode (si resuelve) > vendorId manual
      if (payload.referralCode) {
        const link = await getReferralByCode(payload.referralCode).catch(() => null);
        if (link?.vendorId) {
          const vendor = await getVendorById(link.vendorId).catch(() => null);
          if (vendor && vendor.active) {
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
              vendor,
              commissionOverride,
            });
            const payoutStatus = nextPayoutStatusForReservationStatus(payload.status ?? 'reserved');
            referredBy = {
              vendorId: vendor.id,
              vendorName: vendor.name,
              code: link.code,
              channel: 'link',
              commissionType: comm.type,
              commissionValue: comm.value,
              commissionCurrency: comm.currency,
              commissionAmount: comm.commissionAmount,
              payoutStatus,
            };
          }
        }
      }
      if (!referredBy && payload.vendorId) {
        const vendor = await getVendorById(payload.vendorId).catch(() => null);
        if (vendor && vendor.active) {
          const commissionOverride2 =
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
            vendor,
            commissionOverride: commissionOverride2,
          });
          const payoutStatus = nextPayoutStatusForReservationStatus(payload.status ?? 'reserved');
          referredBy = {
            vendorId: vendor.id,
            vendorName: vendor.name,
            channel: 'manual',
            commissionType: comm.type,
            commissionValue: comm.value,
            commissionCurrency: comm.currency,
            commissionAmount: comm.commissionAmount,
            payoutStatus,
          };
        }
      }
      reservaId = await createReserva({
        experienceId: experience.id,
        experienceSlug: experienciaSlug,
        experienceTitle: experience.title,
        date: payload.date,
        people: payload.people,
        amountTotal,
        currency,
        paymentMethod: 'admin',
        stripeSessionId: `admin-${Date.now()}`,
        customerEmail: payload.customerEmail,
        customerName: payload.customerName,
        // Pasamos undefined y convertimos a null en createReserva para evitar errores de tipado TS.
        customerPhone: payload.customerPhone ?? undefined,
        customerCountry: payload.customerCountry ?? undefined,
        customerDocument: payload.customerDocument ?? undefined,
        customerComments: payload.customerComments ?? undefined,
        attachments: payload.attachments,
        createdByAdmin: true,
        status: payload.status ?? 'reserved',
        historyNote: payload.statusNote,
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
        ...(referredBy ? { referredBy } : {}),
      });
    } catch (error) {
      console.error('[admin/reservas] Error en createReserva:', error);
      return NextResponse.json(
        { error: 'No se pudo guardar la reserva', detail: getErrorMessage(error) },
        { status: 500 }
      );
    }

    try {
      if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
        await registrarMovimientoStock({
          experienceId: experience.id,
          date: payload.date,
          type: 'reserva',
          quantity: -payload.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservaId,
          note: payload.statusNote ?? `Reserva manual creada (${payload.status ?? 'reserved'})`,
          baseCapacityAtThatTime: baseCapacity,
          amountTotal,
          currency,
        });
      }
    } catch (error) {
      console.error('[admin/reservas] Error en registrarMovimientoStock:', error);
      // Importante: la reserva ya fue creada. Devolvemos 500 para alertar y permitir reconciliación por cron.
      return NextResponse.json(
        {
          error: 'Reserva creada, pero no se pudo registrar el movimiento de stock',
          id: reservaId,
          detail: getErrorMessage(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: reservaId });
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
        const experience = await getExperienciaById(reservation.experienceId);
        const baseCapacity = getBaseCapacity(experience, reservation.date);
        const available = await getStockDisponible(reservation.experienceId, reservation.date, baseCapacity);
        if (reservation.people > available) {
          return NextResponse.json(
            { error: `No hay cupo suficiente para reactivar. Disponible: ${available}.` },
            { status: 400 }
          );
        }
      }
      if (payload.status === 'cancelled') {
        const experience = await getExperienciaById(reservation.experienceId);
        const baseCapacity = getBaseCapacity(experience, reservation.date);
        await registrarMovimientoStock({
          experienceId: reservation.experienceId,
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
        const experience = await getExperienciaById(reservation.experienceId);
        const baseCapacity = getBaseCapacity(experience, reservation.date);
        await registrarMovimientoStock({
          experienceId: reservation.experienceId,
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
      const experience = await getExperienciaById(reservation.experienceId);
      if (!experience) {
        return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
      }
      if (!isEnabledDate(experience, payload.date)) {
        return NextResponse.json({ error: 'La nueva fecha no está habilitada para esta experiencia.' }, { status: 400 });
      }
      const baseCapacityNew = payload.date !== 'sin-fecha' ? getBaseCapacity(experience, payload.date) : 0;
      const baseCapacityOld = reservation.date !== 'sin-fecha' ? getBaseCapacity(experience, reservation.date) : 0;

      // Si la reserva está activa, mover cupo: liberar fecha vieja y reservar fecha nueva.
      if (reservation.status !== 'cancelled' && reservation.date !== 'sin-fecha' && payload.date !== 'sin-fecha') {
        const availableNew = await getStockDisponible(reservation.experienceId, payload.date, baseCapacityNew);
        if (reservation.people > availableNew) {
          return NextResponse.json(
            { error: `No hay cupo suficiente en la nueva fecha. Disponible: ${availableNew}.` },
            { status: 400 }
          );
        }
        await registrarMovimientoStock({
          experienceId: reservation.experienceId,
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
          experienceId: reservation.experienceId,
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
          maxPeoplePerBooking: typeof experience.bookingConfig?.maxPeoplePerBooking === 'number' ? experience.bookingConfig.maxPeoplePerBooking : null,
          hasSpecificDates: Boolean(experience.bookingConfig?.hasSpecificDates),
          enabled: Boolean(experience.bookingConfig?.enabled),
        },
      });
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
      const amountTotal = reservation.amountTotal ?? 0;
      const people = reservation.people ?? 0;
      let referredBy: any = null;

      if (payload.referralCode) {
        const link = await getReferralByCode(payload.referralCode).catch(() => null);
        if (link?.vendorId) {
          const vendor = await getVendorById(link.vendorId).catch(() => null);
          if (vendor && vendor.active) {
            const comm = computeCommission({
              amountTotal,
              people,
              vendor,
            });
            const currentStatus = payload.status ?? reservation.status;
            const existingPayoutStatus = (reservation as any).referredBy?.payoutStatus;
            const payoutStatus =
              existingPayoutStatus === 'paid'
                ? existingPayoutStatus
                : nextPayoutStatusForReservationStatus(currentStatus);
            referredBy = {
              vendorId: vendor.id,
              vendorName: vendor.name,
              code: link.code,
              channel: 'link',
              commissionType: comm.type,
              commissionValue: comm.value,
              commissionCurrency: comm.currency,
              commissionAmount: comm.commissionAmount,
              payoutStatus,
            };
          }
        }
      }

      if (!referredBy && payload.vendorId) {
        const vendor = await getVendorById(payload.vendorId).catch(() => null);
        if (vendor && vendor.active) {
          const exp = await getExperienciaById(reservation.experienceId);
          const commissionOverride =
            exp?.bookingConfig?.referralCommission
              ? {
                  type: exp.bookingConfig.referralCommission.type,
                  value: exp.bookingConfig.referralCommission.value,
                  currency: exp.bookingConfig.referralCommission.currency,
                }
              : undefined;
          const comm = computeCommission({
            amountTotal,
            people,
            vendor,
            commissionOverride,
          });
          const currentStatus = payload.status ?? reservation.status;
          const existingPayoutStatus = (reservation as any).referredBy?.payoutStatus;
          const payoutStatus =
            existingPayoutStatus === 'paid'
              ? existingPayoutStatus
              : nextPayoutStatusForReservationStatus(currentStatus);
          referredBy = {
            vendorId: vendor.id,
            vendorName: vendor.name,
            channel: 'manual',
            commissionType: comm.type,
            commissionValue: comm.value,
            commissionCurrency: comm.currency,
            commissionAmount: comm.commissionAmount,
            payoutStatus,
          };
        }
      }

      if (referredBy) {
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          referredBy,
          updatedAt: Timestamp.now(),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reservas] Error actualizando reserva:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la reserva' }, { status: 500 });
  }
}
