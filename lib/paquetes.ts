/**
 * Catálogo de experiencias comerciales y funciones de reservas.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import type { Categoria, Paquete, Salida } from '@/types';
import { getOperationalSalidas, resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import { packageHasCategory, syncPackageCategoryData } from '@/lib/packages/category-utils';

const COLLECTION = 'paquetes';
const CATEGORIAS_COLLECTION = 'categorias';

async function fetchActiveCategoriasInternal(): Promise<Categoria[]> {
  try {
    const q = query(
      collection(db, CATEGORIAS_COLLECTION),
      where('activa', '==', true),
      orderBy('orden', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => serializeFirestoreData<Categoria>({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(db, CATEGORIAS_COLLECTION), where('activa', '==', true)));
    return snap.docs
      .map((d) => serializeFirestoreData<Categoria>({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
}

function normalizeFetchedPackage(paquete: Paquete, categorias: Categoria[]): Paquete {
  const raw = paquete as any;
  const currency = String(raw.moneda ?? raw.bookingConfig?.currency ?? 'ARS').toUpperCase();
  const dates = Array.isArray(raw.salidas)
    ? raw.salidas
    : Array.isArray(raw.bookingConfig?.dates)
      ? raw.bookingConfig.dates.map((item: any) => ({
          fecha: String(item.date ?? ''),
          precio: item.price,
          cupo: item.capacity,
          seatLayoutId: item.seatLayoutId,
          seatSelectionEnabled: item.seatSelectionEnabled,
          enabled: item.enabled,
        }))
      : [];
  const normalized = {
    ...raw,
    id: String(raw.id ?? ''),
    titulo: String(raw.titulo ?? raw.title ?? raw.name ?? ''),
    slug: String(raw.slug ?? ''),
    descripcion: String(raw.descripcion ?? raw.description ?? raw.subtitle ?? ''),
    descripcionCorta: String(raw.descripcionCorta ?? raw.shortDescription ?? raw.subtitle ?? ''),
    precio: Number(raw.precio ?? raw.price ?? 0) || 0,
    moneda: currency === 'BRL' ? 'ARS' : currency === 'USD' || currency === 'EUR' ? currency : 'ARS',
    capacidadMaxima: Number(raw.capacidadMaxima ?? raw.maxPeople ?? raw.bookingConfig?.maxPeoplePerBooking ?? 50) || 50,
    imagenPrincipal: String(raw.imagenPrincipal ?? raw.cardImage ?? raw.images?.[0] ?? ''),
    imagenTarjeta: String(raw.imagenTarjeta ?? raw.cardImage ?? raw.images?.[0] ?? ''),
    galeria: Array.isArray(raw.galeria) ? raw.galeria : Array.isArray(raw.images) ? raw.images : [],
    visible: raw.visible !== false,
    destacado: Boolean(raw.destacado ?? raw.featured),
    fechaCreacion: raw.fechaCreacion ?? raw.createdAt ?? new Date(0),
    orden: Number(raw.orden ?? 0) || 0,
    tipo: String(raw.tipo ?? raw.type ?? 'experiencia'),
    salidas: dates,
    addons: Array.isArray(raw.addons) ? raw.addons : [],
  } as Paquete;
  return syncPackageCategoryData(normalized, categorias);
}

export const normalizeExperienciaCatalogo = normalizeFetchedPackage;

async function loadCatalogDocuments(visibleOnly: boolean): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  const rows = snapshot.docs
    .map((item) => ({ id: item.id, data: item.data() as Record<string, any> }))
    .filter((item) => !visibleOnly || item.data.visible !== false);
  return rows.sort((a, b) => (Number(a.data.orden ?? 0) - Number(b.data.orden ?? 0)) || String(a.data.titulo ?? a.data.title ?? '').localeCompare(String(b.data.titulo ?? b.data.title ?? ''), 'es'));
}

// ============================================================================
// TIPOS
// ============================================================================

export type BookingDate = {
  date: string; // YYYY-MM-DD
  capacity: number;
  available: number;
  enabled: boolean;
};

export type BookingPublicData = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: BookingDate[];
  maxPeoplePerBooking: number;
  currency: string;
  depositAmount: number | null;
};

export type PackageWithBooking = Paquete;
/** Modelo comercial del catálogo actual (con alias legacy para datos existentes). */
export type ExperienciaCatalogo = Paquete;

