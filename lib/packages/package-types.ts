export type ExcursionTypeOption = {
  id: string;
  value: string;
  label: string;
};

export function normalizeExcursionTypeValue(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizePackageTypes(input: unknown): string[] {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeExcursionTypeValue(value))
        .filter(Boolean)
    )
  );
}

export function humanizeExcursionType(value: unknown): string {
  const normalized = normalizeExcursionTypeValue(value);
  if (!normalized) return '';

  return normalized
    .split('-')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}
