'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl } from '@/lib/siteConfig';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';
import WhatsAppOfficialIcon from '@/components/WhatsAppOfficialIcon';

interface NavbarProps {
  reserveSpace?: boolean;
  theme?: 'default' | 'rio';
  transparent?: boolean;
  forceTransparent?: boolean;
}

const links = [
  { href: '/#inicio', label: 'Inicio' },
  { href: '/#paquetes', label: 'Paquetes' },
  { href: '/#destinos', label: 'Destinos' },
  { href: '/#experiencias', label: 'Experiencias' },
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/#contacto', label: 'Contacto' },
];

export default function Navbar({ reserveSpace = false }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [navHeight, setNavHeight] = useState(0);
  const logoSrc = getBrandLogoSrc();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : original;
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileMenuOpen]);

  useLayoutEffect(() => {
    if (!reserveSpace) return;

    const updateHeight = () => {
      setNavHeight(navRef.current?.getBoundingClientRect().height ?? 0);
    };

    updateHeight();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateHeight)
        : null;

    if (observer && navRef.current) observer.observe(navRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      observer?.disconnect();
    };
  }, [reserveSpace]);

  return (
    <>
      {reserveSpace ? (
        <div aria-hidden style={{ height: navHeight }} className="w-full" />
      ) : null}

      <nav
        ref={navRef as React.RefObject<HTMLElement>}
        className="fixed inset-x-0 top-0 z-[120] px-4 py-4 md:px-6 lg:px-8"
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between rounded-full border px-4 py-3 transition duration-300 md:px-5 ${
            isScrolled
              ? 'border-[rgba(17,17,17,0.08)] bg-white/86 shadow-[0_20px_50px_rgba(17,17,17,0.08)] backdrop-blur-xl'
              : 'border-white/40 bg-white/72 shadow-[0_18px_40px_rgba(17,17,17,0.05)] backdrop-blur-xl'
          }`}
        >
          <Link href="/" className="flex items-center gap-3">
            {isRemoteUrl(logoSrc) ? (
              <img src={logoSrc} alt="Expedicion Sur" className="h-10 w-auto" />
            ) : (
              <Image
                src={logoSrc}
                alt="Expedicion Sur"
                width={180}
                height={48}
                className="h-10 w-auto"
              />
            )}
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-700 transition hover:text-[#111111]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm text-neutral-500">{CONTACT_INFO.telefono}</span>
            <a
              href={getWhatsAppLink('Hola! Quiero reservar con Expedicion Sur.')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-semibold text-[#CBBBA0] transition hover:bg-[#E30613] hover:text-[#CBBBA0]"
            >
              <WhatsAppOfficialIcon className="h-4 w-4" />
              Reservar
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 ring-1 ring-[rgba(17,17,17,0.08)] lg:hidden"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="mx-auto mt-3 max-w-7xl rounded-[28px] border border-[rgba(17,17,17,0.08)] bg-white/94 p-5 shadow-[0_24px_60px_rgba(17,17,17,0.12)] backdrop-blur-2xl lg:hidden">
            <div className="space-y-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <a
              href={getWhatsAppLink('Hola! Quiero reservar con Expedicion Sur.')}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-semibold text-[#CBBBA0] transition hover:bg-[#E30613] hover:text-[#CBBBA0]"
            >
              <WhatsAppOfficialIcon className="h-4 w-4" />
              Reservar por WhatsApp
            </a>
          </div>
        ) : null}
      </nav>
    </>
  );
}
