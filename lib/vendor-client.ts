import type { User } from 'firebase/auth';

export type PayoutStatus = 'pending' | 'accrued' | 'paid' | 'cancelled';

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
  status: string;
  source: 'manual' | 'online';
  canEdit: boolean;
  referredBy: {
    code: string | null;
    commissionAmount: number;
    commissionCurrency: string | null;
    payoutStatus: PayoutStatus;
  };
};

export type VendorReservationDetail = VendorReservationRow & {
  paymentMethod: string | null;
  peopleAdults: number | null;
  peopleMinors: number | null;
  customerPhone: string | null;
  customerCountry: string | null;
  customerDocument: string | null;
  customerBirthDate: string | null;
  customerComments: string | null;
  passengerDetails: Array<{
    firstName: string;
    lastName: string;
    age: number;
    birthDate: string;
    phone: string;
    document: string;
    travelerType?: 'adult' | 'minor' | null;
  }>;
  selectedExtras: Array<{ label?: string; code?: string; amount?: number; perPerson?: boolean }>;
  selectedSeats: string[];
  baseSubtotalAmount: number;
  extrasTotalAmount: number;
  attachments: Array<{ id: string; url: string; name?: string; type?: string }>;
  statusHistory: Array<{ status: string; actor: string; note?: string; createdAt: string | null }>;
  commission: { type: 'percent' | 'fixed' | null; value: number | null };
  payments: Array<{ id: string; method?: string; status?: string; amount?: number; currency?: string; message?: string; createdAt?: string | null }>;
};

export type VendorLinkRow = {
  id: string;
  code: string;
  active: boolean;
  experienceId: string | null;
  experienceName: string;
  experienceSlug?: string;
  createdAt: string | null;
  salesCount: number;
  revenueByCurrency: Record<'ars' | 'brl' | 'usd', number>;
  commissionByCurrency: Record<'ars' | 'brl' | 'usd', number>;
};

export type VendorExperienceOption = { id: string; title: string; slug: string };

export type CurrencyTotals = { sales: number; commission: number; pending: number; accrued: number; paid: number; count: number };

export type VendorDashboardData = {
  totals: { reservations: number; manual: number; online: number };
  byCurrency: Record<string, CurrencyTotals>;
  byStatus: Record<string, number>;
  links: { total: number; active: number };
  topLinks: Array<{ code: string; title: string; count: number }>;
  recent: VendorReservationRow[];
};

export class VendorApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function vendorFetch<T = any>(user: User, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new VendorApiError(data?.error || data?.detail || 'Error de servidor', res.status);
  return data as T;
}

export async function fetchVendorReservations(user: User): Promise<VendorReservationRow[]> {
  return (await vendorFetch<{ reservations: VendorReservationRow[] }>(user, '/api/vendor/reservas')).reservations;
}

export async function fetchVendorReservation(user: User, id: string): Promise<VendorReservationDetail> {
  return (await vendorFetch<{ reservation: VendorReservationDetail }>(user, `/api/vendor/reservas?id=${encodeURIComponent(id)}`)).reservation;
}

/* ---------- formato y etiquetas ---------- */

export function formatMoney(cents: number, currency: string): string {
  const code = String(currency || 'ars').toUpperCase();
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toLocaleString('es-AR')} ${code}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value || value === 'sin-fecha') return value === 'sin-fecha' ? 'A coordinar' : '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  reserved: 'Reservada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export const PAYOUT_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accrued: 'Devengada',
  paid: 'Pagada',
  cancelled: 'Anulada',
};

export const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  reserved: 'bg-sky-50 text-sky-700 ring-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const PAYOUT_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  accrued: 'bg-sky-50 text-sky-700 ring-sky-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200',
};
