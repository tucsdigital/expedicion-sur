import type { Categoria, Paquete } from '../../types/index.ts';
import { resolvePackageCategoryIds } from '../packages/category-utils.ts';
import { resolveDepartureConfig } from '../packages/resolve-departure.ts';

/** Datos mínimos y serializables de una experiencia para el buscador. */
export type SearchEntry = {
  slug: string;
  title: string;
  /** Ids de categorías (destinos) a las que pertenece. */
  categoryIds: string[];
  /** Fechas (YYYY-MM-DD) de salidas habilitadas. */
  dates: string[];
};

export type SearchDestinationSource = { id: string; nombre: string };

export type SearchData = {
  entries: SearchEntry[];
  destinations: SearchDestinationSource[];
};

export type SearchDestination = {
  /** Id de la categoría en Firestore. */
  id: string;
  label: string;
  count: number;
};

export type SearchExperience = {
  slug: string;
  title: string;
  destinationIds: string[];
  /** Meses (YYYY-MM) con al menos una salida futura y habilitada. */
  months: string[];
};

export type SearchIndex = {
  destinations: SearchDestination[];
  experiences: SearchExperience[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Reduce un paquete a lo necesario para buscar. Solo conserva destinos que existen en `categorias`. */
export function toSearchEntry(paquete: Paquete, categorias: Categoria[]): SearchEntry | null {
  const slug = String(paquete?.slug ?? '').trim();
  const title = String(paquete?.titulo ?? '').trim();
  if (!slug || !title) return null;

  const dates = new Set<string>();
  for (const salida of Array.isArray(paquete.salidas) ? paquete.salidas : []) {
    const fecha = String(salida?.fecha ?? '').trim();
    if (!ISO_DATE.test(fecha)) continue;
    if (resolveDepartureConfig(paquete, fecha).enabled) dates.add(fecha);
  }

  return {
    slug,
    title,
    categoryIds: resolvePackageCategoryIds(paquete, categorias),
    dates: [...dates].sort(),
  };
}

export function buildSearchIndex(
  entries: SearchEntry[],
  destinations: SearchDestinationSource[],
  todayIso: string = toLocalIsoDate()
): SearchIndex {
  const validDestinations = new Map<string, string>();
  for (const destination of Array.isArray(destinations) ? destinations : []) {
    const id = String(destination?.id ?? '').trim();
    const label = String(destination?.nombre ?? '').trim();
    if (id && label) validDestinations.set(id, label);
  }

  const counts = new Map<string, number>();
  const experiences: SearchExperience[] = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    const destinationIds = (entry.categoryIds ?? []).filter((id) => validDestinations.has(id));
    const months = new Set<string>();
    for (const date of entry.dates ?? []) {
      if (ISO_DATE.test(date) && date >= todayIso) months.add(date.slice(0, 7));
    }
    experiences.push({ slug: entry.slug, title: entry.title, destinationIds, months: [...months].sort() });
    destinationIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  }

  const destinationList: SearchDestination[] = [...counts.entries()]
    .map(([id, count]) => ({ id, label: validDestinations.get(id) as string, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  return { destinations: destinationList, experiences };
}

export function getExperiences(index: SearchIndex, destinationId: string, query = ''): SearchExperience[] {
  const term = normalizeSearchText(query);
  return index.experiences.filter((experience) => {
    if (destinationId && !experience.destinationIds.includes(destinationId)) return false;
    return !term || normalizeSearchText(experience.title).includes(term);
  });
}

export function findExperience(index: SearchIndex, slug: string): SearchExperience | null {
  return index.experiences.find((experience) => experience.slug === slug) ?? null;
}

export function getAvailableMonths(index: SearchIndex, destinationId: string, slug = ''): string[] {
  const months = new Set<string>();
  for (const experience of index.experiences) {
    if (slug && experience.slug !== slug) continue;
    if (destinationId && !experience.destinationIds.includes(destinationId)) continue;
    experience.months.forEach((month) => months.add(month));
  }
  return [...months].sort();
}

export function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month) return yyyyMm;
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildSearchHref(params: { destinationLabel?: string; month?: string; slug?: string }): string {
  const slug = String(params.slug ?? '').trim();
  if (slug) return `/experiencia/${encodeURIComponent(slug)}`;
  const query = new URLSearchParams();
  const destination = String(params.destinationLabel ?? '').trim();
  const month = String(params.month ?? '').trim();
  if (destination) query.set('destino', destination);
  if (month) query.set('mes', month);
  const qs = query.toString();
  return qs ? `/experiencias?${qs}` : '/experiencias';
}
