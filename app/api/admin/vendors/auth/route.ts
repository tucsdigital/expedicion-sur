import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import {
  VENDORS_COLLECTION,
  errorMessage,
  guardAdmin,
  isValidDni,
  normalizeDni,
  sendVendorAccessEmail,
} from '@/lib/vendor-admin';

export const runtime = 'nodejs';

const schema = z.object({
  action: z.enum(['create', 'reset', 'disable', 'enable']),
  vendorId: z.string().min(1),
});

/**
 * Acciones sobre el acceso de un vendedor ya existente.
 * La contraseña siempre es el DNI guardado en el vendedor.
 * - create: repara/crea el usuario de Auth de un vendedor sin acceso.
 * - reset: vuelve a fijar la contraseña al DNI.
 */
export async function POST(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;
  const { auth, db } = guard;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { action, vendorId } = parsed.data;

  const ref = db.collection(VENDORS_COLLECTION).doc(vendorId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
  const vendor = snap.data() as any;
  const email = String(vendor.email ?? '').toLowerCase();
  const dni = normalizeDni(vendor.normalizedDni ?? vendor.dni);

  try {
    const findUser = async () => {
      const uid = String(vendor.authUid ?? '').trim();
      if (uid) {
        const byUid = await auth.getUser(uid).catch(() => null);
        if (byUid) return byUid;
      }
      return auth.getUserByEmail(email).catch(() => null);
    };

    if (action === 'create' || action === 'reset') {
      if (!isValidDni(dni)) {
        return NextResponse.json({ error: 'El vendedor no tiene un DNI válido (7 u 8 dígitos). Editalo primero.' }, { status: 400 });
      }
      let user = await findUser();
      if (user) {
        await auth.updateUser(user.uid, { password: dni, disabled: false, emailVerified: true });
      } else {
        user = await auth.createUser({ email, password: dni, displayName: vendor.name, emailVerified: true });
      }
      await ref.update({ authUid: user.uid, active: true, mustChangePassword: false, updatedAt: Timestamp.now() });
      await sendVendorAccessEmail(email, action);
      return NextResponse.json({ ok: true, authUid: user.uid });
    }

    const enable = action === 'enable';
    const user = await findUser();
    if (user) await auth.updateUser(user.uid, { disabled: !enable });
    await ref.update({ active: enable, updatedAt: Timestamp.now() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
