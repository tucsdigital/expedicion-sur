import { NextResponse } from 'next/server';
import { getExperienciaBySlug } from '@/lib/experiencias';
import { getStockDisponible } from '@/lib/stock';

export const runtime = 'nodejs';

function getBaseCapacityForDate(experience: Awaited<ReturnType<typeof getExperienciaBySlug>> | null, date: string): number {
  if (!experience || !date || date === 'sin-fecha') return 0;
  const dates = experience.bookingConfig?.dates ?? [];
  const match = dates.find((d) => d.date === date);
  if (match) return Math.max(0, match.capacity ?? 0);
  return 0;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const peopleStr = url.searchParams.get('people') || '0';
  const people = parseInt(peopleStr, 10) || 0;

  if (!slug?.trim()) {
    return NextResponse.json({ error: 'Slug requerido.' }, { status: 400 });
  }
  const experience = await getExperienciaBySlug(slug);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada.' }, { status: 404 });
  }

  if (!date) {
    return NextResponse.json({ error: 'Fecha requerida.' }, { status: 400 });
  }

  try {
    const baseCapacity = getBaseCapacityForDate(experience, date);
    const available = await getStockDisponible(experience.id, date, baseCapacity);
    return NextResponse.json({ available, ok: people <= available });
  } catch (error) {
    return NextResponse.json({ error: 'Error verificando disponibilidad' }, { status: 500 });
  }
}

