import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify } from '@/lib/utils/slugify';
import { uploadImage, type UploadResult } from '@/lib/utils/upload';
import type { Paquete, PaqueteCondicion, Salida, TicketPack } from '@/types';

type DuplicatePaqueteResult = {
  id: string;
  paquete: Paquete;
};

function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

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
    paquete.imagenCard,
    ...(paquete.imagenes || []),
    ...((paquete.tickets || []).map((ticket) => ticket.imagenUrl).filter(Boolean) as string[]),
    ...(paquete.galeria || []),
  ].filter((value): value is string => Boolean(value));

  const uniqueUrls = Array.from(new Set(assetUrls));
  const uploads = new Map<string, UploadResult>();

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const url = uniqueUrls[index];
    try {
      const file = await cloneRemoteFile(url, `paquete-duplicado-${Date.now()}-${index}`);
      const uploaded = await uploadImage(file);
      uploads.set(url, uploaded);
    } catch {
    }
  }

  return uploads;
}

function cloneSalidas(salidas: Salida[] = []): Salida[] {
  return deepClone(salidas);
}

function cloneTickets(tickets: TicketPack[] = []): TicketPack[] {
  return deepClone(tickets);
}

function cloneCondiciones(condiciones: PaqueteCondicion[] = []): PaqueteCondicion[] {
  return deepClone(condiciones);
}

type PackageDocumentInput = Partial<Omit<Paquete, 'id'>> & {
  titulo: Paquete['titulo'];
  slug: Paquete['slug'];
  tipo: Paquete['tipo'];
  precio: Paquete['precio'];
  moneda: Paquete['moneda'];
  mostrarDesde: Paquete['mostrarDesde'];
  duracion: Paquete['duracion'];
  incluye: Paquete['incluye'];
  noIncluye: Paquete['noIncluye'];
  salidas: Paquete['salidas'];
  imagenPrincipal: Paquete['imagenPrincipal'];
  galeria: Paquete['galeria'];
  visible: Paquete['visible'];
  destacado: Paquete['destacado'];
  fechaCreacion: Paquete['fechaCreacion'];
  orden: Paquete['orden'];
  ctaWhatsApp: Paquete['ctaWhatsApp'];
};

function removeUndefinedFields(input: PackageDocumentInput): PackageDocumentInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as PackageDocumentInput;
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
  const baseTipos = Array.from(
    new Set([...(original.tipos || []), ...(original.tipo ? [original.tipo] : [])].filter(Boolean))
  );

  const clonedFaqs = Array.isArray(original.faqs) ? deepClone(original.faqs) : original.faqs;
  const clonedTestimonios = Array.isArray(original.testimonios) ? deepClone(original.testimonios) : original.testimonios;
  const clonedItinerarioSteps = Array.isArray(original.itinerarioSteps) ? deepClone(original.itinerarioSteps) : original.itinerarioSteps;
  const clonedBookingConfig = original.bookingConfig ? deepClone(original.bookingConfig) : original.bookingConfig;
  const clonedReservationPricing = original.reservationPricing ? deepClone(original.reservationPricing) : original.reservationPricing;
  const clonedPickupPointsConfig = Array.isArray(original.pickupPointsConfig) ? deepClone(original.pickupPointsConfig) : original.pickupPointsConfig;
  const clonedTarjetaKey = original.imagenTarjeta ? clonedAssets.get(original.imagenTarjeta)?.key ?? original.imagenTarjetaKey : original.imagenTarjetaKey;
  const clonedPortadaKey = original.imagenPortada ? clonedAssets.get(original.imagenPortada)?.key ?? original.imagenPortadaKey : original.imagenPortadaKey;
  const clonedPortadaMobileKey = original.imagenPortadaMobile ? clonedAssets.get(original.imagenPortadaMobile)?.key ?? original.imagenPortadaMobileKey : original.imagenPortadaMobileKey;
  const clonedPortadaDesktopKey = original.imagenPortadaDesktop ? clonedAssets.get(original.imagenPortadaDesktop)?.key ?? original.imagenPortadaDesktopKey : original.imagenPortadaDesktopKey;

  const duplicatedData: PackageDocumentInput = {
    ...deepClone(original),
    titulo: uniqueTitle,
    slug: uniqueSlug,
    orden: maxOrder + 1,
    fechaCreacion: Timestamp.now(),
    tipo: baseTipos[0] || original.tipo,
    incluye: [...(original.incluye || [])],
    noIncluye: [...(original.noIncluye || [])],
    categoriaIds: [...(original.categoriaIds || [])],
    tipos: [...baseTipos],
    tiposTransporte: [...(original.tiposTransporte || [])],
    tags: [...(original.tags || [])],
    faqs: clonedFaqs,
    testimonios: clonedTestimonios,
    itinerarioSteps: clonedItinerarioSteps,
    bookingConfig: clonedBookingConfig,
    reservationPricing: clonedReservationPricing,
    pickupPoints: [...(original.pickupPoints || [])],
    pickupPointsConfig: clonedPickupPointsConfig,
    galeria: (original.galeria || []).map((url) => clonedAssets.get(url)?.url || url),
    galeriaKeys: (original.galeria || []).map(
      (url, idx) => clonedAssets.get(url)?.key || original.galeriaKeys?.[idx] || ''
    ),
    salidas: cloneSalidas(original.salidas || []),
    tickets: cloneTickets(original.tickets || []).map((ticket) => ({
      ...ticket,
      imagenUrl: ticket.imagenUrl ? clonedAssets.get(ticket.imagenUrl)?.url || ticket.imagenUrl : ticket.imagenUrl,
    })),
    condiciones: cloneCondiciones(original.condiciones || []),
    imagenCard: original.imagenCard ? clonedAssets.get(original.imagenCard)?.url || original.imagenCard : original.imagenCard,
    imagenes: (original.imagenes || []).map((url) => clonedAssets.get(url)?.url || url),
    imagenPrincipal: original.imagenPrincipal ? clonedAssets.get(original.imagenPrincipal)?.url || original.imagenPrincipal : '',
    imagenPrincipalKey: original.imagenPrincipal
      ? clonedAssets.get(original.imagenPrincipal)?.key || original.imagenPrincipalKey || ''
      : '',
    imagenTarjeta: original.imagenTarjeta ? clonedAssets.get(original.imagenTarjeta)?.url || original.imagenTarjeta : '',
    imagenTarjetaKey: clonedTarjetaKey,
    imagenPortada: original.imagenPortada ? clonedAssets.get(original.imagenPortada)?.url || original.imagenPortada : '',
    imagenPortadaKey: clonedPortadaKey,
    imagenPortadaMobile: original.imagenPortadaMobile
      ? clonedAssets.get(original.imagenPortadaMobile)?.url || original.imagenPortadaMobile
      : '',
    imagenPortadaMobileKey: clonedPortadaMobileKey,
    imagenPortadaDesktop: original.imagenPortadaDesktop
      ? clonedAssets.get(original.imagenPortadaDesktop)?.url || original.imagenPortadaDesktop
      : '',
    imagenPortadaDesktopKey: clonedPortadaDesktopKey,
  };

  const sanitizedDuplicatedData = removeUndefinedFields(duplicatedData) as Omit<Paquete, 'id'>;
  const createdDoc = await addDoc(collection(db, 'paquetes'), sanitizedDuplicatedData);

  return {
    id: createdDoc.id,
    paquete: {
      ...sanitizedDuplicatedData,
      id: createdDoc.id,
    },
  };
}
