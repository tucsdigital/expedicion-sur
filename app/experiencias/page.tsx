import { collection, getDocs, orderBy as firestoreOrderBy, query, where } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Categoria, Paquete } from '@/types';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import PaquetesClient from '@/components/PaquetesClient';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { buildPageTitle, siteConfig } from '@/lib/siteConfig';
import { syncPackageCategoryData } from '@/lib/packages/category-utils';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: buildPageTitle('Experiencias'),
  description: `Explorá nuestras experiencias con ${SITE_NAME}. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: `${siteUrl}/experiencias`,
  },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/experiencias`,
    title: buildPageTitle('Experiencias'),
    description: `Explorá nuestras experiencias con ${SITE_NAME}.`,
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: buildPageTitle('Experiencias'),
    description: `Explorá nuestras experiencias con ${SITE_NAME}.`,
  },
  keywords: [...siteConfig.seo.keywords, 'experiencias', 'salidas', 'viajes'],
};

/** Sin caché: los cambios del admin (experiencias) se ven de inmediato */
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

function normalizeText(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default async function ExperienciasPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [paquetes, categorias] = await Promise.all([getPaquetes(), getCategorias()]);
  const normalizedPaquetes = paquetes.map((paquete) => syncPackageCategoryData(paquete, categorias));

  const tipos = normalizeParam(resolvedSearchParams.tipo);
  const tag = normalizeParam(resolvedSearchParams.tag);
  const transportes = normalizeParam(resolvedSearchParams.transporte);
  const destinosSeleccionados = normalizeParam([
    ...(Array.isArray(resolvedSearchParams.destino)
      ? resolvedSearchParams.destino
      : resolvedSearchParams.destino
        ? [resolvedSearchParams.destino]
        : []),
    ...(Array.isArray(resolvedSearchParams.categoria)
      ? resolvedSearchParams.categoria
      : resolvedSearchParams.categoria
        ? [resolvedSearchParams.categoria]
        : []),
  ]);

  let heroTitle = 'Experiencias';
  let heroSubtitle = 'Descubrí experiencias y salidas pensadas para vivir momentos inolvidables';
  const categoriaPrincipal =
    destinosSeleccionados.length === 1
      ? categorias.find((categoria) => {
          const selectedDestino = destinosSeleccionados[0];
          return (
            normalizeText(categoria.slug) === selectedDestino ||
            normalizeText(categoria.nombre) === selectedDestino
          );
        }) ?? null
      : null;

  if (categoriaPrincipal) {
    heroTitle = categoriaPrincipal.nombre;
    heroSubtitle =
      categoriaPrincipal.descripcion || `Explorá las experiencias disponibles en ${categoriaPrincipal.nombre}`;
  } else if (tipos.includes('grupal')) {
    heroTitle = 'Salidas grupales';
    heroSubtitle = 'Viajes organizados para compartir, con todo planificado';
  } else if (tipos.includes('internacional')) {
    heroTitle = 'Experiencias internacionales';
    heroSubtitle = 'Explorá destinos internacionales con propuestas seleccionadas';
  } else if (tipos.includes('educativo')) {
    heroTitle = 'Experiencias educativas';
    heroSubtitle = 'Opciones pensadas para instituciones, contingentes y grupos';
  } else if (tipos.includes('eventos') || tipos.includes('recitales')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  } else if (transportes.length > 0) {
    heroTitle = 'Experiencias con transporte';
    heroSubtitle = 'Encontrá experiencias por tipo de transporte';
  } else if (tag.includes('promo')) {
    heroTitle = 'Promos';
    heroSubtitle = 'Ofertas y oportunidades para viajar al mejor precio';
  } else if (tag.includes('escapada') || tag.includes('religioso')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  }

  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <section className="relative border-b border-[#EDF2F7] bg-white pb-10 pt-24 text-black md:pb-12 md:pt-28">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mx-auto text-center md:text-left">
            <h1 className="mb-3 text-[34px] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#112B49] md:mb-4 md:text-[44px]">
              {heroTitle}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#6C829A] md:text-lg">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      <PaquetesClient paquetes={normalizedPaquetes} categorias={categorias} />

      <HomeFooter />
    </>
  );
}
