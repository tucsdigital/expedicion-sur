import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  _context: { params: Promise<{ cartId: string }> }
) {
  return legacyDisabledResponse({
    error: 'La búsqueda de órdenes por carrito fue desactivada en Expedicion Sur porque el flujo de carrito ya no existe.',
    code: 'LEGACY_CART_DISABLED',
  });
}
