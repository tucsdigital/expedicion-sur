import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import {
  REFERRAL_LINKS_COLLECTION,
  RESERVATIONS_COLLECTION,
  VENDORS_COLLECTION,
  adminEmails,
  errorMessage,
  guardAdmin,
  isValidDni,
  normalizeDni,
  sendVendorAccessEmail,
} from '@/lib/vendor-admin';

export const runtime = 'nodejs';

const vendorFields = z.object({
  name: z.string().trim().min(1, 'Ingresá el nombre'),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  dni: z.string().transform(normalizeDni).refine(isValidDni, 'El DNI debe tener 7 u 8 dígitos'),
  active: z.boolean().default(true),
  defaultCommission: z.object({
    type: z.enum(['percent', 'fixed']),
    value: z.number().finite().min(0),
    currency: z.enum(['ars', 'brl', 'usd']),
  }),
});

const updateSchema = vendorFields.extend({ vendorId: z.string().min(1) });
const deleteSchema = z.object({ vendorId: z.string().min(1) });

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function zodMessage(error: z.ZodError) {
  return error.errors.map((e) => e.message).join(', ');
}

async function findDuplicate(db: Firestore, email: string, dni: string, exceptId?: string): Promise<string | null> {
  const [byEmail, byDni] = await Promise.all([
    db.collection(VENDORS_COLLECTION).where('email', '==', email).get(),
    db.collection(VENDORS_COLLECTION).where('normalizedDni', '==', dni).get(),
  ]);
  if (byEmail.docs.some((d) => d.id !== exceptId)) return 'Ya existe un vendedor con ese email.';
  if (byDni.docs.some((d) => d.id !== exceptId)) return 'Ya existe un vendedor con ese DNI.';
  return null;
}

async function getAuthUserByEmail(auth: Auth, email: string) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

/**
 * Lectura para los selectores del admin (sin índices ni reglas de Firestore):
 * - GET /api/admin/vendors                -> { vendors } (activos + el indicado en ?include=<id>)
 * - GET /api/admin/vendors?vendorId=<id>  -> { links } del vendedor
 */
export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;
  const { db } = guard;
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim();

  try {
    if (vendorId) {
      const snap = await db.collection(REFERRAL_LINKS_COLLECTION).where('vendorId', '==', vendorId).get();
      const pkgIds = Array.from(new Set(snap.docs.map((d) => String((d.data() as any).experienceId ?? '')).filter(Boolean)));
      const titles = new Map<string, string>();
      await Promise.all(
        pkgIds.map(async (id) => {
          const paquete = await db.collection('paquetes').doc(id).get();
          if (paquete.exists) titles.set(id, String((paquete.data() as any).titulo ?? (paquete.data() as any).title ?? ''));
        })
      );
      const links = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const experienceId = data.experienceId ? String(data.experienceId) : null;
          return {
            id: d.id,
            code: String(data.code ?? ''),
            active: Boolean(data.active),
            vendorId,
            experienceId,
            experienceName: experienceId ? titles.get(experienceId) ?? '' : 'Todas',
          };
        })
        .filter((l) => l.active && l.code)
        .sort((a, b) => a.code.localeCompare(b.code));
      return NextResponse.json({ ok: true, links });
    }

    const include = url.searchParams.get('include')?.trim();
    const snap = await db.collection(VENDORS_COLLECTION).get();
    const vendors = snap.docs
      .map((d) => {
        const v = d.data() as any;
        const allowed = v.allowedExperiences ?? v.allowedPackages;
        return {
          id: d.id,
          name: String(v.name ?? ''),
          email: String(v.email ?? ''),
          dni: String(v.normalizedDni ?? v.dni ?? ''),
          active: Boolean(v.active),
          allowedExperiences: Array.isArray(allowed) ? allowed.map(String) : null,
        };
      })
      .filter((v) => v.active || v.id === include)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return NextResponse.json({ ok: true, vendors });
  } catch (error) {
    return fail(errorMessage(error), 500);
  }
}

/** Alta: usuario de Auth (contraseña = DNI) + documento del vendedor, todo o nada. */
export async function POST(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;
  const { auth, db } = guard;

  const parsed = vendorFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(zodMessage(parsed.error), 400);
  const data = parsed.data;

  if (adminEmails().includes(data.email)) return fail('Ese email pertenece a un administrador.', 400);

  let createdUid: string | null = null;
  try {
    const duplicate = await findDuplicate(db, data.email, data.dni);
    if (duplicate) return fail(duplicate, 409);

    // Si quedó un usuario de Auth huérfano (sin vendedor), se reutiliza y se le fija el DNI.
    const existing = await getAuthUserByEmail(auth, data.email);
    let uid: string;
    if (existing) {
      await auth.updateUser(existing.uid, { password: data.dni, disabled: !data.active, emailVerified: true });
      uid = existing.uid;
    } else {
      const user = await auth.createUser({
        email: data.email,
        password: data.dni,
        displayName: data.name,
        emailVerified: true,
        disabled: !data.active,
      });
      uid = user.uid;
      createdUid = uid;
    }

    const now = Timestamp.now();
    const ref = db.collection(VENDORS_COLLECTION).doc();
    await ref.set({
      name: data.name,
      email: data.email,
      dni: data.dni,
      normalizedDni: data.dni,
      active: data.active,
      authUid: uid,
      mustChangePassword: false,
      defaultCommission: data.defaultCommission,
      createdAt: now,
      updatedAt: now,
    });

    await sendVendorAccessEmail(data.email, 'create');
    return NextResponse.json({
      ok: true,
      vendor: {
        id: ref.id,
        name: data.name,
        email: data.email,
        dni: data.dni,
        normalizedDni: data.dni,
        active: data.active,
        authUid: uid,
        mustChangePassword: false,
        defaultCommission: data.defaultCommission,
      },
    });
  } catch (error) {
    if (createdUid) await auth.deleteUser(createdUid).catch(() => null);
    return fail(errorMessage(error), 500);
  }
}

