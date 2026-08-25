export type PeopleCategoryConfig = {
  key: string;
  label: string;
  min: number;
  max: number;
};

export type PeopleBreakdown = Record<string, number>;

function normalizeKey(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  return cleaned.slice(0, 32);
}

function toInt(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.floor(num);
}

export function getDefaultPeopleCategories(maxPeoplePerBooking: number): PeopleCategoryConfig[] {
  const max = Math.max(1, Math.min(50, Math.floor(Number(maxPeoplePerBooking) || 1)));
  return [
    { key: 'adults', label: 'Adultos', min: 1, max },
    { key: 'minors', label: 'Menores', min: 0, max },
  ];
}

export function normalizePeopleCategories(input: unknown, maxPeoplePerBooking: number): PeopleCategoryConfig[] {
  const fallback = getDefaultPeopleCategories(maxPeoplePerBooking);
  if (!Array.isArray(input) || input.length === 0) return fallback;

  const max = Math.max(1, Math.min(50, Math.floor(Number(maxPeoplePerBooking) || 1)));
  const unique = new Set<string>();
  const categories = input
    .map((item) => {
      const key = normalizeKey((item as any)?.key);
      const label = String((item as any)?.label ?? '').trim();
      const min = Math.max(0, Math.min(50, toInt((item as any)?.min)));
      const rawMax = toInt((item as any)?.max);
      const cappedMax = Math.max(min, Math.min(50, Math.min(max, rawMax || 0)));
      return {
        key,
        label,
        min,
        max: cappedMax,
      } satisfies PeopleCategoryConfig;
    })
    .filter((item) => Boolean(item.key) && Boolean(item.label) && item.max >= item.min);

  const deduped = categories.filter((cat) => {
    if (unique.has(cat.key)) return false;
    unique.add(cat.key);
    return true;
  });

  if (deduped.length === 0) return fallback;
  return deduped;
}

export function getPeopleBreakdownTotal(breakdown: PeopleBreakdown): number {
  return Object.values(breakdown).reduce((acc, value) => acc + Math.max(0, toInt(value)), 0);
}

export function normalizePeopleBreakdown(params: {
  breakdown: unknown;
  categories: PeopleCategoryConfig[];
}): PeopleBreakdown {
  const categories = Array.isArray(params.categories) ? params.categories : [];
  const output: PeopleBreakdown = {};
  categories.forEach((cat) => {
    output[cat.key] = Math.max(0, toInt(cat.min));
  });

  let input: any = params.breakdown;
  if (typeof input === 'string' && input.trim()) {
    try {
      input = JSON.parse(input);
    } catch {
      input = null;
    }
  }

  if (!input || typeof input !== 'object') return output;

  categories.forEach((cat) => {
    const candidate = toInt((input as any)[cat.key]);
    const value = Math.max(cat.min, Math.min(cat.max, Math.max(0, candidate)));
    output[cat.key] = value;
  });

  return output;
}

export function clampPeopleBreakdownToMax(params: {
  breakdown: PeopleBreakdown;
  categories: PeopleCategoryConfig[];
  maxPeoplePerBooking: number;
}): PeopleBreakdown {
  const maxTotal = Math.max(1, Math.min(50, Math.floor(Number(params.maxPeoplePerBooking) || 1)));
  const categories = Array.isArray(params.categories) ? params.categories : [];
  const output: PeopleBreakdown = {};
  categories.forEach((cat) => {
    output[cat.key] = Math.max(cat.min, Math.min(cat.max, Math.max(0, toInt(params.breakdown?.[cat.key]))));
  });

  let total = getPeopleBreakdownTotal(output);
  if (total <= maxTotal) return output;

  const adjustable = categories.slice().reverse();
  for (const cat of adjustable) {
    if (total <= maxTotal) break;
    const current = output[cat.key] ?? 0;
    const min = Math.max(0, toInt(cat.min));
    if (current <= min) continue;
    const delta = Math.min(current - min, total - maxTotal);
    output[cat.key] = current - delta;
    total -= delta;
  }

  return output;
}

