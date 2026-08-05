import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Paquete } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import ImageGallery from '@/components/ImageGallery';
import PaqueteSidebar from '@/components/PaqueteSidebar';
import PaqueteHero from '@/components/PaqueteHero';
import PaqueteSchema from '@/components/PaqueteSchema';
import { ArrowDownLeft, ArrowUpRight, CheckCircle, XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { slugify } from '@/lib/utils/slugify';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';

/** Sin caché: los cambios del admin se ven de inmesdiato */
export const revalidate = 0;

const DEFAULT_CONDICIONES = [
  { titulo: 'Reserva', texto: 'Seña del 40% para asegurar tu lugar.' },
  { titulo: 'Pagos', texto: 'Consultá nuestras cuotas y medios de pago disponibles.' },
  { titulo: 'Confirmación', texto: 'Salida sujeta a la conformación del grupo mínimo.' },
  { titulo: 'Flexibilidad', texto: 'Excursiones condicionadas por clima o imprevistos.' },
  { titulo: 'Seguridad', texto: 'Recomendamos contratar asistencia al viajero.' },
  { titulo: 'Gastos extra', texto: 'No incluye comidas en ruta, bebidas ni opcionales.' },
  { titulo: 'Ingresos', texto: 'No incluye tickets a parques nacionales ni museos.' },
];

function normalizeCondiciones(raw: unknown) {
  if (!Array.isArray(raw)) return DEFAULT_CONDICIONES;
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const titulo = String((item as { titulo?: unknown }).titulo ?? '').trim();
      const texto = String((item as { texto?: unknown }).texto ?? '').trim();
      if (!titulo || !texto) return null;
      return { titulo, texto };
    })
    .filter((item): item is { titulo: string; texto: string } => Boolean(item));
  return parsed.length > 0 ? parsed : DEFAULT_CONDICIONES;
}

type RawPaquete = Paquete & {
  galeria?: unknown;
  incluye?: unknown;
  noIncluye?: unknown;
  salidas?: unknown;
  visible?: unknown;
};

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

function normalizePaqueteData(raw: RawPaquete): Paquete {
  const galeria = normalizeStringArray(raw.galeria ?? []);
  const incluye = normalizeStringArray(raw.incluye ?? []);
  const noIncluye = normalizeStringArray(raw.noIncluye ?? []);
  const salidas = Array.isArray(raw.salidas) ? raw.salidas : [];
  return {
    ...(raw as Paquete),
    galeria,
    incluye,
    noIncluye,
    salidas,
    visible: raw.visible !== false,
  };
}

