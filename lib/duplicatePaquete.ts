import { addDoc, collection, getDoc, getDocs, orderBy, query, Timestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify } from '@/lib/utils/slugify';
import { uploadImage, type UploadResult } from '@/lib/utils/upload';
import type { Paquete, Salida, TicketPack, PaqueteCondicion } from '@/types';

type DuplicatePaqueteResult = {
  id: string;
  paquete: Paquete;
};

function stripCopySuffix(title: string): string {
  return title.replace(/\s+\(copia(?:\s+\d+)?\)$/i, '').trim();
}

function getUniqueCopyTitle(originalTitle: string, existingTitles: string[]): string {
  const baseTitle = stripCopySuffix(originalTitle);
  const normalized = new Set(existingTitles.map((item) => item.trim().toLowerCase()));

  let attempt = `${baseTitle} (copia)`;
  if (!normalized.has(attempt.toLowerCase())) return attempt;

  let copyIndex = 2;
  while (normalized.has(`${baseTitle} (copia ${copyIndex})`.toLowerCase())) {
    copyIndex += 1;
  }

  return `${baseTitle} (copia ${copyIndex})`;
}

function getUniqueSlug(baseTitle: string, existingSlugs: string[]): string {
  const normalized = new Set(existingSlugs.map((item) => item.trim().toLowerCase()));
  const baseSlug = slugify(baseTitle);
  if (!normalized.has(baseSlug)) return baseSlug;

  let copyIndex = 2;
  while (normalized.has(`${baseSlug}-${copyIndex}`.toLowerCase())) {
    copyIndex += 1;
  }

  return `${baseSlug}-${copyIndex}`;
}

async function cloneRemoteFile(url: string, filename: string): Promise<File> {
  const response = await fetch(`/api/admin/remote-asset?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    let detail = '';
    try {
      const payload = (await response.json()) as { error?: string };
      detail = payload.error ? `: ${payload.error}` : '';
    } catch {
      detail = '';
    }
    throw new Error(`No se pudo descargar el archivo remoto${detail}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  const extension = mimeType.split('/')[1] || 'jpg';
  return new File([blob], `${filename}.${extension}`, { type: mimeType });
}

async function cloneAssetMap(paquete: Paquete): Promise<Map<string, UploadResult>> {
  const assetUrls = [
    paquete.imagenPrincipal,
    paquete.imagenTarjeta,
    paquete.imagenPortada,
    paquete.imagenPortadaMobile,
    paquete.imagenPortadaDesktop,
    ...(paquete.galeria || []),
  ].filter((value): value is string => Boolean(value));

  const uniqueUrls = Array.from(new Set(assetUrls));
  const uploads = new Map<string, UploadResult>();

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const url = uniqueUrls[index];
    const file = await cloneRemoteFile(url, `paquete-duplicado-${Date.now()}-${index}`);
    const uploaded = await uploadImage(file);
    uploads.set(url, uploaded);
  }

  return uploads;
}

function cloneSalidas(salidas: Salida[] = []): Salida[] {
  return salidas.map((salida) => ({
    ...salida,
  }));
}

function cloneTickets(tickets: TicketPack[] = []): TicketPack[] {
  return tickets.map((ticket) => ({
    ...ticket,
  }));
}

function cloneCondiciones(condiciones: PaqueteCondicion[] = []): PaqueteCondicion[] {
  return condiciones.map((condicion) => ({
    ...condicion,
  }));
}

export async function duplicatePaquete(paqueteId: string): Promise<DuplicatePaqueteResult> {
  const paqueteRef = doc(db, 'paquetes', paqueteId);
  const paqueteSnapshot = await getDoc(paqueteRef);

  if (!paqueteSnapshot.exists()) {
    throw new Error('La excursión original no existe');
  }

  const original = paqueteSnapshot.data() as Paquete;
  const paquetesSnapshot = await getDocs(query(collection(db, 'paquetes'), orderBy('orden', 'asc')));
  const paquetesExistentes = paquetesSnapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Array<Paquete & { id: string }>;

  const uniqueTitle = getUniqueCopyTitle(original.titulo, paquetesExistentes.map((item) => item.titulo));
  const uniqueSlug = getUniqueSlug(uniqueTitle, paquetesExistentes.map((item) => item.slug));
  const maxOrder = paquetesExistentes.reduce((max, item) => Math.max(max, item.orden || 0), 0);
  const clonedAssets = await cloneAssetMap(original);

  const duplicatedData: Omit<Paquete, 'id'> = {
    ...original,
    titulo: uniqueTitle,
    slug: uniqueSlug,
    orden: maxOrder + 1,
    fechaCreacion: Timestamp.now(),
    incluye: [...(original.incluye || [])],
    noIncluye: [...(original.noIncluye || [])],
    categoriaIds: [...(original.categoriaIds || [])],
    tipos: [...(original.tipos || (original.tipo ? [original.tipo] : []))],
    tiposTransporte: [...(original.tiposTransporte || [])],
    galeria: (original.galeria || []).map((url) => clonedAssets.get(url)?.url || url),
    galeriaKeys: (original.galeria || []).map((url) => clonedAssets.get(url)?.key || ''),
    salidas: cloneSalidas(original.salidas || []),
    tickets: cloneTickets(original.tickets || []),
    condiciones: cloneCondiciones(original.condiciones || []),
    imagenPrincipal: original.imagenPrincipal ? clonedAssets.get(original.imagenPrincipal)?.url || original.imagenPrincipal : '',
    imagenPrincipalKey: original.imagenPrincipal ? clonedAssets.get(original.imagenPrincipal)?.key || '' : '',
    imagenTarjeta: original.imagenTarjeta ? clonedAssets.get(original.imagenTarjeta)?.url || original.imagenTarjeta : '',
    imagenTarjetaKey: original.imagenTarjeta ? clonedAssets.get(original.imagenTarjeta)?.key || '' : '',
    imagenPortada: original.imagenPortada ? clonedAssets.get(original.imagenPortada)?.url || original.imagenPortada : '',
    imagenPortadaKey: original.imagenPortada ? clonedAssets.get(original.imagenPortada)?.key || '' : '',
    imagenPortadaMobile: original.imagenPortadaMobile
      ? clonedAssets.get(original.imagenPortadaMobile)?.url || original.imagenPortadaMobile
      : '',
    imagenPortadaMobileKey: original.imagenPortadaMobile
      ? clonedAssets.get(original.imagenPortadaMobile)?.key || ''
      : '',
    imagenPortadaDesktop: original.imagenPortadaDesktop
      ? clonedAssets.get(original.imagenPortadaDesktop)?.url || original.imagenPortadaDesktop
      : '',
    imagenPortadaDesktopKey: original.imagenPortadaDesktop
      ? clonedAssets.get(original.imagenPortadaDesktop)?.key || ''
      : '',
  };

  const createdDoc = await addDoc(collection(db, 'paquetes'), duplicatedData);

  return {
    id: createdDoc.id,
    paquete: {
      ...duplicatedData,
      id: createdDoc.id,
    },
  };
}
