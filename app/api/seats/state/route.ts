import { legacyDisabledResponse } from '@/lib/legacy-disabled';

export const runtime = 'nodejs';

export async function GET() {
  return legacyDisabledResponse({
    error: 'La consulta de butacas fue desactivada en Expedicion Sur porque los paquetes no usan micros ni selección de asientos.',
    code: 'LEGACY_SEATS_DISABLED',
  });
}
