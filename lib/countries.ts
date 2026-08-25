import es from 'i18n-iso-countries/langs/es.json';

export type Country = { code: string; name: string };

const countriesMap = (es as unknown as { locale: string; countries: Record<string, string | string[]> }).countries;

export function getSpanishCountries(): Country[] {
  return Object.entries(countriesMap)
    .map(([code, value]) => ({ code, name: Array.isArray(value) ? value[0] : value }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
