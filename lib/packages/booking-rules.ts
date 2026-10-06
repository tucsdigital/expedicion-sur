/**
 * Reglas de anticipación para reservas (booking lead time).
 *
 * Las reservas online solo se permiten para fechas con suficiente anticipación:
 * por defecto 48 hs desde el momento actual. Ej: si hoy es lunes 15:00, la
 * primera fecha reservable es el miércoles (a partir de las 15:00 → miércoles
 * queda habilitado porque su inicio ya queda a más de 48 hs).
 *
 * La anticipación es configurable por paquete vía `bookingConfig.minLeadHours`
 * (0 = sin anticipación mínima). Si el paquete no define el valor, se aplica
 * el default global de 48 hs.
 */

export const DEFAULT_MIN_LEAD_HOURS = 48;
export const MAX_MIN_LEAD_HOURS = 720;

export type BookingLeadTimeConfig = { minLeadHours?: number | null } | null | undefined;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Horas de anticipación mínima aplicables a un paquete. */
export function getMinLeadHours(config: BookingLeadTimeConfig): number {
  const raw = Number((config as BookingLeadTimeConfig)?.minLeadHours);
  if (!Number.isFinite(raw)) return DEFAULT_MIN_LEAD_HOURS;
  return Math.max(0, Math.min(MAX_MIN_LEAD_HOURS, Math.floor(raw)));
}

/** Instante (ms) a partir del cual una fecha pasa a ser reservable. */
export function getBookingCutoffMs(leadHours: number, now: Date = new Date()): number {
  const safeHours = Math.max(0, Number(leadHours) || 0);
  return now.getTime() + safeHoursToMs(safeHours);
}

function safeHoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Indica si una fecha (YYYY-MM-DD) puede reservarse con la anticipación dada.
 * "sin-fecha" (salidas a coordinar) no se restringe.
 */
export function isDateBookable(date: string, leadHours: number, now: Date = new Date()): boolean {
  const normalized = String(date ?? '').trim();
  if (!normalized || normalized === 'sin-fecha') return true;
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= getBookingCutoffMs(leadHours, now);
}

/** Primera fecha (YYYY-MM-DD) reservable según la anticipación. */
export function getFirstBookableDateIso(leadHours: number, now: Date = new Date()): string {
  const cutoff = new Date(getBookingCutoffMs(leadHours, now));
  const firstDay = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate());
  if (firstDay.getTime() < cutoff.getTime()) {
    firstDay.setDate(firstDay.getDate() + 1);
  }
  return toIsoDate(firstDay);
}

/** "48 hs" / "72 hs" / "0 hs". */
export function formatLeadHoursEs(hours: number): string {
  return `${Math.max(0, Math.floor(Number(hours) || 0))} hs`;
}

/** "vie 20 sep 2026" a partir de YYYY-MM-DD. */
export function formatIsoDateEs(iso: string, locale: string = 'es'): string {
  const parsed = new Date(`${String(iso ?? '').trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(iso ?? '');
  return parsed
    .toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

/** Mensaje estándar para avisos y errores de anticipación. */
export function buildLeadTimeMessage(leadHours: number, locale: string = 'es'): string {
  if (getMinLeadHours({ minLeadHours: leadHours }) <= 0) return '';
  const firstDate = formatIsoDateEs(getFirstBookableDateIso(leadHours), locale);
  if (locale === 'en') {
    return `Bookings require at least ${Math.max(0, Math.floor(Number(leadHours) || 0))} hours' notice. Next available date: ${firstDate}.`;
  }
  return `Las reservas se realizan con un mínimo de ${formatLeadHoursEs(leadHours)} de anticipación. Próxima fecha disponible: ${firstDate}.`;
}
