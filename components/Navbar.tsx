'use client';

import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, Briefcase, MapPin, Compass, Phone, Mail, Search, MessageCircle } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';
import { SITE_NAME, CONTACT_INFO, SOCIAL_MEDIA } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';

interface NavbarProps {
  transparent?: boolean;
  forceTransparent?: boolean;
  reserveSpace?: boolean;
  /** Estética Río / Viaggio Tur: fondo claro, texto negro */
  theme?: "default" | "rio";
}

export default function Navbar({ transparent = false, forceTransparent = false, reserveSpace = false, theme = "default" }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario].filter(Boolean).join(' / ');
  const whatsAppHref = getWhatsAppLink();
  const navRef = useRef<HTMLElement | null>(null);
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original;
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileMenuOpen]);

  const isRio = theme === "rio";
  const isCompact = isRio && (isScrolled || mobileMenuOpen);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!reserveSpace) return;
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      const height = navRef.current?.getBoundingClientRect().height ?? 0;
      setNavHeight(height);
    };

    updateHeight();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    if (ro && navRef.current) ro.observe(navRef.current);

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      ro?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!reserveSpace) return;
    const height = navRef.current?.getBoundingClientRect().height ?? 0;
    setNavHeight(height);
  }, [isScrolled, mobileMenuOpen, reserveSpace]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/paquetes?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const navContent = (
    <nav
      ref={navRef as unknown as React.RefObject<HTMLElement>}
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isScrolled ? 'pt-2 md:pt-4' : 'pt-0'}`}
      onClick={() => {
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }}
    >
      {/* Topbar (Se oculta al scrollear para diseño más limpio) */}
      <div className={`transition-all duration-500 overflow-hidden bg-primary ${isScrolled ? 'h-0 opacity-0' : 'h-10 opacity-100'}`}>
        <div className="container mx-auto px-4 md:px-6 lg:px-8 text-white/90 items-center justify-between py-0 text-[11px] font-medium h-10 flex">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <Link href={SOCIAL_MEDIA.facebook} target="_blank" className="text-white hover:text-white transition">
                <FaFacebook className="w-3.5 h-3.5 opacity-80" />
              </Link>
              <span className="text-white/30">|</span>
              <Link href={SOCIAL_MEDIA.instagram} target="_blank" className="text-white hover:text-white transition">
                <FaInstagram className="w-3.5 h-3.5 opacity-80" />
              </Link>
              <span className="text-white/30">|</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-3.5 h-3.5 opacity-80" />
              <span className="tracking-wide">{telefonos}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-3.5 h-3.5 opacity-80" />
              <span className="tracking-wide">{CONTACT_INFO.whatsappDisplay}</span>
            </div>
            <div className="flex items-center space-x-2 hover:text-white transition cursor-pointer">
              <Mail className="w-3.5 h-3.5 opacity-80" />
              <a href={SOCIAL_MEDIA.email} target="_blank" className="text-white text-xs hover:text-white transition">
                               {CONTACT_INFO.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className={`mx-auto transition-all duration-500 w-full ${
        isScrolled 
          ? 'px-4 md:px-6 mt-2' 
          : 'bg-white'
      }`}>
        <div className={`mx-auto transition-all duration-500 ${
          isScrolled 
            ? 'xl:max-w-7xl bg-white/90 backdrop-blur-xl shadow-lg rounded-2xl px-4 md:px-6' 
            : 'container px-4 md:px-6 lg:px-8 border-none shadow-none'
        }`}>
          <div className="flex items-center justify-between h-16 md:h-24">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <div className="h-12 md:h-16 flex items-center shrink-0">
              {isRemoteUrl(logoSrc) ? (
                <img
                  src={logoSrc}
                  alt={logoAlt}
                  className="h-full w-auto object-contain"
                />
              ) : (
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  width={192}
                  height={64}
                  className="h-full w-auto object-contain"
                />
              )}
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center justify-center flex-1 mx-4 text-[11px] xl:text-[12px] font-semibold text-gray-500 tracking-[0.08em]">
            <div className="flex items-center space-x-5">
              <Link href="/" className="hover:text-primary transition-colors uppercase">Inicio</Link>
              <Link href="/#categorias" className="hover:text-primary transition-colors uppercase">Destinos</Link>
              <Link href="/paquetes" className="hover:text-primary transition-colors uppercase">Excursiones</Link>
              <Link href="/contacto" className="hover:text-primary transition-colors uppercase">Contacto</Link>
            </div>
          </div>

          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 xl:px-5 py-2.5 text-xs xl:text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,211,102,0.28)] transition-all hover:bg-[#1EBE57] hover:-translate-y-0.5"
          >
            <Phone className="h-4 w-4" />
            Consultá ahora
          </a>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 ml-auto"
            onClick={(event) => {
              event.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
          >
            {mobileMenuOpen ? (
              <X className="text-gray-900 w-6 h-6" />
            ) : (
              <Menu className="text-gray-900 w-6 h-6" />
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[110] lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 z-10 w-[86vw] max-w-sm shadow-2xl bg-white overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative h-full flex flex-col p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-bold">Menú</div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 bg-gray-100 rounded-full">
                    <X className="w-5 h-5 text-gray-900" />
                  </button>
                </div>
                <nav className="space-y-1 text-left flex-1">
                  <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                    Inicio
                  </Link>
                  <Link href="/#categorias" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                    Destinos
                  </Link>
                  <Link href="/paquetes" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                    Excursiones
                  </Link>
                  <Link href="/contacto" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                    Contacto
                  </Link>
                </nav>
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,211,102,0.24)] transition hover:bg-[#1EBE57]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Phone className="h-4 w-4" />
                  Consultá ahora
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );

  return (
    <>
      {reserveSpace && (
        <div aria-hidden className="w-full transition-[height] duration-500" style={{ height: navHeight }} />
      )}
      {mounted && typeof document !== "undefined"
        ? createPortal(navContent, document.body)
        : navContent}
    </>
  );
}
