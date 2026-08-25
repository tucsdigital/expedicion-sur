import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export async function GET(_request: Request) {
  return legacyDisabledResponse({
    error: 'La gestión de stock fue desactivada en Expedicion Sur porque los paquetes ya no manejan cupos ni reservas de plazas.',
    code: 'LEGACY_STOCK_DISABLED',
  });
}

export async function POST() {
  return legacyDisabledResponse({
    error: 'La gestión de stock fue desactivada en Expedicion Sur porque los paquetes ya no manejan cupos ni reservas de plazas.',
    code: 'LEGACY_STOCK_DISABLED',
  });
}
