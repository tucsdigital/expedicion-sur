import type { Categoria, Paquete } from '@/types';

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getPackageCategoryIds(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>): string[] {
  const unique = new Set<string>();

  const primary = normalizeId(paquete.categoriaId);
  if (primary) unique.add(primary);

  if (Array.isArray(paquete.categoriaIds)) {
    for (const categoriaId of paquete.categoriaIds) {
      const normalized = normalizeId(categoriaId);
      if (normalized) unique.add(normalized);
    }
  }

  return Array.from(unique);
}

export function normalizePackageCategoryIds(categoryIds: string[], categoriaId?: string | null): string[] {
  return getPackageCategoryIds({
    categoriaIds: Array.isArray(categoryIds) ? categoryIds : [],
    categoriaId: categoriaId ?? undefined,
  });
}

export function getPrimaryPackageCategoryId(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>): string | null {
  return getPackageCategoryIds(paquete)[0] ?? null;
}

export function packageHasCategory(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>, categoriaId: string): boolean {
  const normalized = normalizeId(categoriaId);
  if (!normalized) return false;
  return getPackageCategoryIds(paquete).includes(normalized);
}

export function resolvePackageCategoryIds(
  paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds' | 'destino' | 'eventoLugar'>,
  categorias: Categoria[]
): string[] {
  const byId = new Map<string, string>();
  const bySlug = new Map<string, string>();
  const byNombre = new Map<string, string>();

  for (const categoria of categorias) {
    const id = normalizeId(categoria.id);
    if (!id) continue;
    byId.set(id, id);

    const slug = normalizeText(categoria.slug);
    if (slug) bySlug.set(slug, id);

    const nombre = normalizeText(categoria.nombre);
    if (nombre) byNombre.set(nombre, id);
  }

  const candidates = [
    normalizeId(paquete.categoriaId),
    ...(Array.isArray(paquete.categoriaIds) ? paquete.categoriaIds.map((item) => normalizeId(item)) : []),
    normalizeText(paquete.destino),
    normalizeText(paquete.eventoLugar),
  ].filter(Boolean);

  const resolved = new Set<string>();

  for (const candidate of candidates) {
    const directId = byId.get(candidate);
    if (directId) {
      resolved.add(directId);
      continue;
    }

    const bySlugMatch = bySlug.get(normalizeText(candidate));
    if (bySlugMatch) {
      resolved.add(bySlugMatch);
      continue;
    }

    const byNameMatch = byNombre.get(normalizeText(candidate));
    if (byNameMatch) {
      resolved.add(byNameMatch);
    }
  }

  return Array.from(resolved);
}

export function syncPackageCategoryData(
  paquete: Paquete,
  categorias: Categoria[]
): Paquete {
  const resolvedIds = resolvePackageCategoryIds(paquete, categorias);
  if (resolvedIds.length === 0) return paquete;

  const primaryCategoria = categorias.find((categoria) => categoria.id === resolvedIds[0]);
  const nextDestino = primaryCategoria?.nombre?.trim() || paquete.destino;

  return {
    ...paquete,
    categoriaId: resolvedIds[0],
    categoriaIds: resolvedIds,
    destino: nextDestino,
  };
}
