'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface HeroProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string; // Fallback para compatibilidad
  backgroundImageMobile?: string;
  backgroundImageDesktop?: string;
  ctaText?: string;
  ctaLink?: string;
  bannerImages?: string[];
  activeBannerIndex?: number;
  onBannerIndexChange?: (nextIndex: number) => void;
  height?: 'sm' | 'md' | 'lg' | 'xl';
  /** Estética Río: fondo cream */
  theme?: 'default' | 'rio';
  contentVariant?: 'default' | 'compact';
  children?: React.ReactNode;
}

export default function Hero({
  title,
  subtitle,
  backgroundImage,
  backgroundImageMobile,
  backgroundImageDesktop,
  ctaText,
  ctaLink,
  bannerImages,
  activeBannerIndex,
  onBannerIndexChange,
  height = 'lg',
  theme = 'default',
  contentVariant = 'default',
  children,
}: HeroProps) {
  const isRio = theme === 'rio';
  const isCompact = contentVariant === 'compact';
  const heightClasses = {
    sm: 'h-[45vw] md:h-[320px] lg:h-[500px] 2xl:h-[500px]',
    md: 'h-[50vw] md:h-[360px] lg:h-[500px] 2xl:h-[500px]',
    lg: 'h-[55vw] md:h-[420px] lg:h-[500px] 2xl:h-[500px]',
    xl: 'h-[60vw] md:h-[460px] lg:h-[500px] 2xl:h-[500px]',
  };
  const compactHeightClasses = {
    sm: 'min-h-[220px] h-[58vw] max-h-[300px] sm:min-h-[250px] sm:h-[52vw] sm:max-h-[340px] md:h-[320px] md:max-h-none lg:h-[360px] 2xl:h-[380px]',
    md: 'min-h-[240px] h-[62vw] max-h-[340px] sm:min-h-[270px] sm:h-[56vw] sm:max-h-[380px] md:h-[360px] md:max-h-none lg:h-[420px] 2xl:h-[440px]',
    lg: 'min-h-[260px] h-[66vw] max-h-[380px] sm:min-h-[300px] sm:h-[60vw] sm:max-h-[420px] md:h-[420px] md:max-h-none lg:h-[500px] 2xl:h-[520px]',
    xl: 'min-h-[280px] h-[72vw] max-h-[420px] sm:min-h-[320px] sm:h-[64vw] sm:max-h-[460px] md:h-[460px] md:max-h-none lg:h-[540px] 2xl:h-[560px]',
  };
  const resolvedHeightClass = isCompact ? compactHeightClasses[height] : heightClasses[height];

  // Determinar qué imágenes usar
  const fallbackMobileImage = backgroundImageMobile || backgroundImage || '/images/hero-default.jpg';
  const fallbackDesktopImage = backgroundImageDesktop || backgroundImage || '/images/hero-default.jpg';
  const banners = (bannerImages && bannerImages.length > 0 ? bannerImages : [fallbackDesktopImage]).filter(
    Boolean
  );
  const resolvedIndex =
    typeof activeBannerIndex === 'number' && banners.length > 0
      ? ((activeBannerIndex % banners.length) + banners.length) % banners.length
      : 0;
  const desktopImage = banners[resolvedIndex] || fallbackDesktopImage;
  const mobileImage = banners[resolvedIndex] || fallbackMobileImage;
  const showIndicators = banners.length > 1;

  const handleBannerChange = (nextIndex: number) => {
    if (!onBannerIndexChange || banners.length <= 1) return;
    const normalized = ((nextIndex % banners.length) + banners.length) % banners.length;
    onBannerIndexChange(normalized);
  };

  const trimmedTitle = title?.trim();
  const trimmedSubtitle = subtitle?.trim();
  const hasContent = Boolean(trimmedTitle || trimmedSubtitle || (ctaText && ctaLink) || children);
  const lineRevealVariants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div
      className={`relative z-0 flex w-full items-center justify-center overflow-hidden ${resolvedHeightClass} ${isRio ? '' : 'bg-[#f4f4f4]'}`}
      data-theme={isRio ? 'rio' : undefined}
    >
      {/* Background Image Mobile: tema Río sin banda (imagen desde top-0) */}
      <div className={`absolute inset-x-0 bottom-0 md:hidden top-0`}>
        <div className="relative h-full w-full">
          <Image
            src={mobileImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            className="object-cover object-center"
            quality={92}
            sizes="(max-width: 768px) 100vw, 100vw"
          />
        </div>
        {isCompact && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,16,28,0.58)_0%,rgba(4,16,28,0.22)_20%,rgba(4,16,28,0.72)_100%)]" />}
        {!isRio && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-3 gradient" />}
      </div>
      {/* Background Image Desktop: tema Río sin banda (imagen desde top-0) */}
      <div className={`hidden md:block absolute inset-x-0 bottom-0 top-0`}>
        <div className="relative h-full w-full">
          <Image
            src={desktopImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            className="object-cover object-center"
            quality={85}
            sizes="100vw"
          />
        </div>
        {isCompact && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,16,28,0.54)_0%,rgba(4,16,28,0.12)_18%,rgba(4,16,28,0.74)_100%)]" />}
        {!isRio && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-3 gradient" />}
      </div>

      {showIndicators && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <span className="text-white/80">
            {resolvedIndex + 1}/{banners.length}
          </span>
          <div className="flex items-center gap-1.5">
            {banners.map((_, index) => (
              <button
                key={`hero-dot-${index}`}
                type="button"
                aria-label={`Ir al banner ${index + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  index === resolvedIndex ? 'bg-secondary' : 'bg-white/40 hover:bg-white/70'
                }`}
                onClick={() => handleBannerChange(index)}
              />
            ))}
          </div>
        </div>
      )}

      {hasContent && (
        <div
          className={`relative z-10 container mx-auto px-4 text-white ${
            isCompact
              ? 'flex h-full items-end justify-center px-3 pb-4 text-center sm:px-4 sm:pb-5 md:px-6 md:pb-8'
              : 'text-center'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className={
              isCompact
                ? 'mx-auto w-full max-w-[96vw] rounded-[18px] border border-white/12 bg-[linear-gradient(180deg,rgba(7,28,48,0.74),rgba(7,28,48,0.56))] px-3.5 py-3.5 shadow-[0_18px_36px_rgba(0,0,0,0.26)] backdrop-blur-[10px] sm:max-w-[88vw] sm:rounded-[20px] sm:px-4.5 sm:py-4 md:max-w-[560px] md:px-6 md:py-5 lg:max-w-[680px] lg:px-7 lg:py-6'
                : 'space-y-6'
            }
          >
            {trimmedTitle && (
              <h1
                className={`overflow-hidden font-bold leading-tight ${
                  isCompact
                    ? 'text-[15px] tracking-[-0.03em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)] sm:text-[18px] md:text-[22px] lg:text-[26px]'
                    : 'text-lg md:text-lg lg:text-lg'
                }`}
              >
                <motion.span
                  className="block"
                  variants={lineRevealVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {trimmedTitle}
                </motion.span>
              </h1>
            )}
            {trimmedSubtitle && (
              <p
                className={`mx-auto overflow-hidden ${
                  isCompact
                    ? 'mt-1.5 max-w-[95%] text-[10px] leading-[1.45] text-white/88 line-clamp-5 sm:mt-2 sm:max-w-[90%] sm:text-[11px] sm:line-clamp-5 md:mt-2.5 md:max-w-[500px] md:text-[12px] md:line-clamp-4 lg:max-w-[580px] lg:text-[13px] lg:line-clamp-4'
                    : 'max-w-3xl text-base text-gray-200 md:text-lg'
                }`}
              >
                <motion.span
                  className="block"
                  variants={lineRevealVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {trimmedSubtitle}
                </motion.span>
              </p>
            )}
            {ctaText && ctaLink && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="border border-[#F4D1D4] bg-white text-[#112B49] shadow-[0_12px_28px_rgba(17,43,73,0.12)] hover:bg-[#FFF1F1] hover:text-[#E30613] font-extrabold text-base px-8 py-6"
                >
                  <a href={ctaLink}>
                    {ctaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </motion.div>
            )}
            {children && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                {children}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Scroll Indicator */}
      {!showIndicators && !isCompact && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transform"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/90 p-2"
          >
            <div className="h-3 w-1 rounded-full bg-white" />
          </motion.div>
        </motion.div>
      )}

      {showIndicators && (
        <motion.div
          className="absolute inset-0 z-0 md:hidden"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (!onBannerIndexChange) return;
            const swipe = info.offset.x;
            if (swipe < -60) handleBannerChange(resolvedIndex + 1);
            if (swipe > 60) handleBannerChange(resolvedIndex - 1);
          }}
        />
      )}
    </div>
  );
}
