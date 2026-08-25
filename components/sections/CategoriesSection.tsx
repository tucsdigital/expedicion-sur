'use client';

import { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CategoriaCard from '@/components/CategoriaCard';
import { Categoria } from '@/types';

interface CategoriesSectionProps {
  categorias: Categoria[];
  fadeInUpVariants: Variants;
  staggerFastVariants: Variants;
}

export default function CategoriesSection({
  categorias,
  fadeInUpVariants,
  staggerFastVariants,
}: CategoriesSectionProps) {
  const [showAllCategorias, setShowAllCategorias] = useState(false);

  return (
    <section
      id="destinos"
      className="overflow-x-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(247,243,237,0.12)_100%)] py-7 md:py-16"
    >
      <div id="categorias" className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-8 max-w-3xl md:mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="mb-2 inline-block md:mb-4" variants={fadeInUpVariants}>
            <span className="badge-pluma pluma-underline">Nuestros Destinos</span>
          </motion.div>
          <motion.p
            className="text-[12px] leading-relaxed text-[#4B5563] md:text-lg"
            variants={fadeInUpVariants}
          >
            Explorá nuestras categorías y encontrá el viaje perfecto para vos
          </motion.p>
        </motion.div>

        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {categorias.length > 0 ? (
            categorias.map((categoria, index) => (
              <CategoriaCard key={categoria.id} categoria={categoria} index={index} />
            ))
          ) : (
            <motion.div
              className="col-span-full text-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-base md:text-lg text-gray-400">
                No hay categorías destacadas disponibles
              </p>
            </motion.div>
          )}
        </div>

        <div className="space-y-4 md:hidden">
          <div className="grid grid-cols-1 gap-4">
            {categorias.length > 0 ? (
              categorias
                .slice(0, showAllCategorias ? categorias.length : 3)
                .map((categoria, index) => (
                  <CategoriaCard key={categoria.id} categoria={categoria} index={index} />
                ))
            ) : (
              <motion.div
              className="py-14 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-[12px] text-gray-400 md:text-lg">
                  No hay categorías destacadas disponibles
                </p>
              </motion.div>
            )}
          </div>

          {categorias.length > 3 && !showAllCategorias && (
            <motion.div
              className="flex justify-center pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <button
                onClick={() => setShowAllCategorias(true)}
                className="inline-flex items-center justify-center rounded-xl bg-secondary px-5 py-2.5 text-[12px] font-semibold text-black shadow-md transition-all duration-300 hover:bg-secondary/90 hover:shadow-lg"
              >
                Ver todos los destinos ({categorias.length})
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
