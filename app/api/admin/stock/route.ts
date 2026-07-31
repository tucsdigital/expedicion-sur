import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExperienciaById } from '@/lib/experiencias';
import { requireAdminToken } from '@/lib/adminAuth';
import {
  getMovimientosStock,
  getStockDisponible,
  registrarMovimientoStock,
  StockMovementType,
} from '@/lib/stock';

const querySchema = z.object({
  experienceId: z.string().min(1),
  date: z.string().min(1),
});

const bodySchema = z.object({
  experienceId: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['entrada', 'salida', 'ajuste', 'reserva']),
  quantity: z.number(),
  note: z.string().max(500).optional(),
});

function getBaseCapacity(experience: Awaited<ReturnType<typeof getExperienciaById>> | null, date: string): number {
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

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/stock] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    experienceId: url.searchParams.get('experienceId') ?? '',
    date: url.searchParams.get('date') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const experience = await getExperienciaById(parsed.data.experienceId);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
  }

  const baseCapacity = getBaseCapacity(experience, parsed.data.date);
  const movements = await getMovimientosStock(parsed.data.experienceId, {
    date: parsed.data.date,
    limit: 40,
  });
  const available = await getStockDisponible(parsed.data.experienceId, parsed.data.date, baseCapacity);
  return NextResponse.json({
    baseCapacity,
    available,
    movements,
  });
}

export async function POST(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/stock] Token inválido', error);
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
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

  const type = payload.type as StockMovementType;
  const signedQuantity =
    type === 'entrada'
      ? payload.quantity
      : type === 'salida' || type === 'reserva'
        ? -Math.abs(payload.quantity)
        : payload.quantity;

  try {
    await registrarMovimientoStock({
      experienceId: payload.experienceId,
      date: payload.date,
      type,
      quantity: signedQuantity,
      author: adminUser.email ?? 'admin',
      note: payload.note,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/stock] Error registrando movimiento:', error);
    return NextResponse.json({ error: 'No se pudo registrar el movimiento' }, { status: 500 });
  }
}
