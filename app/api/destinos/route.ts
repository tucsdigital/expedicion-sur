import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import type { Categoria } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  const q = query(collection(db, 'categorias'), where('activa', '==', true), orderBy('orden', 'asc'));
  const snap = await getDocs(q);
  const destinos = snap.docs.map((doc) => {
    const data = serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() });
    return {
      id: data.id,
      nombre: data.nombre,
      slug: data.slug,
      descripcion: data.descripcion || '',
      imagen: data.imagen || '',
    };
  });
  return NextResponse.json({ destinos });
}

