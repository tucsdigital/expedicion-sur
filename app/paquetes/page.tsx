import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PaquetesClient from '@/components/PaquetesClient';
import PublicInquiryForm from '@/components/forms/PublicInquiryForm';
import WhatsAppOfficialIcon from '@/components/WhatsAppOfficialIcon';
import WhatsAppButton from '@/components/WhatsAppButton';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { getPaquetesPageData } from '@/lib/paquetesData';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Experiencias y Excursiones - ${SITE_NAME}`,
  description: `${SITE_DESCRIPTION} Conoce nuestras salidas destacadas y solicita asesoramiento personalizado.`,
  alternates: {
    canonical: `${siteUrl}/paquetes`,
  },
};

export default async function PaquetesPage() {
  const { paquetes, categorias, interestOptions } = await getPaquetesPageData();

  return (
    <>
      <Navbar reserveSpace />
      <WhatsAppButton />

      <main className="bg-[var(--color-cream)] px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <section className="mx-auto max-w-7xl overflow-hidden rounded-[34px] border border-[rgba(17,17,17,0.06)] bg-neutral-950 px-6 py-10 text-white shadow-[0_24px_70px_rgba(17,17,17,0.16)] md:px-10 md:py-14">
          <div className="max-w-3xl space-y-5">
            <span className="rounded-full border border-white/16 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/84">
              Catalogo Dinamico
            </span>
            <h1 className="text-4xl font-semibold tracking-[-0.06em] md:text-6xl">
              Todas las experiencias se cargan desde Firestore y quedan listas para vender.
            </h1>
            <p className="text-lg leading-8 text-white/74">
              Explora salidas, filtra por destino o tipo de viaje y lleva la consulta directo a WhatsApp.
            </p>

            <div className="flex flex-wrap gap-3 text-sm text-white/72">
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {paquetes.length} paquetes visibles
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {categorias.length} categorias activas
              </span>
            </div>

            <a
              href={getWhatsAppLink('Hola! Quiero recibir asesoramiento sobre las experiencias de Expedicion Sur.')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111111] px-6 text-sm font-semibold text-[#CBBBA0] transition hover:bg-[#E30613] hover:text-[#CBBBA0]"
            >
              <WhatsAppOfficialIcon className="h-4 w-4" />
              Asesoramiento por WhatsApp
            </a>
          </div>
        </section>

        <div className="mx-auto mt-10 max-w-7xl">
          <PaquetesClient paquetes={paquetes} categorias={categorias} />
        </div>

        <section className="mx-auto mt-14 grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="premium-card p-7 md:p-8">
            <span className="rounded-full border border-[rgba(17,17,17,0.08)] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-700">
              Reserva y Consultas
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-neutral-950">
              Converti el interes en una conversacion real.
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-650">
              El formulario toma como opciones los paquetes reales cargados en Firestore para mantener todo alineado con el catalogo vivo.
            </p>
          </div>

          <div className="premium-card p-7 md:p-8">
            <PublicInquiryForm compact interestOptions={interestOptions} />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
