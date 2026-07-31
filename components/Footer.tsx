import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Mail } from 'lucide-react';
import WhatsAppOfficialIcon from '@/components/WhatsAppOfficialIcon';
import { CONTACT_INFO, SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, siteConfig } from '@/lib/siteConfig';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';

export default function Footer() {
  const logoSrc = getBrandLogoSrc();
  const developer = siteConfig.company.developerCredits;
  const sectionTitleClass =
    'text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48 md:text-[11px] md:tracking-[0.22em]';
  const linkListClass =
    'mt-3 space-y-2 text-[13px] leading-6 text-white/72 md:mt-4 md:space-y-2.5 md:text-[14px] md:leading-6';
  const metaTextClass =
    'text-[12px] leading-5.5 text-white/58 md:text-[13px] md:leading-6';

  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-[1.2fr_0.85fr_1fr_0.8fr] xl:gap-10">
          <div className="space-y-3.5 md:space-y-4.5">
            <div className="flex items-center">
              <div className="inline-flex rounded-[18px] bg-white p-2 shadow-[0_16px_36px_rgba(255,255,255,0.08)] md:rounded-[20px] md:p-3">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={SITE_NAME} className="h-8.5 w-auto object-contain md:h-11" />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={SITE_NAME}
                    width={210}
                    height={56}
                    className="h-8.5 w-auto object-contain md:h-11"
                  />
                )}
              </div>
            </div>
            <p className="max-w-sm text-[13px] leading-6 text-white/72 md:max-w-md md:text-[14px] md:leading-6.5">
              Expedicion Sur conecta viajeros con la Patagonia mediante experiencias
              autenticas, seguras y personalizadas.
            </p>
          </div>

          <div>
            <p className={sectionTitleClass}>
              Menu
            </p>
            <div className={linkListClass}>
              <Link href="/" className="block transition hover:text-white">
                Inicio
              </Link>
              <Link href="/#paquetes" className="block transition hover:text-white">
                Paquetes
              </Link>
              <Link href="/#destinos" className="block transition hover:text-white">
                Destinos
              </Link>
              <Link href="/#experiencias" className="block transition hover:text-white">
                Experiencias
              </Link>
              <Link href="/#nosotros" className="block transition hover:text-white">
                Nosotros
              </Link>
              <Link href="/#contacto" className="block transition hover:text-white">
                Contacto
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClass}>
              Contacto
            </p>
            <div className="mt-3 space-y-2.5 md:mt-4 md:space-y-3">
              <p className="text-[14px] font-medium leading-6 text-white/88 md:text-[15px]">
                {CONTACT_INFO.telefono}
              </p>
              <p className="text-[13px] leading-6 text-white/72 md:text-[14px]">
                {CONTACT_INFO.email}
              </p>
              <p className={metaTextClass}>{CONTACT_INFO.horario}</p>
              <p className={`${metaTextClass} max-w-[18rem]`}>
                El Calafate, Santa Cruz, Argentina
              </p>
            </div>
          </div>

          <div>
            <p className={sectionTitleClass}>
              Redes
            </p>
            <div className="mt-3 flex gap-2.5 md:mt-4 md:gap-3">
              <a
                href={getWhatsAppLink('Hola! Quiero reservar con Expedicion Sur.')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white transition hover:bg-[#25D366] md:h-11 md:w-11"
                aria-label="WhatsApp"
              >
                <WhatsAppOfficialIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a
                href={SOCIAL_MEDIA.email}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white transition hover:bg-white/16 md:h-11 md:w-11"
                aria-label="Email"
              >
                <Mail className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a
                href={SOCIAL_MEDIA.instagram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white transition hover:bg-[#E30613] md:h-11 md:w-11"
                aria-label="Instagram"
              >
                <Instagram className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-white/10 pt-4 text-[11px] leading-5 text-white/55 md:mt-9 md:flex-row md:items-center md:justify-between md:gap-4 md:pt-5 md:text-[12px] md:leading-6">
          <p className="max-w-[28rem]">
            &copy; {new Date().getFullYear()} {SITE_NAME}. Todos los derechos reservados.
          </p>
          <p className="text-white/60">
            Desarrollo: {developer.url ? (
              <a
                href={developer.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-white/82 transition hover:text-white"
              >
                {developer.name}
              </a>
            ) : (
              developer.name
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
