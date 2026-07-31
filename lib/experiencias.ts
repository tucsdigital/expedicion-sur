import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  Timestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { assertFirebaseEnabled, db, firebaseEnabled } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import type { Experience, BookingPublicData } from '@/components/landing-reserva/types';

const COLLECTION = 'experiencias';

/** Límite por defecto para listados (evita traer más docs de los necesarios) */
const DEFAULT_LIST_LIMIT = 12;

export type ExperienceInput = Omit<Experience, 'id'> & { id?: string };

/** Firestore no acepta undefined. Eliminamos campos undefined del payload. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      out[key] = stripUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value
        .filter((item) => item !== undefined)
        .map((item) =>
          item !== null && typeof item === 'object' && !(item instanceof Timestamp)
            ? stripUndefined(item as Record<string, unknown>)
            : item
        );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function mapDocToExperience(docSnap: DocumentSnapshot): Experience | null {
  const data = docSnap.data();
  if (!data) return null;
  return serializeFirestoreData<Experience>({ id: docSnap.id, ...data });
}

/** Obtiene todas las experiencias (admin: todas; público: solo visibles ordenadas). Sin limit explícito, público usa 12 y admin sin límite. */
export async function getExperiencias(options: { visibleOnly?: boolean; limit?: number } = {}): Promise<Experience[]> {
  if (!firebaseEnabled) return [];
  const { visibleOnly = false, limit: limitOption } = options;
  const maxItems = limitOption !== undefined ? limitOption : (visibleOnly ? DEFAULT_LIST_LIMIT : 0);
  try {
    const baseQuery = visibleOnly
      ? query(
          collection(db, COLLECTION),
          where('visible', '==', true),
          firestoreOrderBy('orden', 'asc'),
          ...(maxItems > 0 ? [firestoreLimit(maxItems)] : [])
        )
      : query(collection(db, COLLECTION), firestoreOrderBy('orden', 'asc'));
    const snapshot = await getDocs(baseQuery);
    let list = snapshot.docs.map((d) => serializeFirestoreData<Experience>({ id: d.id, ...d.data() }));
    if (!visibleOnly && maxItems > 0) list = list.slice(0, maxItems);
    return list;
  } catch {
    const snapshot = await getDocs(collection(db, COLLECTION));
    let list = snapshot.docs.map((d) => serializeFirestoreData<Experience>({ id: d.id, ...d.data() }));
    list = list.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    if (visibleOnly) list = list.filter((e) => e.visible !== false);
    if (maxItems > 0) list = list.slice(0, maxItems);
    return list;
  }
}

/** Obtiene una experiencia por slug (para la página pública /experiencias/[slug]) */
export async function getExperienciaBySlug(slug: string): Promise<Experience | null> {
  if (!firebaseEnabled) return null;
  const q = query(collection(db, COLLECTION), where('slug', '==', slug), firestoreLimit(1));
  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];
  if (!first) return null;
  return mapDocToExperience(first);
}

/** Devuelve los datos públicos del bloque reserva para el front. Si se pasa reservedByDate (personas ya reservadas por fecha), available = capacity - reservadas. */
export function toBookingPublicData(
  exp: Experience,
  reservedByDate?: Record<string, number>
): BookingPublicData | null {
  const bc = exp.bookingConfig;
  if (bc) {
    const dates = [...(bc.dates || [])]
      .filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const capacity = Math.max(0, d.capacity);
        const reserved = reservedByDate?.[d.date] ?? 0;
        const available = Math.max(0, capacity - reserved);
        return {
          date: d.date,
          capacity,
          available,
          enabled: !!d.enabled,
        };
      });
    const currency = (bc.currency === 'brl' || bc.currency === 'usd') ? bc.currency : 'ars';
    return {
      enabled: !!bc.enabled,
      title: (bc.title ?? '').trim(),
      subtitle1: (bc.subtitle1 ?? '').trim(),
      subtitle2: (bc.subtitle2 ?? '').trim(),
      hasSpecificDates: !!bc.hasSpecificDates,
      dates,
      depositAmount: typeof bc.depositAmount === 'number' ? Math.max(0, bc.depositAmount) : 0,
      maxPeoplePerBooking: typeof bc.maxPeoplePerBooking === 'number'
        ? Math.max(1, Math.min(50, bc.maxPeoplePerBooking))
        : undefined,
      currency,
      paymentMethods: {
        stripe: !!(bc.paymentMethods?.stripe),
        pix: !!(bc.paymentMethods?.pix),
      },
    };
  }
  const legacyDates = (exp.availableDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const dates = legacyDates.map((date) => {
    const reserved = reservedByDate?.[date] ?? 0;
    const available = Math.max(0, 1 - reserved);
    return { date, capacity: 1, available, enabled: true };
  });
  return {
    enabled: true,
    title: '',
    subtitle1: (exp.calendarIntro ?? '').trim(),
    subtitle2: (exp.reservationMicrocopy ?? '').trim(),
    hasSpecificDates: legacyDates.length > 0,
    dates,
    depositAmount: typeof exp.price === 'number' ? Math.max(0, exp.price) : 0,
    maxPeoplePerBooking: typeof exp.maxPeople === 'number' ? Math.max(1, Math.min(50, exp.maxPeople)) : undefined,
    currency: 'ars',
    paymentMethods: {
      stripe: Array.isArray(exp.paymentMethods) ? exp.paymentMethods.includes('stripe') : true,
      pix: Array.isArray(exp.paymentMethods) ? exp.paymentMethods.includes('pix') : false,
    },
  };
}

/** Obtiene una experiencia por id (admin) */
export async function getExperienciaById(id: string): Promise<Experience | null> {
  if (!firebaseEnabled) return null;
  const ref = doc(db, COLLECTION, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return mapDocToExperience(snapshot);
}

/** Payload para crear en Firestore (sin id; sin undefined; con fechaCreacion y updatedAt) */
function toCreatePayload(data: ExperienceInput): Record<string, unknown> {
  const { id: _id, ...rest } = data as ExperienceInput & { id?: string };
  return stripUndefined({ ...rest, fechaCreacion: Timestamp.now(), updatedAt: Timestamp.now() });
}

/** Crea una experiencia en Firestore. Retorna el id del documento creado. */
export async function createExperiencia(data: ExperienceInput): Promise<string> {
  assertFirebaseEnabled('createExperiencia');
  const payload = toCreatePayload(data);
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/** Actualiza una experiencia por id. Solo se envían los campos presentes en data. */
export async function updateExperiencia(id: string, data: Partial<ExperienceInput>): Promise<void> {
  assertFirebaseEnabled('updateExperiencia');
  const ref = doc(db, COLLECTION, id);
  const { id: _id, ...rest } = data as Partial<ExperienceInput> & { id?: string };
  const payload = stripUndefined({ ...rest, updatedAt: Timestamp.now() });
  await updateDoc(ref, payload);
}

/** Elimina una experiencia por id. */
export async function deleteExperiencia(id: string): Promise<void> {
  assertFirebaseEnabled('deleteExperiencia');
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}
