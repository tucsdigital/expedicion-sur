import type { Paquete } from '@/types';

export const PAQUETE_TIPO_VALUES = [
  'individual',
  'grupal',
  'a-medida',
  'internacional',
  'educativo',
  'eventos',
  'recitales',
  'excursion',
  'navegacion',
  'kayak',
  '4x4',
  'trekking',
  'cabalgata',
  'tirolesa',
] as const;

export const PAQUETE_TIPO_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'grupal', label: 'Grupal' },
  { value: 'a-medida', label: 'A Medida' },
  { value: 'internacional', label: 'Internacional' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'recitales', label: 'Recitales' },
  { value: 'excursion', label: 'Excursión' },
  { value: 'navegacion', label: 'Navegación' },
  { value: 'kayak', label: 'Kayak' },
  { value: '4x4', label: '4x4' },
  { value: 'trekking', label: 'Trekking' },
  { value: 'cabalgata', label: 'Cabalgata' },
  { value: 'tirolesa', label: 'Tirolesa' },
] as const;

export const PAQUETE_TIPO_LABELS: Record<(typeof PAQUETE_TIPO_VALUES)[number], string> =
  Object.fromEntries(PAQUETE_TIPO_OPTIONS.map((item) => [item.value, item.label])) as Record<
    (typeof PAQUETE_TIPO_VALUES)[number],
    string
  >;

export function getPaqueteTipoLabel(tipo?: string | null): string {
  if (!tipo) return 'Excursión';
  return PAQUETE_TIPO_LABELS[tipo as (typeof PAQUETE_TIPO_VALUES)[number]] ?? tipo;
}

type TarifaEspecialInput = Pick<Paquete, 'precio' | 'precioDescuentoPrimerosCupos' | 'tarifaEspecialFechaLimite'>;

export function getTarifaEspecialData(paquete: TarifaEspecialInput) {
  const precioEspecial =
    typeof paquete.precioDescuentoPrimerosCupos === 'number' && paquete.precioDescuentoPrimerosCupos > 0
      ? paquete.precioDescuentoPrimerosCupos
      : null;

  if (!precioEspecial) {
    return {
      configurada: false,
      activa: false,
      precioEspecial: null,
      fechaLimite: null,
      fechaLimiteLabel: '',
      vencida: false,
    };
  }

  const fechaLimite = paquete.tarifaEspecialFechaLimite?.trim() || null;
  const fechaLimiteDate = fechaLimite ? new Date(`${fechaLimite}T23:59:59`) : null;
  const fechaValida = Boolean(fechaLimiteDate && !Number.isNaN(fechaLimiteDate.getTime()));
  const vencida = Boolean(fechaValida && fechaLimiteDate && Date.now() > fechaLimiteDate.getTime());

  return {
    configurada: true,
    activa: !vencida,
    precioEspecial,
    fechaLimite,
    fechaLimiteLabel:
      fechaValida && fechaLimiteDate
        ? fechaLimiteDate.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '',
    vencida,
  };
}
