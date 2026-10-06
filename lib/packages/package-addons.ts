import * as z from 'zod';

export const MAX_PACKAGE_ADDONS = 20;

export type AddonFormItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  /** URL pública o dataURL temporal en edición. */
  image: string;
  /** Clave del blob en storage (solo URLs ya subidas). */
  imageKey?: string | null;
  enabled: boolean;
};

export const packageAddonSchema = z.object({
  id: z.string().min(1, 'Falta el identificador del adicional'),
  title: z
    .string()
    .min(1, 'Falta el título del adicional')
    .max(80, 'El título es demasiado largo')
    .transform((val) => String(val ?? '').trim()),
  description: z
    .string()
    .max(400, 'La descripción es demasiado larga')
    .optional()
    .or(z.literal(''))
    .transform((val) => String(val ?? '').trim()),
  price: z
    .number()
    .min(0, 'El precio debe ser mayor o igual a 0')
    .max(999999999, 'El precio es demasiado alto')
    .transform((val) => Number(val) || 0),
  image: z
    .string()
    .max(20000, 'La imagen es demasiado pesada')
    .optional()
    .or(z.literal(''))
    .transform((val) => String(val ?? '').trim()),
  imageKey: z.string().optional().nullable(),
  enabled: z.boolean().transform((val) => Boolean(val)),
});

export const packageAddonsSchema = z
  .array(packageAddonSchema)
  .max(MAX_PACKAGE_ADDONS, `Máximo ${MAX_PACKAGE_ADDONS} adicionales por excursión`)
  .optional()
  .default([]);

export type PackageAddonFormData = z.infer<typeof packageAddonsSchema>;

export function createEmptyAddon(): AddonFormItem {
  return {
    id: `addon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    description: '',
    price: 0,
    image: '',
    imageKey: null,
    enabled: true,
  };
}

function normalizeAddonImageKey(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

/** Normaliza adicionales crudos (Firestore) al formato del editor. */
export function normalizePackageAddons(raw: unknown): AddonFormItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: AddonFormItem[] = [];
  for (const entry of raw.slice(0, MAX_PACKAGE_ADDONS)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id =
      String(record.id ?? '').trim() ||
      `addon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: String(record.title ?? record.titulo ?? '').trim(),
      description: String(record.description ?? record.descripcion ?? '').trim(),
      price: Math.max(0, Number(record.price ?? record.precio ?? 0) || 0),
      image: String(record.image ?? record.imagen ?? '').trim(),
      imageKey: normalizeAddonImageKey(record.imageKey ?? record.imagenKey),
      enabled: record.enabled !== false,
    });
  }
  return items;
}

/** Payload listo para guardar en Firestore (solo campos válidos). */
export function sanitizePackageAddons(items: AddonFormItem[]): Array<{
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  imageKey: string | null;
  enabled: boolean;
}> {
  return items
    .map((item) => ({
      id: String(item.id ?? '').trim(),
      title: String(item.title ?? '').trim(),
      description: String(item.description ?? '').trim(),
      price: Math.max(0, Number(item.price ?? 0) || 0),
      image: String(item.image ?? '').trim(),
      imageKey: normalizeAddonImageKey(item.imageKey),
      enabled: Boolean(item.enabled),
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.title) && item.price > 0);
}
