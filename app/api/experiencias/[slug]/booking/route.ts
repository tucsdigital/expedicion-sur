import { NextResponse } from 'next/server';
import { getExperienciaBySlug } from '@/lib/experiencias';
import { getReservasCountByExperienceAndDate } from '@/lib/reservas';
import { toBookingPublicData } from '@/lib/experiencias';
import { getStockDisponible } from '@/lib/stock';

export const runtime = 'nodejs';

/** GET: devuelve los datos de reserva de la experiencia con available descontado por stock. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug?.trim()) {
    return NextResponse.json({ error: 'Slug requerido.' }, { status: 400 });
  }

  const experience = await getExperienciaBySlug(slug);
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada.' }, { status: 404 });
  }

  const reservedByDate = await getReservasCountByExperienceAndDate(experience.id);
  const booking = toBookingPublicData(experience, reservedByDate);
  if (!booking) {
    return NextResponse.json({ error: 'Sin datos de reserva.' }, { status: 404 });
  }

  // Recalcular disponibilidad usando stockMovimientos (autoridad)
  // helper para obtener baseCapacity por fecha (similiar a stripe webhook)
  function getBaseCapacityForDate(date: string): number {
    if (!experience || !date || date === 'sin-fecha') return 0;
    const dates = experience.bookingConfig?.dates ?? [];
    const match = dates.find((d) => d.date === date);
    if (match) return Math.max(0, match.capacity ?? 0);
    return 0;
  }

  if (Array.isArray(booking.dates) && booking.dates.length > 0) {
    const promises = booking.dates.map(async (d) => {
      try {
        const base = getBaseCapacityForDate(d.date);
        const availableByStock = await getStockDisponible(experience.id, d.date, base);
        return {
          ...d,
          // mantener capacity/reserved para compatibilidad, pero exponer available proveniente del stock
          capacity: typeof d.capacity === 'number' ? d.capacity : base,
          available: typeof availableByStock === 'number' ? availableByStock : Math.max(0, (d.capacity ?? base) - (reservedByDate?.[d.date] ?? 0)),
        };
      } catch (err) {
        return d;
      }
    });
    const resolved = await Promise.all(promises);
    booking.dates = resolved;
  }

  return NextResponse.json({ booking });
}
