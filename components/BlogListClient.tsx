"use client";

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import WhatsAppButton from '@/components/WhatsAppButton';
import { BannerImage, BlogPost } from '@/types';
import BlogCard from '@/components/BlogCard';

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
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

interface BlogListClientProps {
  posts: BlogPost[];
  banners: BannerImage[];
}

export default function BlogListClient({ posts, banners }: BlogListClientProps) {
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [banners]);

  return (
    <div className="overflow-x-hidden">
      <Navbar reserveSpace />
      <WhatsAppButton />

      <Hero
        backgroundImage={banners[bannerIndex]?.desktop || '/images/hero-placeholder.svg'}
        backgroundImageMobile={banners[bannerIndex]?.mobile || banners[bannerIndex]?.desktop || '/images/hero-placeholder.svg'}
        backgroundImageDesktop={banners[bannerIndex]?.desktop || '/images/hero-placeholder.svg'}
        bannerImages={banners}
        activeBannerIndex={bannerIndex}
        onBannerIndexChange={setBannerIndex}
        height="xl"
      />

      <section className="py-8 md:py-12 bg-white border-t border-gray-200 overflow-x-hidden">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mb-10 md:mb-14 max-w-3xl">
            <div className="inline-block mb-4">
              <span className="badge-pluma pluma-underline">Actualidad</span>
            </div>
            <h2 className="text-lg md:text-lg lg:text-lg font-bold leading-tight">
              Inspiración y noticias de viaje
            </h2>
            <p className="text-sm md:text-sm text-[#4B5563]">
              Historias, recomendaciones y novedades para planificar mejor tu próximo viaje.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {posts.map((post, index) => (
              <BlogCard key={post.id} post={post} index={index} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
