import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export type VendorReservationRow = {
  id: string;
  reservationCode: string | null;
  createdAt: string | null;
  date: string | null;
  experienceTitle: string;
  experienceId: string | null;
  customerName: string;
  customerEmail: string;
  people: number;
  amountTotal: number;
  currency: string;
  status: 'pending' | 'reserved' | 'completed' | 'cancelled' | string;
  source: 'manual' | 'online';
  canEdit: boolean;
  referredBy: {
    code: string | null;
    commissionAmount: number;
    commissionCurrency: string | null;
    payoutStatus: 'pending' | 'accrued' | 'paid' | 'cancelled';
  };
};

function iso(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return typeof value === 'string' ? value : null;
}

export function isManualReservation(r: any): boolean {
  return r?.referredBy?.channel === 'manual' || r?.createdByAdmin === true || r?.paymentMethod === 'admin' || Boolean(r?.createdByVendorId);
}

export function toVendorRow(d: QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): VendorReservationRow {
  const r = d.data() as any;
  const rb = r.referredBy ?? {};
  const manual = isManualReservation(r);
  const status = String(r.status ?? '');
  return {
    id: d.id,
    reservationCode: r.reservationCode ?? null,
    createdAt: iso(r.createdAt),
    date: r.date ?? null,
    experienceTitle: String(r.packageTitle ?? r.experienceTitle ?? ''),
    experienceId: r.experienceId ?? r.packageId ?? null,
    customerName: String(r.customerName ?? ''),
    customerEmail: String(r.customerEmail ?? ''),
    people: Number(r.people) || 0,
    amountTotal: Number(r.amountTotal) || 0,
    currency: String(r.currency ?? 'ars').toLowerCase(),
    status,
    source: manual ? 'manual' : 'online',
    canEdit: manual && (status === 'pending' || status === 'reserved'),
    referredBy: {
      code: rb.code ?? null,
      commissionAmount: Number(rb.commissionAmount) || 0,
      commissionCurrency: rb.commissionCurrency ? String(rb.commissionCurrency).toLowerCase() : String(r.currency ?? '').toLowerCase() || null,
      payoutStatus: rb.payoutStatus ?? 'pending',
    },
  };
}

/** Todas las ventas del vendedor (manuales y online), sin depender de índices ni reglas. */
export async function loadVendorReservations(db: Firestore, vendorId: string): Promise<VendorReservationRow[]> {
  const linksSnap = await db.collection('referralLinks').where('vendorId', '==', vendorId).get();
  const codes = Array.from(new Set(linksSnap.docs.map((d) => String((d.data() as any).code ?? '')).filter(Boolean)));

  const byId = new Map<string, QueryDocumentSnapshot>();
  const own = await db.collection('reservas').where('referredBy.vendorId', '==', vendorId).get();
  own.docs.forEach((d) => byId.set(d.id, d));
  for (let i = 0; i < codes.length; i += 30) {
    const snap = await db.collection('reservas').where('referredBy.code', 'in', codes.slice(i, i + 30)).get();
    snap.docs.forEach((d) => {
      const rb = (d.data() as any).referredBy;
      if (!rb?.vendorId || rb.vendorId === vendorId) byId.set(d.id, d);
    });
  }
  return Array.from(byId.values())
    .map(toVendorRow)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}