// ============================================================================
// FUNCIONES CRUD BÁSICAS
// ============================================================================

/** Obtener todos los paquetes visibles (para el frontend) */
export async function getPaquetes(): Promise<Paquete[]> {
  const [rows, categorias] = await Promise.all([loadCatalogDocuments(true), fetchActiveCategoriasInternal()]);
  return rows.map((item) => normalizeFetchedPackage(serializeFirestoreData<Paquete>({ id: item.id, ...item.data }), categorias));
}

/** Nombre canónico para cargar experiencias visibles. */
export const getExperiencias = getPaquetes;

/** Obtener paquetes destacados (para homepage) */
export async function getPaquetesDestacados(maxItems = 6): Promise<Paquete[]> {
  const all = await getPaquetes();
  return all.filter((experience) => experience.destacado).slice(0, maxItems);
}

/** Obtener paquete por ID */
export async function getPaqueteById(id: string): Promise<Paquete | null> {
  const [snap, categorias] = await Promise.all([
    getDoc(doc(db, COLLECTION, id)),
    fetchActiveCategoriasInternal(),
  ]);
  if (!snap.exists()) return null;
  return normalizeFetchedPackage(serializeFirestoreData<Paquete>({ id: snap.id, ...snap.data() }), categorias);
}

/** Obtener paquete por slug (para páginas públicas) */
export async function getPaqueteBySlug(slug: string): Promise<Paquete | null> {
  const [rows, categorias] = await Promise.all([loadCatalogDocuments(true), fetchActiveCategoriasInternal()]);
  const match = rows.find((item) => String(item.data.slug ?? '') === slug);
  return match ? normalizeFetchedPackage(serializeFirestoreData<Paquete>({ id: match.id, ...match.data }), categorias) : null;
}

/** Obtener paquetes por categoría/destino */
export async function getPaquetesByCategoria(categoriaId: string): Promise<Paquete[]> {
  const paquetes = await getPaquetes();
  return paquetes.filter((paquete) => packageHasCategory(paquete, categoriaId));
}

// ============================================================================
// FUNCIONES PARA SISTEMA DE RESERVAS
// ============================================================================

/**
 * Convertir un Paquete a datos de booking públicos
 * Calcular available = capacity - reservas existentes
 */
export function toBookingPublicData(
  paquete: PackageWithBooking,
  reservedByDate: Record<string, number>
): BookingPublicData {
  const bc = paquete.bookingConfig;
  const enabled = bc?.enabled !== false;
  const operationalSalidas = getOperationalSalidas(paquete);

  const dates: BookingDate[] = operationalSalidas.map((salida) => {
    const resolved = resolveDepartureConfig(paquete, salida.fecha);
    const capacity = Math.max(0, resolved.baseCapacity || 0);
    const reserved = reservedByDate[salida.fecha] || 0;
    return {
      date: salida.fecha,
      capacity,
      available: Math.max(0, capacity - reserved),
      enabled: resolved.enabled,
    };
  });

  return {
    enabled,
    title: paquete.titulo || 'Reserva',
    subtitle1: paquete.descripcionCorta || paquete.descripcion || '',
    subtitle2: '',
    hasSpecificDates: dates.length > 0,
    dates: dates.filter((d) => d.enabled),
    maxPeoplePerBooking: resolveDepartureConfig(paquete, operationalSalidas[0]?.fecha || 'sin-fecha').maxPeople,
    currency: String(resolveDepartureConfig(paquete, operationalSalidas[0]?.fecha || 'sin-fecha').currency || 'ars').toLowerCase(),
    depositAmount: typeof bc?.depositAmount === 'number' ? bc.depositAmount : null,
  };
}

