import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Categoria } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import Hero from '@/components/Hero';
import PaqueteCard from '@/components/PaqueteCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { buildPageTitle, siteConfig } from '@/lib/siteConfig';
import { getPaquetesByCategoria } from '@/lib/paquetes';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

function buildDestinationHeroSubtitle(description?: string | null): string {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
  if (firstSentence.length <= 140) return firstSentence;

  const truncated = text.slice(0, 140).trim();
  return `${truncated.replace(/[.,;:!?-]+$/, '')}...`;
}

async function getDestino(slug: string): Promise<Categoria | null> {
  if (!firebaseEnabled) {
    return {
      id: 'local-dev',
      nombre: slug,
      slug,
      descripcion: '',
      orden: 0,
      destacada: false,
      activa: true,
      fechaCreacion: new Date(),
    };
  }

  try {
    const q = query(collection(db, 'categorias'), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const destino = serializeFirestoreData<Categoria>({
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    });

    if (!destino.activa) return null;
    return destino;
  } catch (error) {
    console.error('Error fetching destino:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const url = `${SITE_URL}/destinos/${slug}`;
    return {
      title: buildPageTitle(slug),
      description: `Destino ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }

  const destino = await getDestino(slug);
  if (!destino) {
    return {
      title: 'Destino no encontrado',
    };
  }

  const url = `${SITE_URL}/destinos/${slug}`;

  return {
    title: buildPageTitle(destino.nombre),
    description:
      destino.descripcion ||
      `Descubrí las mejores experiencias en ${destino.nombre} con ${SITE_NAME}.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: buildPageTitle(destino.nombre),
      description:
        destino.descripcion ||
        `Descubrí las mejores experiencias en ${destino.nombre} con ${SITE_NAME}.`,
      siteName: SITE_NAME,
      locale: siteConfig.seo.locale,
      images: destino.imagen
        ? [
            {
              url: destino.imagen,
              width: 1200,
              height: 630,
              alt: destino.nombre,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: buildPageTitle(destino.nombre),
      description:
        destino.descripcion ||
        `Descubrí las mejores experiencias en ${destino.nombre} con ${SITE_NAME}.`,
      images: destino.imagen ? [destino.imagen] : [],
    },
    keywords: [...siteConfig.seo.keywords, destino.nombre, 'viajes', 'turismo', 'experiencias', 'destinos'],
  };
}

export default async function DestinoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destino = await getDestino(slug);

  if (!destino) {
    notFound();
  }

  const paquetes = await getPaquetesByCategoria(destino.id);
  const heroSubtitle = buildDestinationHeroSubtitle(destino.descripcion);

  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <Hero
        title={destino.nombre}
        subtitle={heroSubtitle}
        backgroundImage={destino.imagen}
        height="sm"
        contentVariant="compact"
      />

      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          {paquetes.length > 0 ? (
            <>
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-lg font-bold md:text-lg lg:text-lg">Excursiones disponibles</h2>
                <p className="text-base text-gray-600 md:text-lg">
                  {paquetes.length} {paquetes.length === 1 ? 'experiencia disponible' : 'experiencias disponibles'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {paquetes.map((paquete, index) => (
                  <PaqueteCard key={paquete.id} paquete={paquete} index={index} />
                ))}
              </div>
            </>
          ) : (
            <div className="py-20 text-center">
              <h3 className="mb-4 text-base font-semibold md:text-lg lg:text-lg">No hay experiencias disponibles</h3>
              <p className="text-base text-gray-600 md:text-lg">
                  No hay experiencias en este destino. ¡Consultanos para armar tu viaje a medida!
              </p>
            </div>
          )}
        </div>
      </section>

      <HomeFooter />
    </>
  );
}
