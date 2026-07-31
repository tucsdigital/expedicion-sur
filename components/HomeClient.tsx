"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { BannerImage, BlogPost, Paquete } from "@/types";
import Navbar from "@/components/Navbar";
import ProductsSection from "@/components/sections/ProductsSection";
import CategoriesSection from "@/components/sections/CategoriesSection";
import ExperienciasSection from "@/components/sections/ExperienciasSection";
import ServicesSection from "@/components/sections/ServicesSection";
import ValuesSection from "@/components/sections/ValuesSection";
import AboutSection from "@/components/sections/AboutSection";
import BlogSection from "@/components/sections/BlogSection";
import InstagramSection from "@/components/sections/InstagramSection";
import ContactSectionBlock from "@/components/sections/ContactSectionBlock";
import Newsletter from "@/components/Newsletter";
import LandingFooter from "@/components/landing-reserva/LandingFooter";
import ScrollSmoother from "@/components/ScrollSmoother";
import HeroSearch from "@/components/HeroSearch";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Experience } from "@/components/landing-reserva/types";
import { renderTemplate, siteConfig } from "@/lib/siteConfig";
import { Categoria } from "@/types";

// Variantes de animación profesionales con efectos en cascada
const fadeInUpVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1], // Easing más dramático
    },
  },
};

const fadeInDownVariants = {
  hidden: { opacity: 0, y: -60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const fadeInLeftVariants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const fadeInRightVariants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // Más espaciado para efecto cascada
      delayChildren: 0.3,
    },
  },
};

const staggerFastVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const fadeInScaleVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

interface HomeClientProps {
  paquetes: Paquete[];
  productosOrdenados: Array<
    | { tipo: "paquete"; paquete: Paquete }
    | { tipo: "subtitle"; titulo: string }
  >;
  categoriasDestacadas: Categoria[];
  banners: BannerImage[];
  blogPosts: BlogPost[]; // BLOG OCULTO: se pasa [] desde page; descomentar BlogSection para usar
  experiencias: Experience[];
}

export default function HomeClient({
  paquetes,
  productosOrdenados,
  categoriasDestacadas,
  banners,
  blogPosts,
  experiencias,
}: HomeClientProps) {
  const router = useRouter();
  const [bannerIndex, setBannerIndex] = useState(0);
  // Skeletons breves solo para transición visual; datos vienen del servidor
  const [productosLoading, setProductosLoading] = useState(true);
  const activeBanner = banners[bannerIndex];
  const heroDesktopImage = activeBanner?.desktop || "/images/hero-placeholder.svg";
  const heroMobileImage = activeBanner?.mobile || activeBanner?.desktop || "/images/hero-placeholder.svg";

  useEffect(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    const timer = setTimeout(() => setProductosLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="overflow-x-hidden bg-white min-h-screen">
      <ScrollSmoother />
      <Navbar transparent={true} theme="rio" reserveSpace />
      <WhatsAppButton />

      {/* Hero Home: banner debajo del navbar y buscador por delante */}
      <motion.section
        className="relative isolate overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 md:hidden">
            <Image
              src={heroMobileImage}
              alt=""
              fill
              priority
              fetchPriority="high"
              className="object-cover object-center"
              quality={92}
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 hidden md:block">
            <Image
              src={heroDesktopImage}
              alt=""
              fill
              priority
              fetchPriority="high"
              className="object-cover object-center"
              quality={88}
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/60" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/70 to-transparent" />
        </div>

        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10 min-h-[420px] sm:min-h-[500px] md:min-h-[580px] lg:min-h-[640px] flex items-center justify-center py-10 sm:py-12 md:py-16 lg:py-20">
          <motion.div variants={fadeInUpVariants} className="w-full max-w-5xl mx-auto relative z-20">
            <HeroSearch paquetes={paquetes} />
            
            {/* Sombra sutil debajo del buscador para darle efecto de flotación 3D */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[88%] h-14 bg-black/20 blur-2xl rounded-[100%] -z-10" />
          </motion.div>
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-xs text-white backdrop-blur-sm">
            <span className="text-white/80">
              {bannerIndex + 1}/{banners.length}
            </span>
            <div className="flex items-center gap-1.5">
              {banners.map((_, index) => (
                <button
                  key={`home-banner-dot-${index}`}
                  type="button"
                  aria-label={`Ir al banner ${index + 1}`}
                  className={`h-2 w-2 rounded-full transition ${
                    index === bannerIndex ? "bg-secondary" : "bg-white/45 hover:bg-white/75"
                  }`}
                  onClick={() => setBannerIndex(index)}
                />
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* Paquetes destacados */}
      <ProductsSection
        items={productosOrdenados}
        filterType="paquete"
        sectionBadge={siteConfig.content.packagesSection.badge}
        sectionTitle={siteConfig.content.packagesSection.title}
        sectionSubtitle={renderTemplate(siteConfig.content.packagesSection.subtitleTemplate)}
        loading={productosLoading}
        fadeInLeftVariants={fadeInLeftVariants}
        fadeInRightVariants={fadeInRightVariants}
        fadeInUpVariants={fadeInUpVariants}
        fadeInDownVariants={fadeInDownVariants}
        fadeInScaleVariants={fadeInScaleVariants}
        staggerFastVariants={staggerFastVariants}
      />

      {/* Destinos destacados */}
      <CategoriesSection
        categorias={categoriasDestacadas ?? []}
        fadeInUpVariants={fadeInUpVariants}
        staggerFastVariants={staggerFastVariants}
      />

      {/* Experiencias */}
      <ExperienciasSection
        experiencias={experiencias ?? []}
        loading={false}
        fadeInLeftVariants={fadeInLeftVariants}
        fadeInRightVariants={fadeInRightVariants}
        fadeInUpVariants={fadeInUpVariants}
        fadeInDownVariants={fadeInDownVariants}
        fadeInScaleVariants={fadeInScaleVariants}
        staggerFastVariants={staggerFastVariants}
      />

      {/* Nuestros Servicios */}
      <ServicesSection
        fadeInUpVariants={fadeInUpVariants}
        staggerFastVariants={staggerFastVariants}
        staggerContainerVariants={staggerContainerVariants}
        scaleInVariants={fadeInScaleVariants}
      />

      {/* Porque elegirnos */}
      <ValuesSection
        fadeInUpVariants={fadeInUpVariants}
        staggerFastVariants={staggerFastVariants}
        staggerContainerVariants={staggerContainerVariants}
        scaleInVariants={fadeInScaleVariants}
      />

      {/* Blog Section */}
      <BlogSection
        posts={blogPosts}
        fadeInLeftVariants={fadeInLeftVariants}
        fadeInRightVariants={fadeInRightVariants}
        fadeInUpVariants={fadeInUpVariants}
        fadeInDownVariants={fadeInDownVariants}
        fadeInScaleVariants={fadeInScaleVariants}
        staggerFastVariants={staggerFastVariants}
      />

      {/* Sobre Nosotros */}
      <AboutSection
        fadeInLeftVariants={fadeInLeftVariants}
        fadeInRightVariants={fadeInRightVariants}
        staggerFastVariants={staggerFastVariants}
        staggerContainerVariants={staggerContainerVariants}
      />

      {/* Contacto */}
      <ContactSectionBlock
        fadeInLeftVariants={fadeInLeftVariants}
        fadeInRightVariants={fadeInRightVariants}
        fadeInUpVariants={fadeInUpVariants}
        fadeInDownVariants={fadeInDownVariants}
        fadeInScaleVariants={fadeInScaleVariants}
        staggerFastVariants={staggerFastVariants}
      />

      {/* Newsletter */}
      <Newsletter />

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
