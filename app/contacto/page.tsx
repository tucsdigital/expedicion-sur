import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ContactSplitSection from '@/components/ContactSplitSection';
import WhatsAppButton from '@/components/WhatsAppButton';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { getPaquetesPageData } from '@/lib/paquetesData';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Contacto - ${SITE_NAME}`,
  description:
    'Reserva por WhatsApp, formulario o email. Te ayudamos a organizar tu viaje por la Patagonia con atencion personalizada.',
  alternates: { canonical: `${siteUrl}/contacto` },
};

export default async function ContactoPage() {
  const { interestOptions } = await getPaquetesPageData();

  return (
    <>
      <Navbar reserveSpace />
      <WhatsAppButton />

      <main className="bg-[linear-gradient(180deg,#F5F1EA_0%,#EFE8DE_100%)] px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <section className="mx-auto max-w-7xl">
          <ContactSplitSection interestOptions={interestOptions} />
        </section>
      </main>

      <Footer />
    </>
  );
}
