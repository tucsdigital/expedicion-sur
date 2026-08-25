type GenericErrors = Record<string, unknown>;

function isLeafError(value: unknown): value is { message?: string; type?: string } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ('message' in (value as Record<string, unknown>) || 'type' in (value as Record<string, unknown>))
  );
}

export function countFormErrors(errors: GenericErrors | undefined | null): number {
  if (!errors || typeof errors !== 'object') return 0;

  let count = 0;
  for (const value of Object.values(errors)) {
    if (!value) continue;
    if (isLeafError(value)) {
      count += 1;
      continue;
    }
    if (Array.isArray(value)) {
      count += value.reduce((acc, item) => acc + countFormErrors(item as GenericErrors), 0);
      continue;
    }
    if (typeof value === 'object') {
      count += countFormErrors(value as GenericErrors);
    }
  }
  return count;
}

export function collectFormErrorMessages(errors: GenericErrors | undefined | null): Array<{ path: string; message: string }> {
  if (!errors || typeof errors !== 'object') return [];

  const results: Array<{ path: string; message: string }> = [];

  const visit = (value: unknown, path = '') => {
    if (!value) return;

    if (isLeafError(value)) {
      const message = typeof value.message === 'string' ? value.message.trim() : '';
      if (message) {
        results.push({ path, message });
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, path ? `${path}.${index}` : String(index));
      });
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value as GenericErrors).forEach(([key, nested]) => {
        visit(nested, path ? `${path}.${key}` : key);
      });
    }
  };

  visit(errors);
  return results;
}

export function findFirstErrorPath(errors: GenericErrors | undefined | null, prefix = ''): string | null {
  if (!errors || typeof errors !== 'object') return null;

  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (isLeafError(value)) {
      return currentPath;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const nested = value[index];
        if (!nested) continue;
        if (isLeafError(nested)) {
          return `${currentPath}.${index}`;
        }
        const nestedPath = findFirstErrorPath(nested as GenericErrors, `${currentPath}.${index}`);
        if (nestedPath) return nestedPath;
      }
      continue;
    }

    if (typeof value === 'object') {
      const nestedPath = findFirstErrorPath(value as GenericErrors, currentPath);
      if (nestedPath) return nestedPath;
    }
  }

  return null;
}

const FIELD_TARGETS: Record<string, string> = {
  titulo: '#titulo',
  descripcionCorta: '#descripcionCorta',
  descripcion: '#descripcion-editor',
  itinerarioSteps: '#itinerario-section',
  mapaGoogleEmbedUrl: '#mapaGoogleEmbedUrl',
  duracion: '#duracion',
  categoriaIds: '#categorias-section',
  tipos: '#tipos-section',
  precio: '#precio',
  tarifaEspecialPrecio: '#tarifaEspecialPrecio',
  tarifaEspecialFechaLimite: '#tarifaEspecialFechaLimite',
  maxPersonasPorReserva: '#maxPersonasPorReserva',
};

const FIELD_LABELS: Record<string, string> = {
  titulo: 'Titulo',
  descripcionCorta: 'Descripcion corta',
  descripcion: 'Descripcion completa',
  itinerarioSteps: 'Itinerario',
  mapaGoogleEmbedUrl: 'Google Maps',
  duracion: 'Duracion',
  categoriaIds: 'Categorias',
  tipos: 'Tipo',
  precio: 'Precio',
  tarifaEspecialPrecio: 'Tarifa especial',
  tarifaEspecialFechaLimite: 'Fecha limite',
  maxPersonasPorReserva: 'Maximo de personas por reserva',
};

export function getFieldLabelFromPath(path: string | null | undefined) {
  if (!path) return '';
  const topLevelKey = path.replace(/\.\d+/g, '').split('.')[0];
  return FIELD_LABELS[topLevelKey] ?? topLevelKey;
}

export function scrollToFormTarget(pathOrSelector: string | null | undefined) {
  if (typeof document === 'undefined' || !pathOrSelector) return;

  const topLevelKey = pathOrSelector.replace(/\.\d+/g, '').split('.')[0];
  const selector =
    pathOrSelector.startsWith('#') || pathOrSelector.startsWith('.')
      ? pathOrSelector
      : FIELD_TARGETS[topLevelKey] ?? `[name="${pathOrSelector}"], [name="${topLevelKey}"], #${topLevelKey}`;

  const target = document.querySelector(selector);
  if (!(target instanceof HTMLElement)) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    if (typeof (target as HTMLInputElement).focus === 'function') {
      (target as HTMLInputElement).focus({ preventScroll: true });
    }
  }, 120);
}
