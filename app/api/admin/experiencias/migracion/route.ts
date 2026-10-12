import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/vendor-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SOURCE = 'paquetes';
const DESTINATION = 'experiencias';
const confirmSchema = z.object({ confirm: z.literal(true) });

/** Previsualiza una copia segura; no modifica ni borra datos. */
export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;

  try {
    const [source, destination] = await Promise.all([
      guard.db.collection(SOURCE).get(),
      guard.db.collection(DESTINATION).get(),
    ]);
    const destinationIds = new Set(destination.docs.map((item) => item.id));
    const conflicts = source.docs.filter((item) => destinationIds.has(item.id)).map((item) => item.id);
    return NextResponse.json({
      ok: true,
      sourceCollection: SOURCE,
      destinationCollection: DESTINATION,
      sourceCount: source.size,
      destinationCount: destination.size,
      documentsToCopy: source.size - conflicts.length,
      existingIdsSkipped: conflicts.length,
      conflictIds: conflicts.slice(0, 100),
      conflictIdsTruncated: conflicts.length > 100,
      destructive: false,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo revisar el catálogo' }, { status: 500 });
  }
}

/** Copia documentos conservando ID y contenido; nunca reemplaza ni elimina documentos. */
export async function POST(request: Request) {
  const guard = await guardAdmin(request);
  if (guard instanceof NextResponse) return guard;

  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Para confirmar la copia enviá { "confirm": true }.' }, { status: 400 });
  }

  try {
    const [source, destination] = await Promise.all([
      guard.db.collection(SOURCE).get(),
      guard.db.collection(DESTINATION).get(),
    ]);
    const destinationIds = new Set(destination.docs.map((item) => item.id));
    const copiedIds: string[] = [];
    const skippedIds: string[] = source.docs.filter((item) => destinationIds.has(item.id)).map((item) => item.id);
    const pending = source.docs.filter((item) => !destinationIds.has(item.id));

    for (let index = 0; index < pending.length; index += 400) {
      const group = pending.slice(index, index + 400);
      const batch = guard.db.batch();
      group.forEach((item) => batch.create(guard.db.collection(DESTINATION).doc(item.id), item.data()));
      try {
        await batch.commit();
        copiedIds.push(...group.map((item) => item.id));
      } catch (error: any) {
        // Ante una carrera o ID existente, repetir condicionalmente para copiar
        // el resto sin reemplazar nunca el documento que ya esté allí.
        if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
        for (const item of group) {
          try {
            await guard.db.collection(DESTINATION).doc(item.id).create(item.data());
            copiedIds.push(item.id);
          } catch (itemError: any) {
            if (itemError?.code === 6 || itemError?.code === 'already-exists') skippedIds.push(item.id);
            else throw itemError;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      copied: copiedIds.length,
      skippedExisting: skippedIds.length,
      copiedIds: copiedIds.slice(0, 100),
      copiedIdsTruncated: copiedIds.length > 100,
      skippedIds: skippedIds.slice(0, 100),
      skippedIdsTruncated: skippedIds.length > 100,
      sourcePreserved: true,
      destinationCollection: DESTINATION,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo copiar el catálogo' }, { status: 500 });
  }
}
