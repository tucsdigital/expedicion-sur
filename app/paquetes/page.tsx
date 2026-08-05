import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PaquetesClient from '@/components/PaquetesClient';
import WhatsAppButton from '@/components/WhatsAppButton';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { getPaquetesPageData } from '@/lib/paquetesData';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Paquetes y Excursiones - ${SITE_NAME}`,
  description: `${SITE_DESCRIPTION} Explorá nuestros paquetes, filtra por destino y encontrá la salida que buscás.`,
  alternates: {
    canonical: `${siteUrl}/paquetes`,
  },
};

export default async function PaquetesPage() {
  const { paquetes, categorias } = await getPaquetesPageData();

  return (
    <>
      <Navbar reserveSpace />
      <WhatsAppButton />

      <main className="bg-[var(--color-cream)] px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PaquetesClient paquetes={paquetes} categorias={categorias} />
        </div>
      </main>

      <Footer />
    </>
  );
}
