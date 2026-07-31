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
        <Card className="group overflow-hidden transition-all duration-300 w-full max-w-sm mx-auto flex flex-col py-0 gap-0 rounded-2xl border-0 shadow-lg cursor-pointer hover:shadow-2xl hover:-translate-y-1 relative aspect-4/5 md:aspect-4/5 min-h-[340px]">
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

          <div className="relative z-2 flex items-start justify-between p-3">
            <Badge className="bg-secondary text-success-strong backdrop-blur-sm hover:bg-secondary text-[10px] md:text-sm px-2 py-0.5">
              Experiencia
            </Badge>
            <button
              onClick={handleShare}
              className="cursor-pointer bg-secondary text-success-strong p-2 md:p-3 rounded-full transition-all hover:scale-110 shadow-lg hover:bg-secondary"
              title="Compartir experiencia"
            >
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>

          <CardContent className="relative z-2 mt-auto p-4">
            <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/60 to-black/90" />
            <div className="relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              <div className="flex items-center text-[10px] md:text-sm text-gray-400 mb-1">
                <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5 text-white" />
                <span className="text-white font-medium">
                  {exp.title.includes(' en ') ? exp.title.split(' en ').slice(1).join(' ') : exp.title.split(' ').slice(-2).join(' ') || 'Experiencia'}
                </span>
              </div>
              <h3 className="text-xs md:text-sm lg:text-sm font-heading font-bold mb-1.5 md:mb-2 text-white group-hover:text-white/90 transition-colors">
                {exp.title}
              </h3>
              <p className="text-[10px] md:text-sm text-white/80 font-body mb-2 md:mb-3 line-clamp-3">
                {exp.subtitle || exp.supportText || ''}
              </p>

              {features.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="group/feature relative flex items-center justify-center w-6 h-6 md:w-7 md:h-7 bg-white/15 text-white rounded-md backdrop-blur-sm"
                      aria-label={feature.label}
                    >
                      <span className="text-white text-sm md:text-lg">{feature.icon}</span>
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

              <div className="flex items-center text-[10px] md:text-sm text-gray-400">
                <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5 text-white" />
                <span className="text-white font-medium">Reservá tu fecha</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="relative z-2 p-4 pt-2 flex items-center justify-between">
            <div>
              {hasPrice ? (
                <>
                  <p className="text-[10px] md:text-xs text-gray-400 font-body">Desde</p>
                  <p className="text-xs md:text-sm font-heading font-bold text-white">
                    ARS ${Number(exp.price).toLocaleString('es-AR')}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] md:text-xs text-gray-400 font-body">Consultar</p>
                  <p className="text-xs md:text-sm font-heading font-bold text-white">Consultá con Viaggio Tur</p>
                </>
              )}
            </div>
            <Button
              className="group bg-secondary text-success-strong font-semibold hover:bg-secondary h-8 w-8 p-0 md:h-9 md:w-auto md:px-4"
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
