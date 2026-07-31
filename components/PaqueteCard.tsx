'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, ArrowRight, Share2 } from 'lucide-react';
import { Paquete } from '@/types';
import { getPaqueteTipoLabel, getTarifaEspecialData } from '@/lib/paqueteMeta';
import { getPackageFeatures } from '@/lib/utils/packageFeatures';
import { toast } from 'sonner';

interface PaqueteCardProps {
  paquete: Paquete;
  index?: number;
  /** Ruta base del link: `/paquete` (paquetes) o `/f1` (F1) */
  basePath?: string;
  /** Etiqueta del badge (ej. "F1"). Si no se pasa, se usa Individual/Grupal/A Medida según tipo */
  badgeLabel?: string;
}

export default function PaqueteCard({
  paquete,
  index = 0,
  basePath = '/paquete',
  badgeLabel,
}: PaqueteCardProps) {
  const getDescripcion = () => {
    if (paquete.descripcionCorta) return paquete.descripcionCorta;
    const textoLimpio = paquete.descripcion.replace(/<[^]*>/g, '');
    return textoLimpio.slice(0, 120) + (textoLimpio.length > 120 ? '...' : '');
  };

  const getPrimeraSalida = () => {
    if (!paquete.salidas || paquete.salidas.length === 0) return null;
    const salidasFuturas = paquete.salidas.filter((s) => {
      const fechaSalida = new Date(s.fecha + 'T00:00:00');
      return fechaSalida >= new Date();
    });
    if (salidasFuturas.length === 0) return paquete.salidas[0];
    return salidasFuturas.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    )[0];
  };

  const primeraSalida = getPrimeraSalida();
  const features = getPackageFeatures(paquete.incluye || [], 3);
  const tarifaEspecial = getTarifaEspecialData(paquete);

  /** Destino: en F1 usar eventoLugar si existe; sino destino con fallback "F1" */
  const textoDestino =
    basePath === '/f1' && paquete.eventoLugar
      ? paquete.eventoLugar
      : paquete.destino || 'F1';

  /** Badge: badgeLabel o Individual/Grupal/A Medida según tipo */
  const badgeTexto = badgeLabel
    ? badgeLabel
    : getPaqueteTipoLabel(paquete.tipo);

  /** Imagen: imagenTarjeta o imagenPrincipal (doc) */
  const imagenSrc =
    paquete.imagenTarjeta || paquete.imagenPrincipal || '/images/placeholder-package.jpg';

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${basePath}/${paquete.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: paquete.titulo,
          text: `Mirá este paquete: ${paquete.titulo}`,
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
      <Link href={`${basePath}/${paquete.slug}`} className="block">
        <Card className="group relative flex h-full min-h-[340px] w-full max-w-sm flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-[#101828] py-0 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl mx-auto aspect-4/5">
          {/* Imagen de fondo a pantalla completa */}
          <div className="absolute inset-0">
            <Image
              src={imagenSrc}
              alt={paquete.titulo}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading={index < 6 ? 'eager' : 'lazy'}
              priority={index < 6}
              fetchPriority={index < 3 ? 'high' : 'auto'}
              quality={85}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            {/* Overlay oscuro y neutro para evitar tinte de marca sobre la imagen */}
            <div
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.72)_46%,rgba(2,6,23,0.2)_100%)]"
              aria-hidden
            />
          </div>

          {/* Contenido sobre la imagen (z-10) */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            {/* Zona superior: Badge + Compartir */}
            <div className="flex items-start justify-between p-3">
              <Badge className="bg-[rgba(2,6,23,0.72)] text-white text-[10px] font-medium backdrop-blur-sm md:text-sm px-2 py-0.5 border border-white/10 hover:bg-[rgba(2,6,23,0.72)]">
                {badgeTexto}
              </Badge>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full bg-white/95 p-2 text-[#0f172a] transition-transform hover:scale-110 hover:bg-white md:p-3 shadow-lg"
                title="Compartir paquete"
                aria-label="Compartir paquete"
              >
                <Share2 className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>

            {/* Contenido: destino, título, descripción, features, duración */}
            <CardContent className="mt-auto p-4 pt-0">
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="h-3 w-3 shrink-0 text-white md:h-3.5 md:w-3.5" />
                <span className="text-[10px] font-medium text-white md:text-sm">
                  {textoDestino}
                </span>
              </div>
              <h3 className="font-heading text-xs font-bold text-white transition-colors group-hover:text-white/90 md:text-sm lg:text-sm mt-1">
                {paquete.titulo}
              </h3>
              <p className="text-[10px] text-white/80 line-clamp-3 mt-1 md:text-sm">
                {getDescripcion()}
              </p>

              {/* Features: iconos con tooltip */}
              {features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="group/feature relative flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(2,6,23,0.38)] border border-white/10 backdrop-blur-sm md:h-7 md:w-7"
                      title={feature.label}
                      aria-label={feature.label}
                    >
                      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 text-white md:[&_svg]:h-4 md:[&_svg]:w-4">
                        {feature.icon}
                      </span>
                      {/* Tooltip al hover */}
                      <span
                        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-[rgba(2,6,23,0.92)] px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/feature:opacity-100"
                        role="tooltip"
                      >
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 text-gray-400">
                <Clock className="h-3 w-3 shrink-0 text-white md:h-3.5 md:w-3.5" />
                <span className="text-[10px] font-medium text-white md:text-sm">
                  {paquete.duracion}
                </span>
              </div>
            </CardContent>

            {/* Pie: precio / próxima salida + Ver más */}
            <CardFooter className="flex items-center justify-between p-4 pt-2">
              <div>
                {primeraSalida ? (
                  <>
                    <p className="text-[10px] text-gray-400 md:text-xs">
                      Próxima salida:{' '}
                      {new Date(primeraSalida.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className="font-heading text-xs font-bold text-white md:text-sm">
                      {primeraSalida.moneda} ${primeraSalida.precio.toLocaleString('es-AR')}
                    </p>
                  </>
                ) : (
                  <>
                    {paquete.mostrarDesde && (
                      <p className="text-[10px] text-gray-400 md:text-xs">Desde</p>
                    )}
                    {tarifaEspecial.activa && tarifaEspecial.precioEspecial ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 line-through md:text-xs">
                          {paquete.moneda || 'ARS'} ${paquete.precio.toLocaleString('es-AR')}
                        </p>
                        <p className="font-heading text-xs font-bold text-amber-300 md:text-sm">
                          {paquete.moneda || 'ARS'} ${tarifaEspecial.precioEspecial.toLocaleString('es-AR')}
                        </p>
                        {tarifaEspecial.fechaLimiteLabel && (
                          <p className="text-[10px] text-amber-200 md:text-xs">
                            Hasta el {tarifaEspecial.fechaLimiteLabel}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="font-heading text-xs font-bold text-white md:text-sm">
                        {paquete.moneda || 'ARS'} ${paquete.precio.toLocaleString('es-AR')}
                      </p>
                    )}
                  </>
                )}
              </div>
              <Button
                size="sm"
                className="bg-white text-[#0f172a] hover:bg-gray-100 font-semibold transition-transform hover:translate-x-1 shrink-0"
              >
                <span className="hidden md:inline">Ver más</span>
                <ArrowRight className="h-3 w-3 md:ml-1 md:h-4 md:w-4" />
              </Button>
            </CardFooter>
          </div>

          {paquete.destacado && (
            <Badge className="absolute top-3 right-14 z-20 bg-[rgba(2,6,23,0.82)] font-semibold text-white hover:bg-[rgba(2,6,23,0.82)] border border-white/10">
              Destacado
            </Badge>
          )}
        </Card>
      </Link>
    </motion.div>
  );
}
