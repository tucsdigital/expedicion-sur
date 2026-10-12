/** Acceso canónico al catálogo comercial de experiencias. */
export {
  getExperiencias,
  getExperienciaById,
  getExperienciaBySlug,
  getAllExperienciasAdmin,
  normalizeExperienciaCatalogo,
  createPaquete as createExperiencia,
  updatePaquete as updateExperiencia,
  deletePaquete as deleteExperiencia,
} from '@/lib/paquetes';
export type { ExperienciaCatalogo } from '@/types';
