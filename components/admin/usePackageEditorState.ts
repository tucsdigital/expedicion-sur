'use client';

import { useCallback, useState } from 'react';
import type { Paquete, Salida } from '@/types';
import type { CondicionItem } from '@/lib/packages/admin-form';

export type ImageAsset = {
  url: string;
  key?: string;
};

type Options = {
  defaultCondiciones: CondicionItem[];
};

export function usePackageEditorState({ defaultCondiciones }: Options) {
  const [imagenTarjetaPreview, setImagenTarjetaPreview] = useState<string[]>([]);
  const [imagenTarjetaOriginal, setImagenTarjetaOriginal] = useState<string>('');
  const [imagenTarjetaKey, setImagenTarjetaKey] = useState<string>('');
  const [originalImagenTarjetaKey, setOriginalImagenTarjetaKey] = useState<string | null>(null);
  const [imagenPortadaMobilePreview, setImagenPortadaMobilePreview] = useState<string[]>([]);
  const [imagenPortadaMobileOriginal, setImagenPortadaMobileOriginal] = useState<string>('');
  const [imagenPortadaMobileKey, setImagenPortadaMobileKey] = useState<string>('');
  const [originalImagenPortadaMobileKey, setOriginalImagenPortadaMobileKey] = useState<string | null>(null);
  const [imagenPortadaDesktopPreview, setImagenPortadaDesktopPreview] = useState<string[]>([]);
  const [imagenPortadaDesktopOriginal, setImagenPortadaDesktopOriginal] = useState<string>('');
  const [imagenPortadaDesktopKey, setImagenPortadaDesktopKey] = useState<string>('');
  const [originalImagenPortadaDesktopKey, setOriginalImagenPortadaDesktopKey] = useState<string | null>(null);
  const [galeriaPreview, setGaleriaPreview] = useState<string[]>([]);
  const [galleryAssets, setGalleryAssets] = useState<ImageAsset[]>([]);
  const [originalGaleriaKeys, setOriginalGaleriaKeys] = useState<string[]>([]);
  const [includeItems, setIncludeItems] = useState<string[]>([]);
  const [selectedTransportes, setSelectedTransportes] = useState<string[]>([]);
  const [tagItems, setTagItems] = useState<string[]>([]);
  const [noIncludeItems, setNoIncludeItems] = useState<string[]>([]);
  const [condicionesItems, setCondicionesItems] = useState<CondicionItem[]>(defaultCondiciones.map((item) => ({ ...item })));
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  const handleImagenTarjetaChange = useCallback(
    (urls: string[]) => {
      const nextUrl = urls[0] ?? '';
      setImagenTarjetaPreview(nextUrl ? [nextUrl] : []);
      if (!nextUrl) {
        setImagenTarjetaKey('');
        return;
      }
      setImagenTarjetaKey((currentKey) => (nextUrl !== imagenTarjetaPreview[0] ? '' : currentKey));
    },
    [imagenTarjetaPreview]
  );

  const handleImagenPortadaMobileChange = useCallback(
    (urls: string[]) => {
      const nextUrl = urls[0] ?? '';
      setImagenPortadaMobilePreview(nextUrl ? [nextUrl] : []);
      if (!nextUrl) {
        setImagenPortadaMobileKey('');
        return;
      }
      setImagenPortadaMobileKey((currentKey) => (nextUrl !== imagenPortadaMobilePreview[0] ? '' : currentKey));
    },
    [imagenPortadaMobilePreview]
  );

  const handleImagenPortadaDesktopChange = useCallback(
    (urls: string[]) => {
      const nextUrl = urls[0] ?? '';
      setImagenPortadaDesktopPreview(nextUrl ? [nextUrl] : []);
      if (!nextUrl) {
        setImagenPortadaDesktopKey('');
        return;
      }
      setImagenPortadaDesktopKey((currentKey) => (nextUrl !== imagenPortadaDesktopPreview[0] ? '' : currentKey));
    },
    [imagenPortadaDesktopPreview]
  );

  const handleGaleriaChange = useCallback((newImages: string[]) => {
    setGaleriaPreview(newImages);
    setGalleryAssets((prevAssets) => {
      const available = [...prevAssets];
      return newImages.map((url) => {
        const matchIndex = available.findIndex((asset) => asset.url === url);
        if (matchIndex !== -1) {
          const [matched] = available.splice(matchIndex, 1);
          return matched;
        }
        return { url };
      });
    });
  }, []);

  const hydrateFromPackage = useCallback(
    (data: Paquete, helpers: { getBlobKeyFromUrl: (url: string) => string | null }) => {
      const tarjeta = data.imagenTarjeta || data.imagenPrincipal || '';
      const portadaMobile = (data as any).imagenPortadaMobile || data.imagenPortada || data.imagenPrincipal || '';
      const portadaDesktop = (data as any).imagenPortadaDesktop || data.imagenPortada || data.imagenPrincipal || '';
      const galeria = data.galeria || [];
      const galeriaKeys = data.galeriaKeys ?? [];
      const tarjetaKey = data.imagenTarjetaKey ?? data.imagenPrincipalKey ?? helpers.getBlobKeyFromUrl(tarjeta) ?? '';
      const portadaMobileKey =
        (data as any).imagenPortadaMobileKey ?? data.imagenPortadaKey ?? data.imagenPrincipalKey ?? helpers.getBlobKeyFromUrl(portadaMobile) ?? '';
      const portadaDesktopKey =
        (data as any).imagenPortadaDesktopKey ?? data.imagenPortadaKey ?? data.imagenPrincipalKey ?? helpers.getBlobKeyFromUrl(portadaDesktop) ?? '';

      setImagenTarjetaOriginal(tarjeta);
      setImagenPortadaMobileOriginal(portadaMobile);
      setImagenPortadaDesktopOriginal(portadaDesktop);
      setImagenTarjetaPreview(tarjeta ? [tarjeta] : []);
      setImagenTarjetaKey(tarjetaKey);
      setOriginalImagenTarjetaKey(tarjetaKey || null);
      setImagenPortadaMobilePreview(portadaMobile ? [portadaMobile] : []);
      setImagenPortadaMobileKey(portadaMobileKey);
      setOriginalImagenPortadaMobileKey(portadaMobileKey || null);
      setImagenPortadaDesktopPreview(portadaDesktop ? [portadaDesktop] : []);
      setImagenPortadaDesktopKey(portadaDesktopKey);
      setOriginalImagenPortadaDesktopKey(portadaDesktopKey || null);
      setGaleriaPreview(galeria);
      setGalleryAssets(
        galeria.map((url, idx) => ({
          url,
          key: (galeriaKeys[idx] || helpers.getBlobKeyFromUrl(url)) ?? undefined,
        }))
      );
      setOriginalGaleriaKeys(
        galeria
          .map((url, idx) => (galeriaKeys[idx] || helpers.getBlobKeyFromUrl(url)) ?? '')
          .filter((key): key is string => Boolean(key))
      );
      setIncludeItems(data.incluye || []);
      setSelectedTransportes((data.tiposTransporte || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean));
      setTagItems(data.tags || []);
      setNoIncludeItems(data.noIncluye || []);
      setCondicionesItems(
        Array.isArray(data.condiciones) && data.condiciones.length > 0
          ? data.condiciones.map((item) => ({
              titulo: String(item?.titulo ?? ''),
              texto: String(item?.texto ?? ''),
            }))
          : defaultCondiciones.map((item) => ({ ...item }))
      );
      setSalidas(data.salidas || []);
      setFechaVencimiento(String((data as any).fechaVencimiento ?? ''));
    },
    [defaultCondiciones]
  );

  return {
    imagenTarjetaPreview,
    setImagenTarjetaPreview,
    imagenTarjetaOriginal,
    imagenTarjetaKey,
    setImagenTarjetaKey,
    originalImagenTarjetaKey,
    imagenPortadaMobilePreview,
    setImagenPortadaMobilePreview,
    imagenPortadaMobileOriginal,
    imagenPortadaMobileKey,
    setImagenPortadaMobileKey,
    originalImagenPortadaMobileKey,
    imagenPortadaDesktopPreview,
    setImagenPortadaDesktopPreview,
    imagenPortadaDesktopOriginal,
    imagenPortadaDesktopKey,
    setImagenPortadaDesktopKey,
    originalImagenPortadaDesktopKey,
    galeriaPreview,
    setGaleriaPreview,
    galleryAssets,
    setGalleryAssets,
    originalGaleriaKeys,
    includeItems,
    setIncludeItems,
    selectedTransportes,
    setSelectedTransportes,
    tagItems,
    setTagItems,
    noIncludeItems,
    setNoIncludeItems,
    condicionesItems,
    setCondicionesItems,
    salidas,
    setSalidas,
    fechaVencimiento,
    setFechaVencimiento,
    handleImagenTarjetaChange,
    handleImagenPortadaMobileChange,
    handleImagenPortadaDesktopChange,
    handleGaleriaChange,
    hydrateFromPackage,
  };
}
