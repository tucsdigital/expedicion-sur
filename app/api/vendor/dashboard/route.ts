import { NextResponse } from 'next/server';
import { guardVendor } from '@/lib/vendor-guard';
import { loadVendorReservations } from '@/lib/vendor-reservations';

export const runtime = 'nodejs';

type Ccy = 'ars' | 'brl' | 'usd';
const empty = () => ({ sales: 0, commission: 0, pending: 0, accrued: 0, paid: 0, count: 0 });

/** Resumen del vendedor: totales por moneda, estado de comisiones, enlaces y últimas ventas. */
export async function GET(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const rows = await loadVendorReservations(ctx.db, ctx.vendorId);
    const valid = rows.filter((r) => r.status !== 'cancelled');

    const byCurrency: Record<string, ReturnType<typeof empty>> = {};
    for (const r of valid) {
      const sale = (byCurrency[r.currency] ??= empty());
      sale.sales += r.amountTotal;
      sale.count += 1;
      const cc = (r.referredBy.commissionCurrency ?? r.currency) as Ccy;
      const com = (byCurrency[cc] ??= empty());
      com.commission += r.referredBy.commissionAmount;
      const st = r.referredBy.payoutStatus;
      if (st === 'pending' || st === 'accrued' || st === 'paid') com[st] += r.referredBy.commissionAmount;
    }

    const byStatus = { pending: 0, reserved: 0, completed: 0, cancelled: 0 } as Record<string, number>;
    rows.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    });

    const linksSnap = await ctx.db.collection('referralLinks').where('vendorId', '==', ctx.vendorId).get();
    const links = { total: linksSnap.size, active: linksSnap.docs.filter((d) => (d.data() as any).active).length };

    const codeSales = new Map<string, { code: string; title: string; count: number }>();
    for (const r of valid) {
      const code = r.referredBy.code;
      if (!code) continue;
      const cur = codeSales.get(code) ?? { code, title: r.experienceTitle, count: 0 };
      cur.count += 1;
      codeSales.set(code, cur);
    }
    const topLinks = Array.from(codeSales.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    return NextResponse.json({
      ok: true,
      totals: { reservations: rows.length, manual: rows.filter((r) => r.source === 'manual').length, online: rows.filter((r) => r.source === 'online').length },
      byCurrency,
      byStatus,
      links,
      topLinks,
      recent: rows.slice(0, 6),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar el resumen' }, { status: 500 });
  }
}