/** Obtener capacidad base para una fecha específica */
export function getBaseCapacityForDate(
  paquete: PackageWithBooking | null,
  date: string
): number {
  if (!paquete) return 0;
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

/** Verificar si un paquete tiene reservas habilitadas */
export function isBookingEnabled(paquete: PackageWithBooking | null): boolean {
  if (!paquete) return false;
  return paquete.bookingConfig?.enabled !== false;
}

/** Obtener precio de reserva de un paquete */
export function getBookingPrice(paquete: PackageWithBooking | null): number {
  if (!paquete) return 0;
  const bc = paquete.bookingConfig;
  if (typeof bc?.depositAmount === 'number' && bc.depositAmount > 0) {
    return bc.depositAmount;
  }
  // Si no hay depositAmount configurado, usar precio del paquete
  return paquete.precio || 0;
}

// ============================================================================
// FUNCIONES ADMIN
// ============================================================================

/** Crear paquete (admin) */
export async function createPaquete(data: Omit<Paquete, 'id' | 'fechaCreacion'>): Promise<string> {
  const now = Timestamp.now();
  const payload = {
    ...data,
    fechaCreacion: now,
  };
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return docRef.id;
}

/** Actualizar paquete (admin) */
export async function updatePaquete(id: string, data: Partial<Paquete>): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/** Eliminar paquete (admin) */
export async function deletePaquete(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Obtener todos los paquetes para admin (incluye no visibles) */
export async function getAllPaquetesAdmin(): Promise<Paquete[]> {
  const [rows, categorias] = await Promise.all([loadCatalogDocuments(false), fetchActiveCategoriasInternal()]);
  return rows.map((item) => normalizeFetchedPackage(serializeFirestoreData<Paquete>({ id: item.id, ...item.data }), categorias));
}

/** Nombre canónico para cargar todas las experiencias desde el panel admin. */
export const getAllExperienciasAdmin = getAllPaquetesAdmin;

// ============================================================================
// CONFIGURACIÓN DE RESERVAS (BOOKING CONFIG)
// ============================================================================

/** Actualizar configuración de reservas de un paquete */
export async function updatePaqueteBookingConfig(
  paqueteId: string,
  config: PackageWithBooking['bookingConfig']
): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  await updateDoc(ref, {
    bookingConfig: config,
    updatedAt: Timestamp.now(),
  });
}

/** Habilitar/deshabilitar reservas para un paquete */
export async function togglePaqueteBooking(paqueteId: string, enabled: boolean): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  await updateDoc(ref, {
    'bookingConfig.enabled': enabled,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// SALIDAS/FECHAS
// ============================================================================

/** Agregar salida a un paquete */
export async function addSalida(paqueteId: string, salida: Omit<Salida, 'id'>): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  const paquete = await getPaqueteById(paqueteId);
  if (!paquete) throw new Error('Paquete no encontrado');
  
  const nuevasSalidas = [...(paquete.salidas || []), { ...salida, id: crypto.randomUUID() }];
  await updateDoc(ref, {
    salidas: nuevasSalidas,
    updatedAt: Timestamp.now(),
  });
}

/** Eliminar salida de un paquete */
export async function removeSalida(paqueteId: string, salidaId: string): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  const paquete = await getPaqueteById(paqueteId);
  if (!paquete) throw new Error('Paquete no encontrado');
  
  const nuevasSalidas = (paquete.salidas || []).filter((s) => s.id !== salidaId);
  await updateDoc(ref, {
    salidas: nuevasSalidas,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// CATEGORÍAS/DESTINOS
// ============================================================================

/** Obtener todas las categorías/destinos */
export async function getCategorias(): Promise<any[]> {
  const q = query(
    collection(db, CATEGORIAS_COLLECTION),
    where('activa', '==', true),
    orderBy('orden', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestoreData({ id: d.id, ...d.data() }));
}

/** Obtener categoría por slug */
export async function getCategoriaBySlug(slug: string): Promise<any | null> {
  const q = query(
    collection(db, CATEGORIAS_COLLECTION),
    where('slug', '==', slug),
    where('activa', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return serializeFirestoreData({ id: snap.docs[0].id, ...snap.docs[0].data() });
}

// ============================================================================
// COMPATIBILIDAD (para migración suave)
// ============================================================================

/** Alias para mantener compatibilidad con código que espera experiencias */
export const getExperienciaById = getPaqueteById;
export const getExperienciaBySlug = getPaqueteBySlug;
