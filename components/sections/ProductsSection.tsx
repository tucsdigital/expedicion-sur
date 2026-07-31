'use client';

import { motion, Variants } from 'framer-motion';
import PaqueteCard from '@/components/PaqueteCard';
import SkeletonPaqueteCard from '@/components/SkeletonPaqueteCard';
import { Paquete } from '@/types';

const SKELETON_COUNT = 8;

interface ProductsSectionProps {
  items: Array<
    | { tipo: 'paquete'; paquete: Paquete }
    | { tipo: 'subtitle'; titulo: string }
  >;
  filterType?: 'paquete' | 'all';
  sectionBadge: string;
  sectionTitle: string;
  sectionSubtitle: string;
  loading?: boolean;
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  fadeInUpVariants: Variants;
  fadeInDownVariants: Variants;
  fadeInScaleVariants: Variants;
  staggerFastVariants: Variants;
}

export default function ProductsSection({
  items,
  filterType = 'all',
  sectionBadge,
  sectionTitle,
  sectionSubtitle,
  loading = false,
  fadeInLeftVariants,
  fadeInRightVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  fadeInScaleVariants,
  staggerFastVariants,
}: ProductsSectionProps) {
  const lineRevealVariants: Variants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const filteredItems =
    filterType === 'all'
      ? items.filter((item): item is { tipo: 'paquete'; paquete: Paquete } => item.tipo !== 'subtitle')
      : items.filter(
          (item): item is { tipo: 'paquete'; paquete: Paquete } => item.tipo === filterType
        );

  const showSkeletons = loading;
  const hasProductos = !loading && filteredItems.length > 0;
  if (!showSkeletons && !hasProductos) return null;

  return (
    <section id="paquetes" className="overflow-x-hidden bg-transparent py-5 md:py-10">
      <div id="productos" className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className={`max-w-3xl ${filterType === 'paquete' ? 'pb-2 md:pb-4' : ''}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.18, delayChildren: 0.22 }}
        >
          <motion.div className="mb-2 inline-block md:mb-3" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">{sectionTitle}</span>
          </motion.div>
          <motion.h2
            className="overflow-hidden text-[15px] font-bold leading-tight md:text-lg lg:text-lg"
            variants={fadeInRightVariants}
          >
          </motion.h2>
          <motion.p
            className="overflow-hidden text-[12px] leading-relaxed text-[#4B5563] md:text-sm"
            variants={fadeInUpVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              {sectionSubtitle}
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeInScaleVariants}
          transition={{ duration: 0.75 }}
          className="grid grid-cols-2 gap-3.5 md:grid-cols-2 md:gap-6 lg:grid-cols-4"
        >
          {showSkeletons
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonPaqueteCard key={`skeleton-paq-${i}`} />
              ))
            : filteredItems.map((item, index) => (
                <PaqueteCard
                  key={`${item.tipo}-${item.paquete.id}`}
                  paquete={item.paquete}
                  index={index}
                />
              ))}
        </motion.div>
      </div>
    </section>
  );
}
