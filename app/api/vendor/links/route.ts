import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { guardVendor } from '@/lib/vendor-guard';
import { REFERRAL_LINKS_COLLECTION, RESERVATIONS_COLLECTION } from '@/lib/vendor-admin';

export const runtime = 'nodejs';

const EXPERIENCES = 'experiencias';
type Ccy = 'ars' | 'brl' | 'usd';

const idSchema = z.object({ linkId: z.string().min(1) });
const toggleSchema = z.object({ linkId: z.string().min(1), active: z.boolean().default(false) });
const createSchema = z.object({ experienceId: z.string().min(1) });

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function allowedList(vendor: Record<string, any>): string[] | null {
  const list = vendor.allowedExperiences ?? vendor.allowedPackages;
  return Array.isArray(list) && list.length > 0 ? list.map(String) : null;
}

async function loadExperiences(db: FirebaseFirestore.Firestore, vendor: Record<string, any>) {
  const [current, legacy] = await Promise.all([
    db.collection(EXPERIENCES).where('visible', '==', true).get(),
    db.collection('paquetes').where('visible', '==', true).get().catch(() => null),
  ]);
  const byId = new Map<string, any>();
  legacy?.docs.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
  current.docs.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
  const allowed = allowedList(vendor);
  return Array.from(byId.values())
    .map((data) => ({ id: String(data.id), title: String(data.titulo ?? data.title ?? ''), slug: String(data.slug ?? '') }))
    .filter((p) => p.title && p.slug && (!allowed || allowed.includes(p.id)))
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

async function loadLinks(db: FirebaseFirestore.Firestore, vendorId: string, experiences: Map<string, { title: string; slug: string }>) {
  const snap = await db.collection(REFERRAL_LINKS_COLLECTION).where('vendorId', '==', vendorId).get();
  const links = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as any;
      const sales = await db.collection(RESERVATIONS_COLLECTION).where('referredBy.code', '==', data.code).get();
      const revenueByCurrency: Record<Ccy, number> = { ars: 0, brl: 0, usd: 0 };
      const commissionByCurrency: Record<Ccy, number> = { ars: 0, brl: 0, usd: 0 };
      let salesCount = 0;
      for (const s of sales.docs) {
        const r = s.data() as any;
        if (r.status === 'cancelled') continue;
        salesCount += 1;
        const ccy = String(r.currency ?? '').toLowerCase() as Ccy;
        if (ccy in revenueByCurrency) revenueByCurrency[ccy] += Number(r.amountTotal) || 0;
        const cc = String(r.referredBy?.commissionCurrency ?? r.currency ?? '').toLowerCase() as Ccy;
        if (cc in commissionByCurrency) commissionByCurrency[cc] += Number(r.referredBy?.commissionAmount) || 0;
      }
      const experience = data.experienceId ? experiences.get(String(data.experienceId)) : undefined;
      return {
        id: d.id,
        vendorId,
        code: String(data.code ?? ''),
        active: Boolean(data.active),
        experienceId: data.experienceId ?? null,
        experienceName: experience?.title ?? (data.experienceId ? 'Experiencia no disponible' : 'Todas'),
        experienceSlug: experience?.slug,
        createdAt: toIso(data.createdAt),
        salesCount,
        revenueByCurrency,
        commissionByCurrency,
      };
    })
  );
  return links.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

