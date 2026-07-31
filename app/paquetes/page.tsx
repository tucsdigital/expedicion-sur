import { collection, getDocs, limit, orderBy as firestoreOrderBy, query, where } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Paquete, Categoria } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import PaquetesClient from '@/components/PaquetesClient';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Excursiones - ${SITE_NAME}`,
  description: `Explorá nuestras excursiones con ${SITE_NAME}. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: `${siteUrl}/paquetes`,
  },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/paquetes`,
    title: `Excursiones - ${SITE_NAME}`,
    description: `Explorá nuestras excursiones con ${SITE_NAME}.`,
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Excursiones - ${SITE_NAME}`,
    description: `Explorá nuestras excursiones con ${SITE_NAME}.`,
  },
  keywords: [...siteConfig.seo.keywords, 'paquetes', 'paquetes turísticos'],
};

/** Sin caché: los cambios del admin (paquetes) se ven de inmediato */
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function getPaquetes(): Promise<Paquete[]> {
  if (!firebaseEnabled) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'paquetes'),
        where('visible', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // Fallback sin índice compuesto
    const snapshot = await getDocs(query(collection(db, 'paquetes'), where('visible', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

async function getCategorias(): Promise<Categoria[]> {
  if (!firebaseEnabled) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'categorias'),
        where('activa', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }));
  } catch (error) {
    const snapshot = await getDocs(query(collection(db, 'categorias'), where('activa', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

function normalizeParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export default async function PaquetesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [paquetes, categorias] = await Promise.all([
    getPaquetes(),
    getCategorias(),
  ]);

  const tipos = normalizeParam(resolvedSearchParams.tipo);
  const tag = normalizeParam(resolvedSearchParams.tag);
  const transportes = normalizeParam(resolvedSearchParams.transporte);

  let heroTitle = 'Excursiones';
  let heroSubtitle = 'Descubre los mejores destinos turísticos con excursiones diseñadas para ti';

  if (tipos.includes('grupal')) {
    heroTitle = 'Salidas grupales';
    heroSubtitle = 'Viajes organizados para compartir, con todo planificado';
  } else if (tipos.includes('internacional')) {
    heroTitle = 'Excursiones internacionales';
    heroSubtitle = 'Explorá destinos internacionales con propuestas seleccionadas';
  } else if (tipos.includes('educativo')) {
    heroTitle = 'Excursiones educativas';
    heroSubtitle = 'Opciones pensadas para instituciones, contingentes y grupos';
  } else if (tipos.includes('eventos') || tipos.includes('recitales')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  } else if (transportes.length > 0) {
    heroTitle = 'Excursiones con transporte';
    heroSubtitle = 'Encontrá excursiones por tipo de transporte';
  } else if (tag.includes('promo')) {
    heroTitle = 'Promos';
    heroSubtitle = 'Ofertas y oportunidades para viajar al mejor precio';
  } else if (tag.includes('escapada') || tag.includes('religioso')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  }

  return (
    <>
      <Navbar theme="rio" />
      <WhatsAppButton />

      {/* Hero: fondo cream, texto negro (alineado a la página principal) */}
      <section className="relative bg-cream text-black pt-24 pb-12 md:pt-32 md:pb-16 border-b border-gray-200">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mx-auto pt-24 text-center md:text-left">
            <h1 className="text-[40px] leading-[50px] tracking-[1px] font-semibold mb-3 md:mb-4 font-heading text-black">
              {heroTitle}
            </h1>
            <p className="text-base md:text-lg text-gray-700 font-body leading-relaxed">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      <PaquetesClient paquetes={paquetes} categorias={categorias} />

      <Footer />
    </>
  );
}
