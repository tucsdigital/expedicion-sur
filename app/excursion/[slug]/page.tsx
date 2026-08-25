import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Categoria, Paquete } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import HomeFeaturesRow from '@/components/home/HomeFeaturesRow';
import WhatsAppButton from '@/components/WhatsAppButton';
import PaqueteSidebar from '@/components/PaqueteSidebar';
import PaqueteSchema from '@/components/PaqueteSchema';
import PaqueteCarousel from '@/components/paquete/PaqueteCarousel';
import PaqueteGalleryGrid from '@/components/paquete/PaqueteGalleryGrid';
import PaqueteGoogleMap from '@/components/paquete/PaqueteGoogleMap';
import PaqueteItinerary from '@/components/paquete/PaqueteItinerary';
import Link from 'next/link';
import { CheckCircle, XCircle, MapPin, Facebook, Instagram, Link2, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { getPaqueteBySlug } from '@/lib/paquetes';
import { getOperationalSalidas, resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import { getPrimaryPackageCategoryId } from '@/lib/packages/category-utils';
import { getAvailableForPackageDate } from '@/lib/cart/server';
import { sanitizePackageRichHtml } from '@/lib/packages/rich-text-sanitize';
import { extractPlainTextFromRichText } from '@/lib/packages/rich-text-validation';
import { buildPageTitle } from '@/lib/siteConfig';

/** Sin caché: los cambios del admin se ven de inmesdiato */
export const revalidate = 0;

function normalizeCondiciones(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const titulo = String((item as { titulo?: unknown }).titulo ?? '').trim();
      const texto = String((item as { texto?: unknown }).texto ?? '').trim();
      if (!titulo || !texto) return null;
      return { titulo, texto };
    })
    .filter((item): item is { titulo: string; texto: string } => Boolean(item));
  return parsed;
}

async function getPaquete(slug: string): Promise<Paquete | null> {
  if (!firebaseEnabled) return null;
  try {
    const paquete = await getPaqueteBySlug(slug);
    if (!paquete || !paquete.visible) return null;

    const descripcionHtml = sanitizePackageRichHtml(paquete.descripcionLarga || paquete.descripcion);
    const itinerarioHtml = sanitizePackageRichHtml(paquete.itinerario);
    const itinerarioSteps = Array.isArray((paquete as any).itinerarioSteps)
      ? (paquete as any).itinerarioSteps
        .map((step: any) => ({
          id: String(step?.id ?? '').trim(),
          titulo: String(step?.titulo ?? '').trim(),
          descripcion: sanitizePackageRichHtml(step?.descripcion),
        }))
        .filter((step: any) => Boolean(step.id) && (Boolean(step.titulo) || Boolean(step.descripcion)))
      : [];

    return {
      ...paquete,
      descripcion: descripcionHtml || '',
      descripcionLarga: descripcionHtml || '',
      itinerario: itinerarioHtml || '',
      itinerarioSteps,
      condiciones: normalizeCondiciones((paquete as Paquete & { condiciones?: unknown }).condiciones),
    };
  } catch (error) {
    console.error('Error fetching paquete:', error);
    return null;
  }
}

