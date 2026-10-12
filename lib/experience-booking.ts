/** Funciones de reservas expuestas con la terminología canónica del catálogo. */
import {
  getPackageAddonOptions,
  getPackageAddonExtraSelections,
  getSeatLayoutExtraOptions,
  resolveReservationExtraSelections,
  computeReservationPricing,
  getOperationalDepartureDates,
  resolveDepartureConfig,
} from '@/lib/packages/resolve-departure';

export const getExperienceAddonOptions = getPackageAddonOptions;
export const getExperienceAddonExtraSelections = getPackageAddonExtraSelections;
export const getExperienceSeatExtraOptions = getSeatLayoutExtraOptions;
export const computeExperiencePricing = computeReservationPricing;
export const getExperienceDepartureDates = getOperationalDepartureDates;
export const resolveExperienceDepartureConfig = resolveDepartureConfig;

export function resolveExperienceExtraSelections(
  params: Omit<Parameters<typeof resolveReservationExtraSelections>[0], 'paquete'> & {
    experiencia: Parameters<typeof resolveReservationExtraSelections>[0]['paquete'];
  }
) {
  const { experiencia, ...rest } = params;
  return resolveReservationExtraSelections({ paquete: experiencia, ...rest });
}