async function getPaquete(slug: string): Promise<Paquete | null> {
  if (!firebaseEnabled) return null;
  const normalizedSlug = slugify(String(slug || ''));
  if (!normalizedSlug) return null;
  try {
    const q = query(collection(db, 'paquetes'), where('slug', '==', normalizedSlug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const paquete = normalizePaqueteData(
      serializeFirestoreData<RawPaquete>({
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      })
    );

    if (!paquete.visible) return null;

    return {
      ...paquete,
      condiciones: normalizeCondiciones((paquete as Paquete & { condiciones?: unknown }).condiciones),
    };
  } catch (error) {
    console.error('Error fetching paquete:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const siteUrl = SITE_URL;
    const url = `${siteUrl}/paquete/${slug}`;
    return {
      title: `${slug} - ${SITE_NAME}`,
      description: `Excursión ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }
  const paquete = await getPaquete(slug);
  
  if (!paquete) {
    return {
      title: 'Excursión no encontrada',
    };
  }

  const siteUrl = SITE_URL;
  const url = `${siteUrl}/paquete/${slug}`;
  
  // Limpiar HTML de la descripción para metadatos
  const cleanDescription = paquete.descripcionCorta || 
    paquete.descripcion.replace(/<[^>]*>/g, '').substring(0, 160).trim() + '...';

  const coverImage =
    paquete.imagenPortadaDesktop ||
    paquete.imagenPortada ||
    paquete.imagenPortadaMobile ||
    paquete.imagenTarjeta ||
    paquete.imagenPrincipal;

  return {
    title: `${paquete.titulo} - ${SITE_NAME}`,
    description: cleanDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: `${paquete.titulo} - ${SITE_NAME}`,
      description: cleanDescription,
      siteName: SITE_NAME,
      locale: 'es_AR',
      images: coverImage ? [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: paquete.titulo,
        }
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${paquete.titulo} - ${SITE_NAME}`,
      description: cleanDescription,
      images: coverImage ? [coverImage] : [],
    },
    keywords: [
      paquete.titulo,
      paquete.destino || 'destino',
      'paquete turístico',
      'viajes',
      'turismo',
      SITE_NAME,
    ],
  };
}

export default async function PaquetePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!firebaseEnabled) {
    return (
      <>
        <Navbar transparent forceTransparent reserveSpace />
        <WhatsAppButton />
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-[32px] leading-[40px] tracking-[0.5px] font-semibold mb-4 font-heading text-black">
                {slug}
              </h1>
              <p className="text-base md:text-lg text-gray-700 font-body leading-relaxed">
                Este contenido requiere configuración de Firebase para mostrarse.
              </p>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }
  const paquete = await getPaquete(slug);

  if (!paquete) {
    notFound();
  }

  const now = new Date();
  const nextSalida = Array.isArray(paquete.salidas)
    ? [...paquete.salidas]
        .filter((s) => {
          const d = new Date(`${s.fecha}T00:00:00`);
          return !Number.isNaN(d.getTime()) && d >= now;
        })
        .sort((a, b) => new Date(`${a.fecha}T00:00:00`).getTime() - new Date(`${b.fecha}T00:00:00`).getTime())[0] ??
      [...(paquete.salidas || [])].sort((a, b) => new Date(`${a.fecha}T00:00:00`).getTime() - new Date(`${b.fecha}T00:00:00`).getTime())[0] ??
      null
    : null;

  const salidaLabel = nextSalida?.fecha
    ? new Date(`${nextSalida.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    : null;
  const vueltaLabel = nextSalida?.fechaVuelta
    ? new Date(`${nextSalida.fechaVuelta}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    : null;

  return (
    <>
      <PaqueteSchema paquete={paquete} />
      <Navbar transparent forceTransparent reserveSpace />
      <WhatsAppButton />

      <PaqueteHero paquete={paquete} />

      {/* Contenido */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
            {/* Columna principal */}
            <div className="lg:col-span-2 space-y-10 md:space-y-12 overflow-hidden">
              <div>
                <h2 className="text-lg md:text-lg lg:text-lg font-semibold mb-6">Descripción</h2>
                <div 
                  className="text-base md:text-lg text-gray-700 leading-relaxed prose prose-lg max-w-none wrap-break-word overflow-wrap-anywhere"
                  dangerouslySetInnerHTML={{ __html: paquete.descripcion }}
                />
              </div>

              {/* Fechas y Salidas */}
              {paquete.salidas && paquete.salidas.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-lg lg:text-lg font-semibold mb-6">Fechas y Salidas Disponibles</h2>

                  {(salidaLabel || vueltaLabel) && (
                    <div className="mb-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                      <div className="grid grid-cols-1 divide-y divide-gray-200">
                        {salidaLabel && (
                          <div className="flex items-center gap-3 px-5 py-4">
                            <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center text-success">
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Salida</div>
                              <div className="text-base font-semibold text-gray-900 truncate">{salidaLabel}</div>
                            </div>
                          </div>
                        )}
                        {vueltaLabel && (
                          <div className="flex items-center gap-3 px-5 py-4">
                            <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                              <ArrowDownLeft className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Vuelta</div>
                              <div className="text-base font-semibold text-gray-900 truncate">{vueltaLabel}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Vista Mobile - Tarjetas */}
                  <div className="md:hidden space-y-4">
                    {[...paquete.salidas]
                      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                      .map((salida) => {
                        const esPasada = new Date(salida.fecha + 'T00:00:00') < new Date();
                        return (
                          <div 
                            key={salida.id}
                            className={`bg-white border-2 rounded-xl p-4 ${esPasada ? 'opacity-50 border-gray-200' : 'border-gray-300'}`}
                          >
                            {/* Fecha */}
                            <div className="mb-3 pb-3 border-b">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Fecha de Salida</p>
                                  <p className="font-bold text-gray-900 text-lg">
                                    {new Date(salida.fecha + 'T00:00:00').toLocaleDateString('es-AR', { 
                                      weekday: 'short',
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </p>
                                  {salida.fechaVuelta && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      Vuelta: {new Date(salida.fechaVuelta + 'T00:00:00').toLocaleDateString('es-AR', { 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                  )}
                                </div>
                                {esPasada && (
                                  <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">Pasada</span>
                                )}
                              </div>
                            </div>

                            {/* Información en grid */}
                            <div className="space-y-3">
                              {/* Ciudad */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 uppercase tracking-wide">Ciudad</span>
                                <span className="font-medium text-gray-900">{salida.ciudadSalida || '-'}</span>
                              </div>

                              {/* Precio */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 uppercase tracking-wide">Precio</span>
                                <span className="font-bold text-base text-gray-900">
                                  {salida.moneda} ${salida.precio.toLocaleString('es-AR')}
                                </span>
                              </div>

                              {/* Cupo */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 uppercase tracking-wide">Cupo</span>
                                <span className="inline-flex items-center gap-2">
                                  {salida.cupo ? (
                                    <>
                                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                      <span className="font-medium text-gray-900">{salida.cupo} {salida.cupo === 1 ? 'lugar' : 'lugares'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                                      <span className="font-medium text-gray-600">Consultar</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Observaciones */}
                              {salida.observaciones && salida.observaciones.trim() && (
                                <div className="pt-3 mt-3 border-t border-gray-200">
                                  <span className="text-sm text-gray-500 uppercase tracking-wide block mb-1">Observaciones</span>
                                  <p className="text-base text-gray-700 leading-relaxed wrap-break-word">{salida.observaciones}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Vista Desktop - Tabla */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-black text-white">
                          <th className="p-3 text-left font-semibold text-base">Fecha de Salida</th>
                          <th className="p-3 text-left font-semibold text-base">Ciudad</th>
                          <th className="p-3 text-left font-semibold text-base">Precio</th>
                          <th className="p-3 text-left font-semibold text-base">Cupo</th>
                          <th className="p-3 text-left font-semibold text-base">Observaciones</th>
                          <th className="p-3 text-left font-semibold text-base">Consultar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...paquete.salidas]
                          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                          .map((salida, index) => {
                            const esPasada = new Date(salida.fecha + 'T00:00:00') < new Date();
                            const whatsappHref = !esPasada
                              ? getWhatsAppLink(
                                  `Hola! Quiero consultar por el paquete ${paquete.titulo}. Salida: ${new Date(
                                    `${salida.fecha}T00:00:00`
                                  ).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}${
                                    salida.fechaVuelta
                                      ? ` - Vuelta: ${new Date(`${salida.fechaVuelta}T00:00:00`).toLocaleDateString(
                                          'es-AR',
                                          { day: 'numeric', month: 'long', year: 'numeric' }
                                        )}`
                                      : ''
                                  }${salida.ciudadSalida ? ` - Ciudad: ${salida.ciudadSalida}` : ''}`
                                )
                              : '';
                            return (
                              <tr 
                                key={salida.id} 
                                className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${esPasada ? 'opacity-50' : ''} hover:bg-gray-100 transition-colors`}
                              >
                                <td className="p-3">
                                  <div className="font-semibold text-gray-900 text-base">
                                    {new Date(salida.fecha + 'T00:00:00').toLocaleDateString('es-AR', { 
                                      weekday: 'short',
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </div>
                                  {salida.fechaVuelta && (
                                    <div className="text-sm text-gray-600 mt-0.5">
                                      Vuelta: {new Date(salida.fechaVuelta + 'T00:00:00').toLocaleDateString('es-AR', { 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </div>
                                  )}
                                  {esPasada && (
                                    <span className="inline-block mt-1 text-sm bg-red-100 text-red-700 px-2 py-1 rounded">Pasada</span>
                                  )}
                                </td>
                                <td className="p-3 text-gray-700 text-base">
                                  {salida.ciudadSalida || '-'}
                                </td>
                                <td className="p-3">
                                  <span className="font-bold text-lg text-gray-900">
                                    {salida.moneda} ${salida.precio.toLocaleString('es-AR')}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="inline-flex items-center gap-2 text-gray-700 text-base">
                                    {salida.cupo ? (
                                      <>
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                        {salida.cupo} {salida.cupo === 1 ? 'lugar' : 'lugares'}
                                      </>
                                    ) : (
                                      <>
                                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                                        Consultar
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-700 text-base">
                                  {salida.observaciones && salida.observaciones.trim() ? (
                                    <span className="wrap-break-word">{salida.observaciones}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {!esPasada ? (
                                    <a
                                      href={whatsappHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                      >
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                      </svg>
                                      Consultar
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-sm md:text-base text-gray-600 mt-4">
                    💡 Los precios pueden variar según disponibilidad. Consultá por otras fechas disponibles.
                  </p>
                </div>
              )}

              {(paquete.incluye.length > 0 || (paquete.noIncluye && paquete.noIncluye.length > 0)) && (
                <div className="bg-gray-50 rounded-lg p-6 md:p-8">
                  <h2 className="text-lg md:text-lg lg:text-lg font-semibold mb-6 md:mb-8 text-gray-900">Incluye y No Incluye</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* ¿Qué Incluye? */}
                    {paquete.incluye.length > 0 && (
                      <div>
                        <h3 className="text-base md:text-lg lg:text-lg font-semibold mb-4 text-gray-800">¿Qué Incluye?</h3>
                        <ul className="space-y-3">
                          {paquete.incluye.map((item, index) => (
                            <li key={index} className="flex items-start">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-lg leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ¿Qué NO Incluye? */}
                    {paquete.noIncluye && paquete.noIncluye.length > 0 && (
                      <div>
                        <h3 className="text-base md:text-lg lg:text-lg font-semibold mb-4 text-gray-800">¿Qué NO Incluye?</h3>
                        <ul className="space-y-3">
                          {paquete.noIncluye.map((item, index) => (
                            <li key={index} className="flex items-start">
                              <XCircle className="h-5 w-5 text-red-500 mr-3 shrink-0 mt-0.5" />
                              <span className="text-gray-700 text-lg leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sidebar Mobile - Información de reserva (solo visible en mobile, antes de la galería) */}
              <div className="lg:hidden">
                <PaqueteSidebar paquete={paquete} />
              </div>

              {paquete.galeria.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-lg lg:text-lg font-semibold mb-6">Galería</h2>
                  <ImageGallery images={paquete.galeria} title={paquete.titulo} />
                </div>
              )}
            </div>

            {/* Sidebar Desktop - Información de reserva (solo visible en desktop) */}
            <div className="hidden lg:block lg:col-span-1">
              <PaqueteSidebar paquete={paquete} />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
