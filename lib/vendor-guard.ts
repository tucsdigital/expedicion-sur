import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { VENDORS_COLLECTION } from '@/lib/vendor-admin';

export type VendorContext = {
  db: FirebaseFirestore.Firestore;
  vendorId: string;
  vendor: Record<string, any>;
  email: string;
  allowedExperiences: string[] | null;
};

/** Verifica el token del vendedor y devuelve su documento (solo vendedores activos). */
export async function guardVendor(request: Request): Promise<VendorContext | NextResponse> {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin no está configurado en el servidor.' }, { status: 500 });
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = String(decoded.email ?? '').toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Sesión inválida. Volvé a iniciar sesión.' }, { status: 401 });
  }

  const col = adminDb.collection(VENDORS_COLLECTION);
  let snap = await col.where('authUid', '==', uid).limit(1).get();
  if (snap.empty && email) snap = await col.where('email', '==', email).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return NextResponse.json({ error: 'No estás registrado como vendedor.' }, { status: 403 });
  const vendor = doc.data();
  if (!vendor.active) return NextResponse.json({ error: 'Tu cuenta de vendedor está deshabilitada.' }, { status: 403 });

  const allowed = vendor.allowedExperiences ?? vendor.allowedPackages;
  return {
    db: adminDb,
    vendorId: doc.id,
    vendor,
    email: String(vendor.email ?? email),
    allowedExperiences: Array.isArray(allowed) && allowed.length > 0 ? allowed.map(String) : null,
  };
}

/** Convierte Timestamps/Date de Firestore a ISO para poder serializar a JSON. */
export function toJson<T = any>(value: any): T {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString() as any;
  if (Array.isArray(value)) return value.map(toJson) as any;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)])) as any;
  }
  return value;
}