async function getPrimaryDestino(paquete: Paquete): Promise<Categoria | null> {
  const categoriaId = getPrimaryPackageCategoryId(paquete);
  if (!firebaseEnabled || !categoriaId) return null;

  try {
    const snapshot = await getDoc(doc(db, 'categorias', categoriaId));
    if (!snapshot.exists()) return null;

    const categoria = serializeFirestoreData<Categoria>({
      id: snapshot.id,
      ...snapshot.data(),
    });

    return categoria.activa ? categoria : null;
  } catch (error) {
    console.error('Error fetching destino:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const siteUrl = SITE_URL;
    const url = `${siteUrl}/excursion/${slug}`;
    return {
      title: buildPageTitle(slug),
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
  const url = `${siteUrl}/excursion/${slug}`;

  const cleanDescription =
    paquete.descripcionCorta ||
    `${extractPlainTextFromRichText(paquete.descripcionLarga || paquete.descripcion).substring(0, 160).trim()}...`;

  const coverImage = paquete.imagenPortada || paquete.imagenTarjeta || paquete.imagenPrincipal;

  return {
    title: buildPageTitle(paquete.titulo),
    description: cleanDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: buildPageTitle(paquete.titulo),
      description: cleanDescription,
      siteName: SITE_NAME,
      locale: 'es_AR',
      images: coverImage
        ? [
          {
            url: coverImage,
            width: 1200,
            height: 630,
            alt: paquete.titulo,
          },
        ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: buildPageTitle(paquete.titulo),
      description: cleanDescription,
      images: coverImage ? [coverImage] : [],
    },
    keywords: [paquete.titulo, paquete.destino || 'destino', 'excursiones', 'viajes', 'turismo', SITE_NAME],
  };
}

export default async function ExcursionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!firebaseEnabled) {
    return (
      <>
        <Navbar variant="homeMockup" reserveSpace />
        <WhatsAppButton />
        <section className="bg-white py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="mb-4 font-heading text-[32px] font-semibold leading-[40px] tracking-[0.5px] text-black">
                {slug}
              </h1>
              <p className="font-body text-base leading-relaxed text-gray-700 md:text-lg">
                Este contenido requiere configuración de Firebase para mostrarse.
              </p>
            </div>
          </div>
        </section>
        <HomeFooter />
      </>
    );
  }
  const paquete = await getPaquete(slug);

  if (!paquete) {
    notFound();
  }

  const destinoCategoria = await getPrimaryDestino(paquete);

  const images = Array.from(new Set((paquete.galeria ?? []).map((s) => String(s || '').trim()).filter(Boolean)));
  const short = (paquete.descripcionCorta || '').trim();
  const destino = paquete.destino || paquete.eventoLugar || 'Argentina';
  const locationText = paquete.eventoLugar || paquete.destino || destino;
  const longDescriptionHtml = sanitizePackageRichHtml(paquete.descripcionLarga || paquete.descripcion);
  const bookingDates = await Promise.all(
    getOperationalSalidas(paquete).map(async (salida) => {
      const resolved = resolveDepartureConfig(paquete, salida.fecha);
      const available = await getAvailableForPackageDate(paquete, salida.fecha);
      return {
        date: salida.fecha,
        available,
        capacity: resolved.baseCapacity,
      };
    })
  );

  return (
    <div className="min-h-screen bg-white">
      <PaqueteSchema paquete={paquete} basePath="/excursion" />
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />
      <PaqueteCarousel images={images} title={paquete.titulo} />
      <main className="container mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="text-xs text-gray-500 md:text-sm">
          <Link href="/" className="hover:text-black">
            Inicio
          </Link>
          <span className="mx-2">›</span>
          <Link href="/excursiones" className="hover:text-black">
            Excursiones
          </Link>
          <span className="mx-2">›</span>
          {destinoCategoria?.slug ? (
            <Link href={`/destinos/${destinoCategoria.slug}`} className="hover:text-black">
              {destinoCategoria.nombre}
            </Link>
          ) : (
            <span>{destino}</span>
          )}
          <span className="mx-2">›</span>
          <span className="text-black">{paquete.titulo}</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <div>
                <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-black">
                  {paquete.titulo}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  {short || 'Naturaleza imponente, aventura y confort en una experiencia única.'}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <MapPin className="h-4 w-4 text-success" />
                  {locationText}
                </div>
                {longDescriptionHtml ? (
                  <div
                    className="prose prose-sm mt-4 max-w-none text-gray-700 prose-headings:text-black prose-strong:text-black md:prose-base"
                    dangerouslySetInnerHTML={{ __html: longDescriptionHtml }}
                  />
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-gray-700">
                    Descubrí paisajes inolvidables y experiencias únicas con un programa premium que combina excursiones, alojamientos seleccionados y servicios exclusivos.
                  </p>
                )}
              </div>

              {images.length > 1 ? (
                <div className="mt-5">
                  <PaqueteGalleryGrid images={images.slice(0)} title={paquete.titulo} />
                </div>
              ) : null}
            </div>

            <PaqueteItinerary steps={paquete.itinerarioSteps} html={paquete.itinerario} visible={paquete.mostrarItinerario} />

            {(paquete.incluye.length > 0 || (paquete.noIncluye && paquete.noIncluye.length > 0)) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-black">Incluye</h3>
                  <ul className="mt-3 space-y-2">
                    {paquete.incluye.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-black">No incluye</h3>
                  <ul className="mt-3 space-y-2">
                    {(paquete.noIncluye || []).map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <PaqueteGoogleMap title={paquete.titulo} embedUrl={paquete.mapaGoogleEmbedUrl} />

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-black">Compartí esta experiencia</h3>
              <div className="mt-3 flex items-center gap-2.5">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Compartir por WhatsApp"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Compartir en Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Compartir en Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Copiar enlace"
                >
                  <Link2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="xl:sticky xl:top-24">
              <PaqueteSidebar paquete={paquete} bookingDates={bookingDates} />
            </div>
          </aside>
        </div>
      </main>

      <HomeFeaturesRow />
      <HomeFooter />
    </div>
  );
}
