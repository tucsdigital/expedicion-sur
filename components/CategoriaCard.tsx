'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Categoria } from '@/types';

interface CategoriaCardProps {
  categoria: Categoria;
  index?: number;
}

export default function CategoriaCard({ categoria, index = 0 }: CategoriaCardProps) {
  const imagenSrc = categoria.imagen || '/images/viajes.jpg';

  const isEven = index % 2 === 0;
  const duration = 0.6 + (index % 3) * 0.05;

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: isEven ? -20 : 20,
        y: 20,
        scale: 0.97,
        rotate: isEven ? -1 : 1,
        filter: 'blur(6px)',
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        filter: 'blur(0px)',
      }}
      viewport={{ once: true, margin: '-120px' }}
      transition={{
        duration,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link href={`/categoria/${categoria.slug}`} className="block">
        <Card className="group relative mx-auto flex h-full min-h-[152px] flex-col gap-0 overflow-hidden rounded-xl border-0 bg-[#101828] py-0 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg aspect-4/3 md:min-h-[170px]">
          {/* Imagen de fondo a pantalla completa */}
          <div className="absolute inset-0">
            <Image
              src={imagenSrc}
              alt={categoria.nombre}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading={index < 6 ? 'eager' : 'lazy'}
              priority={index < 6}
              fetchPriority={index < 3 ? 'high' : 'auto'}
              quality={85}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 280px"
            />
            {/* Overlay: transparente arriba, oscuro abajo */}
            <div
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.64)_48%,rgba(2,6,23,0.14)_100%)]"
              aria-hidden
            />
          </div>

          {/* Contenido sobre la imagen */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <CardContent className="mt-auto p-2.5 md:p-3">
              <h3 className="truncate font-heading text-[11px] font-bold text-white transition-colors group-hover:text-white/90 md:text-xs">
                {categoria.nombre}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-[9px] text-white/80 md:text-xs">
                {categoria.descripcion}
              </p>
            </CardContent>

            {/* Pie: botón Ver más */}
            <CardFooter className="flex items-center justify-end p-2.5 pt-0 md:p-3 md:pt-0">
              <Button
                size="sm"
                className="h-7 shrink-0 bg-white px-2 text-[10px] font-semibold text-[#0f172a] transition-transform hover:translate-x-1 hover:bg-gray-100 md:h-8 md:px-3 md:text-xs"
              >
                <span className="hidden sm:inline">Ver más</span>
                <ArrowRight className="h-3 w-3 sm:ml-1 shrink-0" />
              </Button>
            </CardFooter>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
