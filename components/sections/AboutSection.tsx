'use client';

import { motion, Variants } from 'framer-motion';
import Image from 'next/image';
import { renderTemplate, siteConfig } from '@/lib/siteConfig';

const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%231e3a5f' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2394a3b8'%3EFoto%3C/text%3E%3C/svg%3E";

interface AboutSectionProps {
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  staggerFastVariants: Variants;
  staggerContainerVariants: Variants;
}

export default function AboutSection({
  fadeInLeftVariants,
  fadeInRightVariants,
  staggerFastVariants,
  staggerContainerVariants,
}: AboutSectionProps) {
  const about = siteConfig.content.about;
  const imageAlt = renderTemplate(about.image.altTemplate);
  const renderParagraph = (value: string) => {
    const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="font-semibold text-gray-700">
            {renderTemplate(inner)}
          </strong>
        );
      }
      return <span key={idx}>{renderTemplate(part)}</span>;
    });
  };

  return (
    <section
      id="nosotros"
      className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(241,234,225,0.2)_100%)] py-10 md:py-24"
    >
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-20">
          {/* Lado Izquierdo: Textos */}
          <motion.div
            className="order-2 space-y-4 text-left lg:order-1 lg:space-y-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainerVariants}
          >
            <motion.div className="mb-1 inline-block md:mb-2" variants={fadeInLeftVariants}>
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary shadow-[0_2px_10px_rgba(76,175,80,0.1)] md:px-4 md:py-1.5 md:text-sm md:tracking-widest">
                {about.badge}
              </span>
            </motion.div>
            <motion.h2
              className="mb-3 text-[24px] font-extrabold leading-[1.02] tracking-[-0.05em] text-gray-900 md:mb-6 md:text-5xl md:leading-[1.1]"
              variants={fadeInLeftVariants}
            >
              {about.titlePrefix}{' '}
              <span className="text-primary relative whitespace-nowrap">
                {about.titleAccent}
                <svg className="absolute -bottom-1.5 left-0 h-2.5 w-full text-secondary/30 md:-bottom-2 md:h-3" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
                </svg>
              </span>
            </motion.h2>

            <div className="mt-4 space-y-3.5 md:mt-8 md:space-y-5">
              {about.paragraphs.map((paragraph, idx) => (
                <motion.p
                  key={idx}
                  className={idx === 0 ? "text-[13px] font-light leading-6 text-gray-600 md:text-xl md:leading-relaxed" : "text-[12px] font-light leading-5.5 text-gray-500 md:text-base md:leading-relaxed"}
                  variants={fadeInLeftVariants}
                >
                  {renderParagraph(paragraph)}
                </motion.p>
              ))}
            </div>
          </motion.div>

          {/* Lado Derecho: Imagen moderna */}
          <motion.div
            className="relative order-1 lg:order-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeInRightVariants}
          >
            {/* Decoración detrás de la imagen */}
            <div className="absolute -inset-2 -z-10 rotate-2 rounded-[1.8rem] bg-gradient-to-tr from-primary/10 to-secondary/5 blur-sm md:-inset-4 md:rotate-3 md:rounded-[2.5rem]" />
            
            <div className="group relative aspect-[4/3] overflow-hidden rounded-[22px] shadow-[0_16px_36px_rgb(0,0,0,0.08)] md:rounded-3xl md:shadow-[0_20px_50px_rgb(0,0,0,0.1)]">
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors duration-700 z-10" />
              <Image
                src={about.image.src}
                alt={imageAlt}
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
