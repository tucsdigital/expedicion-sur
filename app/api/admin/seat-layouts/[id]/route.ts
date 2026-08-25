import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export const runtime = 'nodejs';

export async function GET() {
  return legacyDisabledResponse({
    error: 'Las plantillas de micro fueron desactivadas en Expedicion Sur porque los paquetes ya no usan micros ni selección de butacas.',
    code: 'LEGACY_SEAT_LAYOUTS_DISABLED',
  });
}
