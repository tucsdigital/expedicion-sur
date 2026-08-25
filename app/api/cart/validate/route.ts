import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export const runtime = 'nodejs';

export async function POST() {
  return legacyDisabledResponse({
    error: 'La validación de carrito fue desactivada en Expedicion Sur. Usá la reserva directa desde el paquete.',
    code: 'LEGACY_CART_DISABLED',
  });
}

