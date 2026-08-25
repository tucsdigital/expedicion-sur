'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, Clock3, Instagram, Mail, MapPin } from 'lucide-react';
import WhatsAppOfficialIcon from '@/components/WhatsAppOfficialIcon';
import PublicInquiryForm from '@/components/forms/PublicInquiryForm';
import { CONTACT_INFO, SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';

interface ContactSplitSectionProps {
  interestOptions?: string[];
  showMap?: boolean;
  className?: string;
}

export default function ContactSplitSection({
  interestOptions = [],
  showMap = true,
  className = '',
}: ContactSplitSectionProps) {
  const instagramHandle = SOCIAL_MEDIA.instagramHandle || '@expedicionsur.fte';
  const addressLines = CONTACT_INFO.direccion
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const contactItems = useMemo(
    () => [
      {
        id: 'whatsapp',
        title: 'WhatsApp',
        value: CONTACT_INFO.telefono,
        caption: 'Respuesta rapida',
        href: getWhatsAppLink('Hola! Quiero reservar con Expedicion Sur.'),
        external: true,
        icon: (className: string) => <WhatsAppOfficialIcon className={className} />,
      },
      {
        id: 'email',
        title: 'Email',
        value: CONTACT_INFO.email,
        caption: 'Respondemos a la brevedad',
        href: `mailto:${CONTACT_INFO.email}`,
        external: false,
        icon: (className: string) => <Mail className={className} />,
      },
      {
        id: 'horario',
        title: 'Horario',
        value: CONTACT_INFO.horario,
        caption: 'Todos los dias',
        icon: (className: string) => <Clock3 className={className} />,
      },
      {
        id: 'instagram',
        title: 'Instagram',
        value: instagramHandle,
        caption: 'Novedades y consultas',
        href: SOCIAL_MEDIA.instagram,
        external: true,
        icon: (className: string) => <Instagram className={className} />,
      },
    ],
    [instagramHandle]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeItem = contactItems[activeIndex] ?? contactItems[0];

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || contactItems.length <= 1) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setActiveIndex((current) => (current + 1) % contactItems.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [contactItems.length, isPaused, prefersReducedMotion]);

  return (
    <div className={`space-y-4 md:space-y-5 ${className}`.trim()}>
      <div className="overflow-hidden">
        <div className="grid items-stretch gap-3 md:gap-4 xl:grid-cols-[0.94fr_1.06fr]">
          <section
            className="flex h-full flex-col rounded-[22px] border border-[rgba(17,17,17,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(247,243,237,0.95)_100%)] p-3.5 shadow-[0_14px_36px_rgba(17,17,17,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(17,17,17,0.08)] md:rounded-[24px] md:p-5 lg:p-6"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
          >
            <div className="flex h-full flex-col gap-3 md:gap-3.5">
              <div className="space-y-1.5">
                <span className="inline-flex rounded-full border border-[#F4D1D4] bg-[#FFF1F1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E30613] md:px-3 md:text-[11px] md:tracking-[0.18em]">
                  Contacto
                </span>
                <h2 className="max-w-[230px] text-[24px] font-semibold leading-[0.9] tracking-[-0.055em] text-neutral-950 md:max-w-[290px] md:text-[34px] lg:max-w-[320px] lg:text-[38px]">
                  Estamos para ayudarte
                </h2>
                <p className="text-[12px] italic leading-5 text-[#D55252] md:text-[14px] md:leading-5.5 lg:text-[15px] lg:leading-6">
                  Tu proxima aventura comienza con un mensaje.
                </p>
                <p className="max-w-[410px] text-[11px] leading-5 text-neutral-600 md:max-w-[430px] md:text-[13px] md:leading-6 lg:max-w-[480px] lg:text-[14px] lg:leading-7">
                  En Expedicion Sur estamos listos para asesorarte y ayudarte a planificar la mejor experiencia en la Patagonia.
                </p>
              </div>

              <div className="flex flex-1 flex-col">
                <div
                  className="flex flex-1 flex-col gap-1.5"
                  aria-live={prefersReducedMotion ? 'polite' : 'off'}
                >
                  {contactItems.map((item, index) => {
                    const isActive = index === activeIndex;

                    return (
                      <div
                        key={`accordion-${item.id}`}
                        className={`overflow-hidden rounded-[18px] border bg-white/95 shadow-[0_12px_30px_rgba(17,17,17,0.05)] transition duration-300 md:rounded-[20px] ${
                          isActive
                            ? 'border-[#E30613]/20'
                            : 'border-[rgba(17,17,17,0.07)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left md:gap-3 md:px-3.5 md:py-3 lg:px-4 lg:py-4"
                          aria-expanded={isActive}
                          aria-controls={`contact-panel-${item.id}`}
                        >
                          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:h-10 md:w-10 md:rounded-2xl ${isActive ? 'bg-[#FFE5E5] text-[#E30613]' : 'bg-[#EDE3D0] text-neutral-900'}`}>
                            {item.icon('h-4 w-4 md:h-4.5 md:w-4.5')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 md:text-[11px] md:tracking-[0.14em]">
                              {item.title}
                            </p>
                            <p className={`mt-0.5 break-words text-[12px] font-semibold leading-5 md:text-[14px] md:leading-5.5 lg:mt-1 lg:text-[16px] lg:leading-6 ${isActive ? 'text-[#E30613]' : 'text-neutral-900'}`}>
                              {item.value}
                            </p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-neutral-400 transition duration-300 md:h-4.5 md:w-4.5 ${
                              isActive ? 'rotate-180 text-[#E30613]' : ''
                            }`}
                          />
                        </button>

                        <div
                          id={`contact-panel-${item.id}`}
                          className={`grid transition-all duration-300 ease-out ${
                            isActive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="border-t border-[rgba(17,17,17,0.06)] px-3 pb-3 pt-2 md:px-3.5 md:pb-3.5 md:pt-2.5 lg:px-4 lg:pb-4 lg:pt-3">
                              <p className="text-[11px] leading-5 text-neutral-600 md:text-[12px] md:leading-5.5 lg:text-[13px] lg:leading-6">
                                {item.caption}
                              </p>

                              {item.href ? (
                                <a
                                  href={item.href}
                                  target={item.external ? '_blank' : undefined}
                                  rel={item.external ? 'noreferrer' : undefined}
                                  className="mt-2.5 inline-flex h-8.5 items-center justify-center gap-2 rounded-2xl border border-[rgba(17,17,17,0.08)] bg-[#FCFBF9] px-3.5 text-[11px] font-semibold text-neutral-900 transition duration-300 hover:border-[#E30613]/30 hover:text-[#E30613] md:mt-3 md:h-9 lg:mt-4 lg:h-10 lg:px-4 lg:text-sm"
                                >
                                  Ir a {item.title}
                                  <ArrowUpRight className="h-4 w-4" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="flex h-full flex-col rounded-[24px] border border-[rgba(17,17,17,0.07)] bg-white p-4 shadow-[0_14px_36px_rgba(17,17,17,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(17,17,17,0.08)] md:p-6 lg:p-7">
            <PublicInquiryForm interestOptions={interestOptions} variant="contact" stretch />
          </section>
        </div>
      </div>

      {showMap && (
        <div className="overflow-hidden rounded-[30px] border border-[rgba(17,17,17,0.08)] bg-white shadow-[0_18px_48px_rgba(17,17,17,0.06)]">
          <div className="relative">
            <div className="absolute left-3 top-3 z-10 md:hidden">
              <div className="h-[150px] w-[200px] overflow-hidden rounded-[20px] border border-[rgba(17,17,17,0.08)] bg-white/96 p-2.5 shadow-[0_14px_30px_rgba(17,17,17,0.14)] backdrop-blur">
                <div className="flex h-full flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#E30613]">
                        <MapPin className="h-3 w-3" />
                      </span>
                      <span className="block text-[10px] font-semibold leading-4 text-[#E30613]">
                        Nuestra ubicacion
                      </span>
                    </div>

                    <span className="block text-[8px] leading-3.5 text-neutral-500">
                      Visitanos o escribinos para coordinar tu viaje.
                    </span>

                    <div className="space-y-0.5 text-[8.5px] font-medium leading-3.5 text-neutral-700">
                      {addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_INFO.direccion)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[30px] w-[30px] items-center justify-center self-end rounded-full bg-[#EDE3D0] text-neutral-900 transition duration-300 hover:bg-[#E3D6BF]"
                    aria-label="Como llegar"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="absolute left-8 top-8 z-10 hidden w-[320px] rounded-[24px] border border-[rgba(17,17,17,0.08)] bg-white/96 p-5 shadow-[0_18px_36px_rgba(17,17,17,0.12)] backdrop-blur md:block">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF1F1] text-[#E30613]">
                  <MapPin className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#E30613]">Nuestra ubicacion</p>
                  <p className="text-[12px] leading-5 text-neutral-500">
                    Visitanos o escribinos para coordinar tu viaje.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-sm leading-6 text-neutral-700">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_INFO.direccion)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#EDE3D0] px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-900 transition duration-300 hover:bg-[#E3D6BF]"
              >
                Como llegar
              </a>
            </div>
            <iframe
              src={CONTACT_INFO.mapUrl}
              className="h-[420px] w-full border-0 md:h-[440px] xl:h-[480px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Mapa de ${SITE_NAME}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
