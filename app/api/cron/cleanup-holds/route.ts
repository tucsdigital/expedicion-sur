import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export const runtime = 'nodejs';

export async function POST() {
  return legacyDisabledResponse({
    error: 'La limpieza de holds legacy fue desactivada en Expedicion Sur porque el flujo de carrito, stock y butacas ya no existe.',
    code: 'LEGACY_HOLDS_DISABLED',
  });
}