/** Edición: mantiene sincronizados Firestore y Auth (email, DNI/contraseña, estado). */
export async function PATCH(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;
  const { auth, db } = guard;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(zodMessage(parsed.error), 400);
  const data = parsed.data;

  if (adminEmails().includes(data.email)) return fail('Ese email pertenece a un administrador.', 400);

  const ref = db.collection(VENDORS_COLLECTION).doc(data.vendorId);
  const snap = await ref.get();
  if (!snap.exists) return fail('Vendedor no encontrado.', 404);
  const current = snap.data() as any;

  const duplicate = await findDuplicate(db, data.email, data.dni, data.vendorId).catch(() => null);
  if (duplicate) return fail(duplicate, 409);

  let authUid = String(current.authUid ?? '').trim();
  const hadUid = Boolean(authUid);
  let revert: (() => Promise<unknown>) | null = null;
  try {
    const previousEmail = String(current.email ?? '').toLowerCase();
    const previousDni = normalizeDni(current.normalizedDni ?? current.dni);

    let user = null as Awaited<ReturnType<Auth['getUser']>> | null;
    if (authUid) user = await auth.getUser(authUid).catch(() => null);
    if (!user) user = await getAuthUserByEmail(auth, previousEmail);

    if (user) {
      authUid = user.uid;
      const update: Record<string, unknown> = { email: data.email, displayName: data.name, disabled: !data.active };
      if (data.dni !== previousDni || !hadUid) update.password = data.dni;
      await auth.updateUser(user.uid, update);
      revert = () =>
        auth.updateUser(user!.uid, {
          email: previousEmail,
          disabled: user!.disabled,
          ...(update.password ? { password: previousDni || undefined } : {}),
        });
    } else {
      const created = await auth.createUser({
        email: data.email,
        password: data.dni,
        displayName: data.name,
        emailVerified: true,
        disabled: !data.active,
      });
      authUid = created.uid;
      revert = () => auth.deleteUser(created.uid);
    }

    await ref.update({
      name: data.name,
      email: data.email,
      dni: data.dni,
      normalizedDni: data.dni,
      active: data.active,
      authUid,
      mustChangePassword: false,
      defaultCommission: data.defaultCommission,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      ok: true,
      vendor: {
        id: data.vendorId,
        ...current,
        name: data.name,
        email: data.email,
        dni: data.dni,
        normalizedDni: data.dni,
        active: data.active,
        authUid,
        mustChangePassword: false,
        defaultCommission: data.defaultCommission,
        createdAt: undefined,
        updatedAt: undefined,
      },
    });
  } catch (error) {
    if (revert) await Promise.resolve(revert()).catch(() => null);
    return fail(errorMessage(error), 500);
  }
}

/** Baja: borra usuario de Auth, enlaces de referido y documento. Las ventas históricas se conservan. */
export async function DELETE(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;
  const { auth, db } = guard;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Datos inválidos', 400);
  const { vendorId } = parsed.data;

  const ref = db.collection(VENDORS_COLLECTION).doc(vendorId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ ok: true, alreadyDeleted: true });
  const vendor = snap.data() as any;

  try {
    const email = String(vendor.email ?? '').toLowerCase();
    const authUid = String(vendor.authUid ?? '').trim();
    const uids = new Set<string>();
    if (authUid) uids.add(authUid);
    if (email) {
      const byEmail = await auth.getUserByEmail(email).catch(() => null);
      if (byEmail) uids.add(byEmail.uid);
    }
    for (const uid of uids) {
      await auth.deleteUser(uid).catch((e: any) => {
        if (e?.code !== 'auth/user-not-found') throw e;
      });
    }

    const links = await db.collection(REFERRAL_LINKS_COLLECTION).where('vendorId', '==', vendorId).get();
    for (let i = 0; i < links.docs.length; i += 400) {
      const batch = db.batch();
      links.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const sales = await db
      .collection(RESERVATIONS_COLLECTION)
      .where('referredBy.vendorId', '==', vendorId)
      .count()
      .get()
      .then((s) => s.data().count)
      .catch(() => 0);

    await ref.delete();
    return NextResponse.json({ ok: true, deletedLinks: links.size, keptReservations: sales });
  } catch (error) {
    return fail(errorMessage(error), 500);
  }
}
