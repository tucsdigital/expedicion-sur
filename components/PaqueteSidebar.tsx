'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { getWhatsAppLinkForPackage } from '@/lib/utils/whatsapp';
import { Paquete } from '@/types';
import { Calendar, MapPin, Moon, Share2, ArrowUpRight, ArrowDownLeft, Mail, CheckCircle2, Flame } from 'lucide-react';
import { getTarifaEspecialData } from '@/lib/paqueteMeta';
import { FaFacebookF } from 'react-icons/fa';
import { SITE_URL } from '@/lib/constants';

// Icono oficial de WhatsApp
const WhatsAppIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

interface PaqueteSidebarProps {
  paquete: Paquete;
}

export default function PaqueteSidebar({ paquete }: PaqueteSidebarProps) {
  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return SITE_URL;
  }, []);

  const nextSalida = useMemo(() => {
    const salidas = Array.isArray(paquete.salidas) ? paquete.salidas : [];
    if (salidas.length === 0) return null;

    const now = new Date();
    const futuras = salidas.filter((s) => {
      if (!s?.fecha) return false;
      const d = new Date(`${s.fecha}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d >= now;
    });

    const list = futuras.length > 0 ? futuras : salidas;
    return [...list].sort((a, b) => {
      const da = new Date(`${a.fecha}T00:00:00`).getTime();
      const db = new Date(`${b.fecha}T00:00:00`).getTime();
      return da - db;
    })[0];
  }, [paquete.salidas]);

  const shareUrl = useMemo(() => `${origin}/paquete/${paquete.slug}`, [origin, paquete.slug]);
  const shareTitle = useMemo(() => paquete.titulo || 'Viaje', [paquete.titulo]);
  const shareText = useMemo(() => `${shareTitle} - ${shareUrl}`, [shareTitle, shareUrl]);

  const whatsappShareHref = useMemo(() => `https://wa.me/?text=${encodeURIComponent(shareText)}`, [shareText]);
  const facebookShareHref = useMemo(
    () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    [shareUrl]
  );
  const emailShareHref = useMemo(
    () =>
      `mailto:?subject=${encodeURIComponent(`Mirá este viaje: ${shareTitle}`)}&body=${encodeURIComponent(
        `Te comparto este viaje:\n\n${shareUrl}`
      )}`,
    [shareTitle, shareUrl]
  );

  const destino = paquete.destino || paquete.eventoLugar || '—';
  const duracion = paquete.duracion || '—';
  const tarifaEspecial = getTarifaEspecialData(paquete);
  const condiciones = Array.isArray(paquete.condiciones) ? paquete.condiciones : [];
  const salidaLabel = nextSalida?.fecha
    ? new Date(`${nextSalida.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    : null;
  const vueltaLabel = nextSalida?.fechaVuelta
    ? new Date(`${nextSalida.fechaVuelta}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    : null;

  return (
    <div className="sticky top-24 space-y-5 rounded-3xl border border-secondary/30 bg-white/80 backdrop-blur-sm shadow-[0_20px_50px_rgb(0,0,0,0.08)] p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            {paquete.mostrarDesde && <p className="text-sm text-gray-600 mb-1">Precio desde</p>}
            {tarifaEspecial.activa && tarifaEspecial.precioEspecial ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-gray-900" strokeWidth={2.5} />
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold tracking-tight text-gray-900">
                      ${paquete.precio.toLocaleString('es-AR')}
                    </span>
                    <span className="text-xs font-semibold uppercase text-gray-500">{paquete.moneda || 'ARS'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Flame className="h-5 w-5 text-amber-500" strokeWidth={2.5} />
                  <div className="flex flex-col">
                    <span className="text-2xl font-extrabold tracking-tight text-amber-500 leading-none">
                      ${tarifaEspecial.precioEspecial.toLocaleString('es-AR')}
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 mt-1">
                      Tarifa Especial
                    </span>
                    {tarifaEspecial.fechaLimiteLabel && (
                      <span className="text-xs font-medium text-amber-700 mt-1">
                        Vigente hasta el {tarifaEspecial.fechaLimiteLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-gray-900" strokeWidth={2.5} />
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-gray-900">
                    ${paquete.precio.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs font-semibold uppercase text-gray-500">{paquete.moneda || 'ARS'}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600 mt-1">Por persona</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Share2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-gray-200">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-700">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Destino</div>
              <div className="text-base font-semibold text-gray-900 truncate">{destino}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-700">
              <Moon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Duración</div>
              <div className="text-base font-semibold text-gray-900 truncate">{duracion}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center text-success">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Salida
                </div>
                <div className="text-base font-semibold text-gray-900 truncate">{salidaLabel || 'A confirmar'}</div>
              </div>
            </div>

            {vueltaLabel && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Vuelta
                  </div>
                  <div className="text-base font-semibold text-gray-900 truncate">{vueltaLabel}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {paquete.ctaWhatsApp && (
        <Button asChild variant="success" className="w-full text-base py-6 font-semibold rounded-2xl">
          <a href={getWhatsAppLinkForPackage(paquete.titulo)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            <span className="ml-2">Consultar por WhatsApp</span>
          </a>
        </Button>
      )}

      {condiciones.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <div className="space-y-2.5">
            {condiciones.map((item, index) => (
              <div key={`${item.titulo}-${index}`} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="font-semibold text-gray-900">{item.titulo}:</span> {item.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-900 font-extrabold tracking-tight">
            <span className="text-base">¡Compartí este viaje!</span>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href={whatsappShareHref}
              target="_blank"
              rel="noreferrer"
              className="h-10 w-10 rounded-full bg-success hover:bg-success/90 text-white flex items-center justify-center transition"
              aria-label="Compartir por WhatsApp"
            >
              <WhatsAppIcon />
            </a>
            <a
              href={facebookShareHref}
              target="_blank"
              rel="noreferrer"
              className="h-10 w-10 rounded-full bg-success hover:bg-success/90 text-white flex items-center justify-center transition"
              aria-label="Compartir en Facebook"
            >
              <FaFacebookF className="h-5 w-5" />
            </a>
            <a
              href={emailShareHref}
              className="h-10 w-10 rounded-full bg-success hover:bg-success/90 text-white flex items-center justify-center transition"
              aria-label="Compartir por Email"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
