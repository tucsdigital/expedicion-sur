import { collection, getDocs, orderBy as firestoreOrderBy, query, where } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { Categoria, Paquete } from '@/types';

async function fetchVisiblePaquetes() {
  if (!firebaseEnabled) return [] as Paquete[];

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'paquetes'),
        where('visible', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }));
  } catch {
    const snapshot = await getDocs(query(collection(db, 'paquetes'), where('visible', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
}

async function fetchActiveCategorias() {
  if (!firebaseEnabled) return [] as Categoria[];

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'categorias'),
        where('activa', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) =>
      serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() })
    );
  } catch {
    const snapshot = await getDocs(query(collection(db, 'categorias'), where('activa', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
}

export async function getPaquetesPageData() {
  const [paquetes, categorias] = await Promise.all([fetchVisiblePaquetes(), fetchActiveCategorias()]);

  const interestOptions = Array.from(
    new Set(
      paquetes
        .map((paquete) => paquete.titulo?.trim())
        .filter((titulo): titulo is string => Boolean(titulo))
    )
  );

  return {
    paquetes,
    categorias,
    interestOptions,
  };
}