async function snapshot(db: FirebaseFirestore.Firestore, vendorId: string, vendor: Record<string, any>) {
  const experiencias = await loadExperiences(db, vendor);
  const all = new Map<string, { title: string; slug: string }>(experiencias.map((experience) => [experience.id, experience]));
  // Experiencias no visibles o ya no habilitadas se conservan en el historial de enlaces.
  const linksRaw = await db.collection(REFERRAL_LINKS_COLLECTION).where('vendorId', '==', vendorId).get();
  for (const d of linksRaw.docs) {
    const id = String((d.data() as any).experienceId ?? '');
    if (id && !all.has(id)) {
       const experience = await db.collection(EXPERIENCES).doc(id).get();
       const legacy = experience.exists ? null : await db.collection('paquetes').doc(id).get().catch(() => null);
       const doc = experience.exists ? experience : legacy;
       if (doc?.exists) {
         const data = doc.data() as any;
         all.set(id, { title: String(data.titulo ?? data.title ?? ''), slug: String(data.slug ?? '') });
      }
    }
  }
  const links = await loadLinks(db, vendorId, all);
  return { vendorId, experiencias, links };
}

export async function GET(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, ...(await snapshot(ctx.db, ctx.vendorId, ctx.vendor)) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'No se pudieron cargar los enlaces', 500);
  }
}

export async function POST(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  const { db, vendorId, vendor } = ctx;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Seleccioná una experiencia', 400);
  const { experienceId } = parsed.data;

  try {
    const allowed = allowedList(vendor);
    if (allowed && !allowed.includes(experienceId)) return fail('No tenés permiso para esa experiencia.', 403);

    const current = await db.collection(EXPERIENCES).doc(experienceId).get();
    const legacy = current.exists ? null : await db.collection('paquetes').doc(experienceId).get().catch(() => null);
    const experience = current.exists ? current : legacy;
    const experienceData = experience?.data() as any;
    if (!experience?.exists || experienceData?.visible !== true) return fail('La experiencia no está disponible.', 404);

    const dup = await db
      .collection(REFERRAL_LINKS_COLLECTION)
      .where('vendorId', '==', vendorId)
      .where('experienceId', '==', experienceId)
      .limit(1)
      .get();
    if (!dup.empty) return fail('Ya tenés un enlace para esa experiencia.', 409);

    let code = '';
    for (let i = 0; i < 8; i++) {
      const candidate = genCode();
      const taken = await db.collection(REFERRAL_LINKS_COLLECTION).where('code', '==', candidate).limit(1).get();
      if (taken.empty) {
        code = candidate;
        break;
      }
    }
    if (!code) return fail('No se pudo generar un código único. Probá nuevamente.', 500);

    const now = Timestamp.now();
    await db.collection(REFERRAL_LINKS_COLLECTION).add({
      vendorId,
      code,
      active: true,
      utm: null,
       experienceId,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ ok: true, ...(await snapshot(db, vendorId, vendor)) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'No se pudo crear el enlace', 500);
  }
}

async function ownedLink(ctx: Exclude<Awaited<ReturnType<typeof guardVendor>>, NextResponse>, linkId: string) {
  const ref = ctx.db.collection(REFERRAL_LINKS_COLLECTION).doc(linkId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as any).vendorId !== ctx.vendorId) return null;
  return { ref, data: snap.data() as any };
}

export async function PATCH(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Datos inválidos', 400);
  try {
    const link = await ownedLink(ctx, parsed.data.linkId);
    if (!link) return fail('Enlace no encontrado', 404);
    await link.ref.update({ active: parsed.data.active, updatedAt: Timestamp.now() });
    return NextResponse.json({ ok: true, ...(await snapshot(ctx.db, ctx.vendorId, ctx.vendor)) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'No se pudo desactivar', 500);
  }
}

export async function DELETE(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = idSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Datos inválidos', 400);
  try {
    const link = await ownedLink(ctx, parsed.data.linkId);
    if (!link) return fail('Enlace no encontrado', 404);
    const sales = await ctx.db
      .collection(RESERVATIONS_COLLECTION)
      .where('referredBy.code', '==', link.data.code)
      .limit(1)
      .get();
    if (!sales.empty) return fail('No podés eliminar un enlace con ventas. Podés desactivarlo.', 409);
    await link.ref.delete();
    return NextResponse.json({ ok: true, ...(await snapshot(ctx.db, ctx.vendorId, ctx.vendor)) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'No se pudo eliminar', 500);
  }
}
