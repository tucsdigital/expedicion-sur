'use client';

import { motion, Variants } from 'framer-motion';
import type { Experience } from '@/components/landing-reserva/types';
import ExperienceCard from '@/components/ExperienceCard';
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
    <section id="experiencias" className="overflow-x-hidden bg-transparent py-6 md:py-12">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl pb-3 md:pb-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-150px' }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.18, delayChildren: 0.22 }}
        >
          <motion.div className="mb-2 inline-block md:mb-4" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">Experiencias</span>
          </motion.div>
          <motion.h2
            className="overflow-hidden text-[15px] font-bold leading-tight md:text-lg lg:text-lg"
            variants={fadeInRightVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Viví cada destino con Expedición Sur
            </motion.span>
          </motion.h2>
          <motion.p
            className="overflow-hidden text-[12px] leading-relaxed text-[#4B5563] md:text-sm"
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
          className="grid grid-cols-2 gap-3.5 md:grid-cols-2 md:gap-8 lg:grid-cols-4"
        >
          {showSkeletons
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonPaqueteCard key={`skeleton-exp-${i}`} />
              ))
            : experiencias.map((exp, index) => (
                <ExperienceCard key={exp.id} experience={exp} index={index} />
              ))}
        </motion.div>
      </div>
    </section>
  );
}
