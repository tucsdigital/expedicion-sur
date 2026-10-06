export type CountryOption = {
  /** Código ISO 3166-1 alpha-2 */
  code: string;
  /** Nombre en español (valor de nacionalidad guardado en la reserva) */
  name: string;
  /** Prefijo telefónico internacional, ej: +54 */
  dialCode: string;
  /** Emoji de bandera para la UI */
  flag: string;
};

/**
 * Listado de países usado para el selector de nacionalidad del pasajero principal.
 * Argentina primero (mercado principal), luego América y el resto del mundo.
 */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { code: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺' },
  { code: 'DO', name: 'República Dominicana', dialCode: '+1', flag: '🇩🇴' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', dialCode: '+507', flag: '🇵🇦' },
  { code: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦' },
  { code: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { code: 'DE', name: 'Alemania', dialCode: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'NL', name: 'Países Bajos', dialCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', dialCode: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suiza', dialCode: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'PL', name: 'Polonia', dialCode: '+48', flag: '🇵🇱' },
  { code: 'RU', name: 'Rusia', dialCode: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ucrania', dialCode: '+380', flag: '🇺🇦' },
  { code: 'RO', name: 'Rumania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'GR', name: 'Grecia', dialCode: '+30', flag: '🇬🇷' },
  { code: 'IE', name: 'Irlanda', dialCode: '+353', flag: '🇮🇪' },
  { code: 'SE', name: 'Suecia', dialCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega', dialCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca', dialCode: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finlandia', dialCode: '+358', flag: '🇫🇮' },
  { code: 'CZ', name: 'Chequia', dialCode: '+420', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungría', dialCode: '+36', flag: '🇭🇺' },
  { code: 'TR', name: 'Turquía', dialCode: '+90', flag: '🇹🇷' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'JP', name: 'Japón', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'Corea del Sur', dialCode: '+82', flag: '🇰🇷' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'Nueva Zelanda', dialCode: '+64', flag: '🇳🇿' },
  { code: 'ZA', name: 'Sudáfrica', dialCode: '+27', flag: '🇿🇦' },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱' },
  { code: 'AE', name: 'Emiratos Árabes Unidos', dialCode: '+971', flag: '🇦🇪' },
];

/** País por defecto del checkout (mercado principal). */
export const DEFAULT_COUNTRY_NAME = 'Argentina';

/** Listado ordenado alfabéticamente (es) para mostrar en los selectores. */
export function getSortedCountryOptions(): CountryOption[] {
  return [...COUNTRY_OPTIONS].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function getCountryByName(name: string | null | undefined): CountryOption | null {
  const normalized = String(name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return (
    COUNTRY_OPTIONS.find((country) => country.name.toLowerCase() === normalized) ??
    COUNTRY_OPTIONS.find((country) => country.code.toLowerCase() === normalized) ??
    null
  );
}

export function getCountryDialCode(name: string | null | undefined): string {
  return getCountryByName(name)?.dialCode ?? '';
}

/** Detecta el prefijo internacional al inicio de un teléfono, ej: "+598 99..." → "+598". */
export function detectPhoneDialPrefix(phone: string): string | null {
  const value = String(phone ?? '').trim();
  if (!value.startsWith('+')) return null;
  const candidates = [...new Set(COUNTRY_OPTIONS.map((country) => country.dialCode))].sort(
    (a, b) => b.length - a.length
  );
  for (const candidate of candidates) {
    if (value.startsWith(candidate)) return candidate;
  }
  const plusToken = value.match(/^\+\d{1,4}/);
  return plusToken ? plusToken[0] : null;
}

/**
 * Completa/reemplaza automáticamente el prefijo del teléfono según la nacionalidad elegida.
 * - Teléfono vacío → "<prefijo> "
 * - Teléfono con prefijo reconocido → reemplaza el prefijo y conserva el resto
 * - Teléfono local sin "+" → antepone el prefijo
 */
export function applyPhonePrefix(phone: string, dialCode: string): string {
  const safeDial = String(dialCode ?? '').trim() || '';
  if (!safeDial) return phone;
  const current = String(phone ?? '').trim();
  if (!current) return `${safeDial} `;
  const existingPrefix = detectPhoneDialPrefix(current);
  if (existingPrefix) {
    const rest = current.slice(existingPrefix.length).replace(/^\s+/, '');
    return `${safeDial} ${rest}`.trim();
  }
  return `${safeDial} ${current}`.trim();
}
