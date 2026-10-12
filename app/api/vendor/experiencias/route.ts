import { NextResponse } from 'next/server';
import { guardVendor, toJson } from '@/lib/vendor-guard';

export const runtime = 'nodejs';

/** Experiencias visibles y habilitadas para el vendedor autenticado. */
export async function GET(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const [current, legacy] = await Promise.all([
      ctx.db.collection('experiencias').where('visible', '==', true).get(),
      ctx.db.collection('paquetes').where('visible', '==', true).get().catch(() => null),
    ]);
    const byId = new Map<string, any>();
    legacy?.docs.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
    current.docs.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
    const experiencias = Array.from(byId.values())
      .filter((item: any) => (item.titulo || item.title) && item.slug && (!ctx.allowedExperiences || ctx.allowedExperiences.includes(item.id)))
      .map((item: any) => toJson({
        ...item,
        id: item.id,
        titulo: item.titulo ?? item.title ?? '',
        slug: item.slug ?? '',
        moneda: item.moneda ?? item.bookingConfig?.currency?.toUpperCase?.() ?? 'ARS',
        precio: item.precio ?? item.price ?? 0,
        bookingConfig: item.bookingConfig,
        addons: item.addons ?? [],
        seatLayoutId: item.seatLayoutId ?? null,
        salidas: item.salidas ?? (Array.isArray(item.bookingConfig?.dates)
          ? item.bookingConfig.dates.map((date: any) => ({ fecha: date.date, precio: date.price, cupo: date.capacity, enabled: date.enabled }))
          : []),
      }))
      .sort((a: any, b: any) => String(a.titulo).localeCompare(String(b.titulo), 'es'));
    return NextResponse.json({ ok: true, experiencias });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron cargar las experiencias' }, { status: 500 });
  }
}
