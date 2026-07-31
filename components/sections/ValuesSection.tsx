'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { Award, CheckCircle, Sparkles, Shield, Heart, Smile } from 'lucide-react';
import { siteConfig } from '@/lib/siteConfig';

interface ValuesSectionProps {
  fadeInUpVariants: Variants;
  staggerFastVariants: Variants;
  staggerContainerVariants: Variants;
  scaleInVariants: Variants;
}

const ICONS = { Award, CheckCircle, Sparkles, Shield, Heart, Smile } as const;

export default function ValuesSection({
  fadeInUpVariants,
  staggerFastVariants,
  staggerContainerVariants,
  scaleInVariants,
}: ValuesSectionProps) {
  const section = siteConfig.content.values;
  const values = section.items ?? [];
  const words = section.title.trim().split(/\s+/);
  const accentWord = words.length > 1 ? (words.pop() as string) : section.title;
  const prefix = words.length > 0 ? `${words.join(' ')} ` : '';
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((itemCount: number) => {
    if (!scrollRef.current) return;
    if (itemCount <= 0) return;
    const container = scrollRef.current;
    const itemWidth = container.scrollWidth / itemCount;
    const index = Math.round(container.scrollLeft / itemWidth);
    setActiveIndex(Math.max(0, Math.min(index, itemCount - 1)));
  }, []);

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(241,234,225,0.16)_100%)] py-16 md:py-24">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <motion.div
          className="mx-auto mb-10 max-w-3xl text-center md:mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="inline-block mb-6" variants={fadeInUpVariants}>
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary shadow-[0_2px_10px_rgba(76,175,80,0.1)] md:px-4 md:py-1.5 md:text-sm">
              {section.badge}
            </span>
          </motion.div>
          <motion.h2
            className="mb-4 text-[1.55rem] font-extrabold leading-[1.08] tracking-tight text-gray-900 md:mb-6 md:text-5xl"
            variants={fadeInUpVariants}
          >
            {prefix}
            <span className="text-primary relative whitespace-nowrap">
              {accentWord}
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-secondary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
              </svg>
            </span>
          </motion.h2>
          <motion.p
            className="mx-auto max-w-2xl text-sm font-light leading-relaxed text-gray-500 md:text-xl"
            variants={fadeInUpVariants}
          >
            {section.subtitle}
          </motion.p>
        </motion.div>

        <div className="md:hidden relative">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 px-4 -mx-4"
            onScroll={() => handleScroll(values.length)}
          >
            {values.map((item, index) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS] || Award;
              return (
                <div key={index} className="w-[82vw] shrink-0 snap-center">
                  <div className="relative h-full overflow-hidden rounded-3xl border border-gray-100 bg-[#F9FAFB] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500">
                    <div className="absolute right-4 top-3 text-4xl font-bold text-gray-200/50">
                      {item.number}
                    </div>
                    <div className="relative z-10">
                      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mb-2 text-base font-bold text-gray-900">
                        {item.title}
                      </h3>
                      <p className="text-[12px] font-light leading-6 text-gray-500">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {values.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'bg-primary w-8' : 'bg-gray-200 w-2'
                }`}
              />
            ))}
          </div>
        </div>

        <motion.div
          className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainerVariants}
        >
          {values.map((item, index) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS] || Award;
            return (
              <motion.div key={index} className="group relative" variants={scaleInVariants}>
                <div className="relative h-full bg-[#F9FAFB] border border-gray-100 rounded-3xl p-8 hover:bg-white hover:border-primary/20 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-500 overflow-hidden">
                  <div className="absolute top-4 right-6 text-6xl font-bold text-gray-200/50 group-hover:text-primary/10 transition-colors duration-500">
                    {item.number}
                  </div>
                  <div className="relative z-10">
                    <motion.div
                      className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary rounded-2xl mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-500"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon className="h-7 w-7" />
                    </motion.div>
                    <h3 className="text-xl font-bold mb-4 text-gray-900 group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 leading-relaxed font-light transition-colors duration-300 mb-2">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
