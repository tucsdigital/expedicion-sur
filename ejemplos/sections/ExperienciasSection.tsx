'use client';

import { motion, Variants } from 'framer-motion';
import type { Experience } from '@/components/landing-reserva/types';
import SkeletonPaqueteCard from '@/components/SkeletonPaqueteCard';

const SKELETON_COUNT = 8;

interface ExperienciasSectionProps {
  experiencias: Experience[];
  loading?: boolean;
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  fadeInUpVariants: Variants;
  fadeInDownVariants: Variants;
  fadeInScaleVariants: Variants;
  staggerFastVariants: Variants;
}

export default function ExperienciasSection({
  experiencias,
  loading = false,
  fadeInDownVariants,
  fadeInRightVariants,
  fadeInUpVariants,
  fadeInScaleVariants,
  staggerFastVariants,
}: ExperienciasSectionProps) {
  const showSkeletons = loading;
  const showContent = !loading && experiencias?.length;
  if (!showSkeletons && !showContent) return null;

  const lineRevealVariants: Variants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section id="experiencias" className="py-8 md:py-12 bg-transparent overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl pb-4 md:pb-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-150px' }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.18, delayChildren: 0.22 }}
        >
          <motion.div className="inline-block mb-4" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">Experiencias</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight overflow-hidden"
            variants={fadeInRightVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Viví cada destino con Viaggio Tur
            </motion.span>
          </motion.h2>
          <motion.p
            className="text-sm md:text-sm text-[#4B5563] leading-relaxed overflow-hidden"
            variants={fadeInUpVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Más que un viaje, una experiencia que se comparte.
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeInScaleVariants}
          transition={{ duration: 0.75 }}
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
        >
          {showSkeletons
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonPaqueteCard key={`skeleton-exp-${i}`} />
              ))
            : experiencias.map((exp, index) => (
                <motion.article
                  key={exp.id}
                  variants={fadeInScaleVariants}
                  transition={{ duration: 0.65, delay: index * 0.05 }}
                  className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                >
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Experiencia</div>
                  <h3 className="mt-3 text-lg font-extrabold text-gray-900">
                    {(exp as { title?: string; nombre?: string }).title ??
                      (exp as { title?: string; nombre?: string }).nombre ??
                      'Experiencia destacada'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    {(exp as { shortDescription?: string; descripcion?: string }).shortDescription ??
                      (exp as { shortDescription?: string; descripcion?: string }).descripcion ??
                      'Bloque de referencia para la sección de experiencias.'}
                  </p>
                </motion.article>
              ))}
        </motion.div>
      </div>
    </section>
  );
}
