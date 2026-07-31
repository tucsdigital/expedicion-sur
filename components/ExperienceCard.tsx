'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, ArrowRight, Share2 } from 'lucide-react';
import type { Experience } from '@/components/landing-reserva/types';
import { getPackageFeatures } from '@/lib/utils/packageFeatures';
import { toast } from 'sonner';

interface ExperienceCardProps {
  experience: Experience;
  index?: number;
}

export default function ExperienceCard({ experience: exp, index = 0 }: ExperienceCardProps) {
  const direction = index % 2 === 0 ? -1 : 1;
  const vertical = index % 3 === 0 ? -1 : 1;
  const duration = 0.6 + (index % 3) * 0.05;

  const features = getPackageFeatures(exp.includes || [], 3);
  const hasPrice = typeof exp.price === 'number' && exp.price > 0;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/experiencias/${exp.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: exp.title,
          text: exp.subtitle || `Experiencia: ${exp.title}`,
          url,
        });
      } catch {
        // Usuario canceló
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado al portapapeles');
      } catch {
        toast.error('No se pudo copiar el enlace');
      }
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 50 * direction,
        y: 32 * vertical,
        scale: 0.97,
        rotate: 0.6 * direction,
        filter: 'blur(6px)',
      }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -50 * direction, y: -24 * vertical, scale: 0.98, rotate: -0.4 * direction }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      viewport={{ once: true, margin: '-120px' }}
    >
      <Link href={`/experiencias/${exp.slug}`} className="block">
        <Card className="group relative mx-auto flex w-full max-w-sm cursor-pointer flex-col gap-0 overflow-hidden rounded-2xl border-0 py-0 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl aspect-4/5 min-h-[300px] md:aspect-4/5 md:min-h-[340px]">
          <div className="absolute inset-0">
            <Image
              src={exp.cardImage ?? exp.images?.[0] ?? '/images/hero-placeholder.svg'}
              alt={exp.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading={index < 6 ? 'eager' : 'lazy'}
              priority={index < 6}
              fetchPriority={index < 3 ? 'high' : 'auto'}
              quality={85}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/40 to-black/90" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-black/90" />
          </div>

          <div className="relative z-2 flex items-start justify-between p-2.5 md:p-3">
            <Badge className="bg-secondary px-2 py-0.5 text-[9px] text-black backdrop-blur-sm hover:bg-secondary md:text-sm">
              Experiencia
            </Badge>
            <button
              onClick={handleShare}
              className="cursor-pointer rounded-full bg-secondary p-1.5 text-black shadow-lg transition-all hover:scale-110 hover:bg-secondary md:p-3"
              title="Compartir experiencia"
            >
              <Share2 className="h-3.5 w-3.5 md:h-5 md:w-5" />
            </button>
          </div>

          <CardContent className="relative z-2 mt-auto p-3 md:p-4">
            <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/60 to-black/90" />
            <div className="relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              <div className="mb-1 flex items-center text-[9px] text-gray-400 md:text-sm">
                <MapPin className="mr-1 h-3 w-3 text-white md:mr-1.5 md:h-3.5 md:w-3.5" />
                <span className="text-white font-medium">
                  {exp.title.includes(' en ') ? exp.title.split(' en ').slice(1).join(' ') : exp.title.split(' ').slice(-2).join(' ') || 'Experiencia'}
                </span>
              </div>
              <h3 className="mb-1.5 text-[11px] font-heading font-bold text-white transition-colors group-hover:text-white/90 md:mb-2 md:text-sm lg:text-sm">
                {exp.title}
              </h3>
              <p className="mb-2 line-clamp-3 text-[9px] font-body text-white/80 md:mb-3 md:text-sm">
                {exp.subtitle || exp.supportText || ''}
              </p>

              {features.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="group/feature relative flex h-5 w-5 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm md:h-7 md:w-7"
                      aria-label={feature.label}
                    >
                      <span className="text-xs text-white md:text-lg">{feature.icon}</span>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/90 px-3 py-1 text-xs font-semibold text-white shadow-lg opacity-0 transition-opacity duration-200 group-hover/feature:opacity-100"
                      >
                        {feature.label}
                      </span>
                      <span className="sr-only">{feature.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center text-[9px] text-gray-400 md:text-sm">
                <Clock className="mr-1 h-3 w-3 text-white md:mr-1.5 md:h-3.5 md:w-3.5" />
                <span className="text-white font-medium">Reservá tu fecha</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="relative z-2 flex items-center justify-between p-3 pt-1.5 md:p-4 md:pt-2">
            <div>
              {hasPrice ? (
                <>
                  <p className="text-[9px] font-body text-gray-400 md:text-xs">Desde</p>
                  <p className="text-[11px] font-heading font-bold text-white md:text-sm">
                    ARS ${Number(exp.price).toLocaleString('es-AR')}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-body text-gray-400 md:text-xs">Consultar</p>
                  <p className="text-[11px] font-heading font-bold text-white md:text-sm">Consultá con Expedición Sur</p>
                </>
              )}
            </div>
            <Button
              className="group h-8 w-8 bg-secondary p-0 text-black hover:bg-secondary md:h-9 md:w-auto md:px-4"
              aria-label="Ver más"
            >
              <span className="hidden md:inline">Ver más</span>
              <ArrowRight className="h-3 w-3 md:ml-2 md:h-4 md:w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
