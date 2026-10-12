import {
  addDoc,
  collection,
  getDocs,
  limit as firestoreLimit,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';

export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'reserva';

export type StockMovementInput = {
  experienceId?: string;
  /** Compatibilidad de lectura/escritura temporal con movimientos históricos. */
  packageId?: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  author: string;
  note?: string;
  referenceId?: string;
  /** Auditoría: cupo base al momento del movimiento (si aplica). */
  baseCapacityAtThatTime?: number;
  /** Auditoría: monto asociado a la reserva */
  amountTotal?: number;
  currency?: string;
};

export type StockMovement = StockMovementInput & {
  id: string;
  createdAt: object;
};

const COLLECTION = 'stockMovimientos';

export async function registrarMovimientoStock(data: StockMovementInput): Promise<string> {
  const experienceId = String(data.experienceId ?? data.packageId ?? '').trim();
  if (!experienceId) throw new Error('Falta el identificador de la experiencia para registrar cupo.');
  const timestamp = Timestamp.now();
  const { packageId: _legacyPackageId, ...rest } = data;
  const payload = { ...rest, experienceId, createdAt: timestamp };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

export async function getMovimientosStock(
  experienceId: string,
  options: { date?: string; limit?: number } = {}
): Promise<StockMovement[]> {
  const readByField = async (field: 'experienceId' | 'packageId') => {
    const constraints: ReturnType<typeof where>[] = [where(field, '==', experienceId)];
    if (options.date) constraints.push(where('date', '==', options.date));
    const q = query(collection(db, COLLECTION), ...constraints);
    return getDocs(q);
  };
  const [modern, legacy] = await Promise.all([
    readByField('experienceId').catch(() => null),
    readByField('packageId').catch(() => null),
  ]);
  const docs = new Map<string, any>();
  for (const snapshot of [modern, legacy]) {
    snapshot?.docs.forEach((item: any) => docs.set(item.id, item));
  }
  return Array.from(docs.values())
    .map((d: any) => serializeFirestoreData<StockMovement>({ id: d.id, ...d.data(), experienceId: d.data().experienceId ?? d.data().packageId }))
    .sort((a: any, b: any) => {
      const aDate = a.createdAt?.toDate?.() ?? new Date(a.createdAt as any);
      const bDate = b.createdAt?.toDate?.() ?? new Date(b.createdAt as any);
      return bDate.getTime() - aDate.getTime();
    })
    .slice(0, options.limit && options.limit > 0 ? options.limit : undefined);
}

export async function getStockDisponible(
  experienceId: string,
  date: string,
  baseCapacity: number
): Promise<number> {
  const movements = await getMovimientosStock(experienceId, { date });
  const delta = movements.reduce((sum, movement) => sum + movement.quantity, 0);
  return Math.max(0, baseCapacity + delta);
}
