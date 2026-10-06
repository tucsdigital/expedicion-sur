import messages from '@/messages/es.json';

type Values = Record<string, string | number>;

function lookup(namespace: string, key: string): string {
  const path = `${namespace}.${key}`.split('.');
  let cursor: any = messages;
  for (const part of path) {
    cursor = cursor?.[part];
    if (cursor === undefined) return `${namespace}.${key}`;
  }
  return typeof cursor === 'string' ? cursor : `${namespace}.${key}`;
}

function format(template: string, values?: Values): string {
  if (!values) return template;
  let out = template.replace(/\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g, (_m, name, one, other) => {
    const count = Number(values[name] ?? 0);
    return (count === 1 ? one : other).replace(/#/g, String(count));
  });
  out = out.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
  return out;
}

export type Translator = (key: string, values?: Values) => string;

export function createTranslator(namespace: string): Translator {
  return (key, values) => format(lookup(namespace, key), values);
}

export function useTranslations(namespace: string): Translator {
  return createTranslator(namespace);
}

export async function getTranslations(namespace: string): Promise<Translator> {
  return createTranslator(namespace);
}

export function useLocale() {
  return 'es';
}

export async function getLocale() {
  return 'es';
}
