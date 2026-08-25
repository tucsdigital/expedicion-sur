import { Timestamp, addDoc, collection, getDocs, onSnapshot, orderBy, query, where, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Categoria } from '@/types';
import {
  humanizeExcursionType,
  normalizeExcursionTypeValue,
  normalizePackageTypes,
  type ExcursionTypeOption,
} from '@/lib/packages/package-types';

export async function fetchActiveCategorias(): Promise<Categoria[]> {
  const categoriasQuery = query(collection(db, 'categorias'), where('activa', '==', true));
  const categoriasSnapshot = await getDocs(categoriasQuery);
  return categoriasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
}

export async function countFeaturedPackages(excludeId?: string): Promise<number> {
  const paquetesQuery = query(collection(db, 'paquetes'), where('destacado', '==', true));
  const paquetesSnapshot = await getDocs(paquetesQuery);
  if (!excludeId) return paquetesSnapshot.size;
  return paquetesSnapshot.docs.filter((doc) => doc.id !== excludeId).length;
}

export async function fetchExcursionTypes(): Promise<ExcursionTypeOption[]> {
  const [typesSnapshot, packagesSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'excursionTypes'), orderBy('label', 'asc'))),
    getDocs(collection(db, 'paquetes')),
  ]);
  return mergeExcursionTypeOptions(
    mapExcursionTypesSnapshot(typesSnapshot),
    mapPackageTypesSnapshot(packagesSnapshot)
  );
}

function mapExcursionTypesSnapshot(snapshot: QuerySnapshot<DocumentData>): ExcursionTypeOption[] {
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as { label?: unknown; value?: unknown; active?: unknown };
      if (data.active === false) return null;

      const label = String(data.label ?? '').trim();
      const value = normalizeExcursionTypeValue(data.value ?? label);
      if (!label || !value) return null;

      return {
        id: doc.id,
        label,
        value,
      } satisfies ExcursionTypeOption;
    })
    .filter((item): item is ExcursionTypeOption => Boolean(item));
}

function mapPackageTypesSnapshot(snapshot: QuerySnapshot<DocumentData>): ExcursionTypeOption[] {
  const allValues = snapshot.docs.flatMap((packageDoc) => {
    const data = packageDoc.data() as { tipos?: unknown; tipo?: unknown };
    return normalizePackageTypes(Array.isArray(data.tipos) && data.tipos.length > 0 ? data.tipos : [data.tipo]);
  });

  return Array.from(new Set(allValues))
    .map((value) => ({
      id: `package-${value}`,
      value,
      label: humanizeExcursionType(value) || value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function mergeExcursionTypeOptions(
  firestoreTypes: ExcursionTypeOption[],
  packageTypes: ExcursionTypeOption[]
): ExcursionTypeOption[] {
  const merged = new Map<string, ExcursionTypeOption>();

  for (const item of packageTypes) {
    merged.set(item.value, item);
  }

  for (const item of firestoreTypes) {
    merged.set(item.value, item);
  }

  return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function subscribeExcursionTypes(
  onChange: (items: ExcursionTypeOption[]) => void,
  onError?: (error: Error) => void
) {
  const typesQuery = query(collection(db, 'excursionTypes'), orderBy('label', 'asc'));
  let currentFirestoreTypes: ExcursionTypeOption[] = [];
  let currentPackageTypes: ExcursionTypeOption[] = [];

  const emit = () => {
    onChange(mergeExcursionTypeOptions(currentFirestoreTypes, currentPackageTypes));
  };

  const unsubscribeTypes = onSnapshot(
    typesQuery,
    (snapshot) => {
      currentFirestoreTypes = mapExcursionTypesSnapshot(snapshot);
      emit();
    },
    (error) => {
      onError?.(error);
    }
  );

  const unsubscribePackages = onSnapshot(
    collection(db, 'paquetes'),
    (snapshot) => {
      currentPackageTypes = mapPackageTypesSnapshot(snapshot);
      emit();
    },
    (error) => {
      onError?.(error);
    }
  );

  return () => {
    unsubscribeTypes();
    unsubscribePackages();
  };
}

export async function createExcursionType(label: string): Promise<ExcursionTypeOption> {
  const normalizedLabel = String(label ?? '').trim();
  const normalizedValue = normalizeExcursionTypeValue(normalizedLabel);

  if (!normalizedLabel || !normalizedValue) {
    throw new Error('Debes ingresar un tipo válido.');
  }

  const existingTypes = await fetchExcursionTypes();
  const existing = existingTypes.find((item) => item.value === normalizedValue);
  if (existing) return existing;

  const ref = await addDoc(collection(db, 'excursionTypes'), {
    label: normalizedLabel,
    value: normalizedValue,
    active: true,
    createdAt: Timestamp.now(),
  });

  return {
    id: ref.id,
    label: normalizedLabel,
    value: normalizedValue,
  };
}
