import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit as firestoreLimit, query, where } from 'firebase/firestore';
import { buildVentaStatuses } from '@/lib/sales/status';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().min(1).max(80),
});

type RateState = { count: number; resetAt: number };

function getRateMap(): Map<string, RateState> {
  const g = globalThis as any;
  if (!g.__exploarg_res_by_code_rate) g.__exploarg_res_by_code_rate = new Map<string, RateState>();
  return g.__exploarg_res_by_code_rate as Map<string, RateState>;
}

function getClientKey(request: Request): string {
  const xf = request.headers.get('x-forwarded-for') ?? '';
  const ip = xf.split(',')[0]?.trim();
  if (ip) return ip;
  const real = request.headers.get('x-real-ip') ?? '';
  if (real) return real.trim();
  return 'unknown';
}

function allowRequest(request: Request): boolean {
  const key = getClientKey(request);
  const map = getRateMap();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 18;
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  map.set(key, current);
  return true;
}

function normalizeCode(input: string): string {
  return String(input ?? '').trim().toUpperCase();
}

async function findReservationByCodeOrId(raw: string) {
  const code = String(raw ?? '').trim();
  if (!code) return null;
  const codeUp = normalizeCode(code);

  const direct = await getDoc(doc(db, 'reservas', code));
  if (direct.exists()) return { id: direct.id, ...(direct.data() as any) };

  const col = collection(db, 'reservas');

  const byCode = await getDocs(query(col, where('reservationCode', '==', codeUp), firestoreLimit(1)));
  if (!byCode.empty) return { id: byCode.docs[0].id, ...(byCode.docs[0].data() as any) };

  const byOrder = await getDocs(query(col, where('orderId', '==', code), firestoreLimit(1)));
  if (!byOrder.empty) return { id: byOrder.docs[0].id, ...(byOrder.docs[0].data() as any) };

  const byPayment = await getDocs(query(col, where('mercadoPagoPaymentId', '==', code), firestoreLimit(1)));
  if (!byPayment.empty) return { id: byPayment.docs[0].id, ...(byPayment.docs[0].data() as any) };

  return null;
}

export async function GET(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Demasiadas consultas. Intentá nuevamente en unos minutos.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    code: searchParams.get('code') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const code = parsed.data.code.trim();
  if (!code || code.length < 4) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const reserva = await findReservationByCodeOrId(code);
  if (!reserva) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const statuses = buildVentaStatuses(reserva as any);
  const paid =
    statuses.commercialStatus === 'confirmed' ||
    statuses.paymentStatus === 'paid' ||
    statuses.paymentStatus === 'approved' ||
    String((reserva as any)?.status ?? '').toLowerCase() === 'completed';

  if (!paid) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const reservationId = String((reserva as any)?.id ?? '');
  const outCode = String((reserva as any)?.reservationCode ?? '').trim() || reservationId;

  return NextResponse.json({
    ok: true,
    results: [
      {
        id: reservationId,
        code: outCode,
        packageTitle: String((reserva as any)?.packageTitle ?? (reserva as any)?.experienceTitle ?? 'Paquete'),
        packageSlug: (reserva as any)?.packageSlug ? String((reserva as any)?.packageSlug) : null,
        departureDate: String((reserva as any)?.date ?? 'sin-fecha'),
        people: Number((reserva as any)?.people ?? 0),
        paymentStatus: statuses.paymentStatus,
        paymentStatusLabel: statuses.paymentStatusLabel,
      },
    ],
  });
}

