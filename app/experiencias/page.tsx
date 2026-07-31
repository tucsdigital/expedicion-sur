import { getExperiencias } from '@/lib/experiencias';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import ExperienciasClient from '@/components/ExperienciasClient';
import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Experiencias - ${SITE_NAME}`,
  description: `Viví cada destino con ${SITE_NAME}. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: `${siteUrl}/experiencias`,
  },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/experiencias`,
    title: `Experiencias - ${SITE_NAME}`,
    description: `Experiencias para viajar con ${SITE_NAME}.`,
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Experiencias - ${SITE_NAME}`,
    description: `Experiencias para viajar con ${SITE_NAME}.`,
  },
  keywords: [...siteConfig.seo.keywords, 'experiencias', 'excursiones', 'reservas'],
};

/** Sin caché: los cambios del admin (experiencias) se ven de inmediato */
export const revalidate = 0;

export default async function ExperienciasPage() {
  const experiencias = await getExperiencias({ visibleOnly: true });

  return (
    <>
      <Navbar theme="rio" />
      <WhatsAppButton />

      {/* Hero: fondo cream, texto negro (alineado a la página principal) */}
      <section className="relative bg-cream text-black pt-24 pb-12 md:pt-32 md:pb-16 border-b border-gray-200">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mx-auto text-center md:text-left">
            <h1 className="text-[40px] leading-[50px] tracking-[1px] font-semibold mb-3 md:mb-4 font-heading text-black">
              Experiencias
            </h1>
            <p className="text-base md:text-lg text-gray-700 font-body leading-relaxed">
              Viví cada destino con {SITE_NAME}. {SITE_DESCRIPTION}
            </p>
          </div>
        </div>
      </section>

      <ExperienciasClient experiencias={experiencias} />

      <Footer />
    </>
  );
}
