'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import RichTextEditor from '@/components/admin/RichTextEditor';
import ImageUploader from '@/components/admin/ImageUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormattedAmountInput } from '@/components/ui/formatted-amount-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { slugify } from '@/lib/utils/slugify';
import { revalidateFrontPaths } from '@/lib/revalidate';
import { PAQUETE_TIPO_OPTIONS, PAQUETE_TIPO_VALUES } from '@/lib/paqueteMeta';
import type { Paquete, Categoria, Salida } from '@/types';
import EditableList from '@/components/admin/EditableList';
import SalidasManager from '@/components/admin/SalidasManager';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';

const TRANSPORTE_OPTIONS = [
  { value: 'bus', label: 'Bus' },
  { value: 'avion', label: 'Avión' },
  { value: 'barco', label: 'Barco' },
] as const;

const DEFAULT_CONDICIONES = [
  { titulo: 'Reserva', texto: 'Seña del 40% para asegurar tu lugar.' },
  { titulo: 'Pagos', texto: 'Consultá nuestras cuotas y medios de pago disponibles.' },
  { titulo: 'Confirmación', texto: 'Salida sujeta a la conformación del grupo mínimo.' },
  { titulo: 'Flexibilidad', texto: 'Excursiones condicionadas por clima o imprevistos.' },
  { titulo: 'Seguridad', texto: 'Recomendamos contratar asistencia al viajero.' },
  { titulo: 'Gastos extra', texto: 'No incluye comidas en ruta, bebidas ni opcionales.' },
  { titulo: 'Ingresos', texto: 'No incluye tickets a parques nacionales ni museos.' },
] as const;

type CondicionItem = { titulo: string; texto: string };

const formSchema = z.object({
  titulo: z.string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(100, 'El título no puede exceder 100 caracteres')
    .transform(val => val.trim()),
  descripcion: z.string()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .transform(val => val.trim()),
  descripcionCorta: z.string()
    .max(160, 'La descripción corta no puede exceder 160 caracteres')
    .optional()
    .or(z.literal(''))
    .transform(val => val?.trim() || ''),
  categoriaIds: z.array(z.string()).min(1, 'Debes seleccionar al menos una categoría'),
  tipos: z
    .array(z.enum(PAQUETE_TIPO_VALUES))
    .min(1, 'Debes seleccionar al menos un tipo'),
  precio: z.number()
    .min(0, 'El precio debe ser mayor o igual a 0')
    .max(999999999, 'El precio es demasiado alto')
    .transform(val => Number(val) || 0),
  tarifaEspecialHabilitada: z.boolean().transform(val => Boolean(val)),
  tarifaEspecialPrecio: z.number()
    .min(0, 'La tarifa especial debe ser mayor o igual a 0')
    .max(999999999, 'La tarifa especial es demasiado alta')
    .transform(val => Number(val) || 0),
  tarifaEspecialFechaLimite: z.string().optional(),
  moneda: z.enum(['USD', 'ARS', 'EUR']),
  mostrarDesde: z.boolean().transform(val => Boolean(val)),
  duracion: z.string()
    .min(1, 'La duración es requerida')
    .max(50, 'La duración no puede exceder 50 caracteres')
    .transform(val => val.trim()),
  visible: z.boolean().transform(val => Boolean(val)),
  destacado: z.boolean().transform(val => Boolean(val)),
  ctaWhatsApp: z.boolean().transform(val => Boolean(val)),
}).superRefine((data, ctx) => {
  if (!data.tarifaEspecialHabilitada) return;

  if (!data.tarifaEspecialPrecio || data.tarifaEspecialPrecio <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tarifaEspecialPrecio'],
      message: 'Ingresa un valor válido para la tarifa especial',
    });
  }

  if (!data.tarifaEspecialFechaLimite?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tarifaEspecialFechaLimite'],
      message: 'Debes indicar la fecha límite de la tarifa especial',
    });
  }
});

type FormData = z.infer<typeof formSchema>;

export default function EditarPaquetePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
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
  const [noIncludeItems, setNoIncludeItems] = useState<string[]>([]);
  const [condicionesItems, setCondicionesItems] = useState<CondicionItem[]>(
    DEFAULT_CONDICIONES.map((item) => ({ ...item }))
  );
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [destacadosCount, setDestacadosCount] = useState(0);
  const [wasDestacado, setWasDestacado] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const visible = watch('visible');
  const destacado = watch('destacado');
  const ctaWhatsApp = watch('ctaWhatsApp');
  const mostrarDesde = watch('mostrarDesde');
  const descripcionCorta = watch('descripcionCorta');
  const categoriaIds = watch('categoriaIds');
  const tipos = watch('tipos');
  const tarifaEspecialHabilitada = watch('tarifaEspecialHabilitada');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar categorías
        const catQuery = query(collection(db, 'categorias'), where('activa', '==', true));
        const catSnapshot = await getDocs(catQuery);
        const catData = catSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
        setCategorias(catData);

        // Contar paquetes destacados actuales (excluyendo el actual)
        const paquetesQuery = query(collection(db, 'paquetes'), where('destacado', '==', true));
        const paquetesSnapshot = await getDocs(paquetesQuery);
        const destacadosOtros = paquetesSnapshot.docs.filter(doc => doc.id !== id).length;
        setDestacadosCount(destacadosOtros);

        // Cargar paquete
        const docRef = doc(db, 'paquetes', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Paquete;
          setWasDestacado(data.destacado); // Guardar estado original
          setValue('titulo', data.titulo);
          setValue('descripcion', data.descripcion);
          setValue('descripcionCorta', data.descripcionCorta || '');
          setValue('categoriaIds', data.categoriaIds ?? (data.categoriaId ? [data.categoriaId] : []));
          setValue('tipos', (data.tipos ?? [data.tipo]) as FormData['tipos']);
          setValue('precio', data.precio);
          setValue('tarifaEspecialHabilitada', Boolean(data.precioDescuentoPrimerosCupos));
          setValue('tarifaEspecialPrecio', data.precioDescuentoPrimerosCupos || 0);
          setValue('tarifaEspecialFechaLimite', data.tarifaEspecialFechaLimite || '');
          setValue('moneda', data.moneda || 'ARS'); // Default ARS para retrocompatibilidad
          setValue('mostrarDesde', data.mostrarDesde ?? true); // Default true para retrocompatibilidad
          setValue('duracion', data.duracion);
          setValue('visible', data.visible);
          setValue('destacado', data.destacado);
          setValue('ctaWhatsApp', data.ctaWhatsApp);
          
          // Cargar imágenes existentes
          const tarjeta = data.imagenTarjeta || data.imagenPrincipal || '';
          const portadaMobile = data.imagenPortadaMobile || data.imagenPortada || data.imagenPrincipal || '';
          const portadaDesktop = data.imagenPortadaDesktop || data.imagenPortada || data.imagenPrincipal || '';
          setImagenTarjetaOriginal(tarjeta);
          const tarjetaKey =
            data.imagenTarjetaKey ?? data.imagenPrincipalKey ?? getBlobKeyFromUrl(tarjeta) ?? '';
          const portadaMobileKey =
            data.imagenPortadaMobileKey ?? data.imagenPortadaKey ?? getBlobKeyFromUrl(portadaMobile) ?? '';
          const portadaDesktopKey =
            data.imagenPortadaDesktopKey ?? data.imagenPortadaKey ?? getBlobKeyFromUrl(portadaDesktop) ?? '';
          const galeria = data.galeria || [];
          const galeriaKeys = data.galeriaKeys ?? [];
          setImagenTarjetaPreview(tarjeta ? [tarjeta] : []);
          setImagenTarjetaKey(tarjetaKey);
          setOriginalImagenTarjetaKey(tarjetaKey || null);
          setImagenPortadaMobileOriginal(portadaMobile);
          setImagenPortadaMobilePreview(portadaMobile ? [portadaMobile] : []);
          setImagenPortadaMobileKey(portadaMobileKey);
          setOriginalImagenPortadaMobileKey(portadaMobileKey || null);
          setImagenPortadaDesktopOriginal(portadaDesktop);
          setImagenPortadaDesktopPreview(portadaDesktop ? [portadaDesktop] : []);
          setImagenPortadaDesktopKey(portadaDesktopKey);
          setOriginalImagenPortadaDesktopKey(portadaDesktopKey || null);
          setGaleriaPreview(galeria);
          setGalleryAssets(
            galeria.map((url, idx) => ({
              url,
              key: (galeriaKeys[idx] || getBlobKeyFromUrl(url)) ?? undefined,
            }))
          );
          setOriginalGaleriaKeys(
            galeria
              .map((url, idx) => (galeriaKeys[idx] || getBlobKeyFromUrl(url)) ?? '')
              .filter((key): key is string => Boolean(key))
          );
          setIncludeItems(data.incluye || []);
          setSelectedTransportes((data.tiposTransporte || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean));
          setNoIncludeItems(data.noIncluye || []);
          setCondicionesItems(
            Array.isArray(data.condiciones) && data.condiciones.length > 0
              ? data.condiciones.map((item) => ({
                  titulo: String(item?.titulo ?? ''),
                  texto: String(item?.texto ?? ''),
                }))
              : DEFAULT_CONDICIONES.map((item) => ({ ...item }))
          );
          setSalidas(data.salidas || []);
        } else {
          toast.error('Excursión no encontrada');
          router.push('/admin/paquetes');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router, setValue]);

  const dataURLtoFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

type ImageAsset = {
  url: string;
  key?: string;
};

  const handleImagenTarjetaChange = (urls: string[]) => {
    const nextUrl = urls[0] ?? '';
    setImagenTarjetaPreview(nextUrl ? [nextUrl] : []);
    if (!nextUrl) {
      setImagenTarjetaKey('');
      return;
    }
    if (nextUrl !== imagenTarjetaPreview[0]) {
      setImagenTarjetaKey('');
    }
  };

  const handleImagenPortadaMobileChange = (urls: string[]) => {
    const nextUrl = urls[0] ?? '';
    setImagenPortadaMobilePreview(nextUrl ? [nextUrl] : []);
    if (!nextUrl) {
      setImagenPortadaMobileKey('');
      return;
    }
    if (nextUrl !== imagenPortadaMobilePreview[0]) {
      setImagenPortadaMobileKey('');
    }
  };

  const handleImagenPortadaDesktopChange = (urls: string[]) => {
    const nextUrl = urls[0] ?? '';
    setImagenPortadaDesktopPreview(nextUrl ? [nextUrl] : []);
    if (!nextUrl) {
      setImagenPortadaDesktopKey('');
      return;
    }
    if (nextUrl !== imagenPortadaDesktopPreview[0]) {
      setImagenPortadaDesktopKey('');
    }
  };

  const handleGaleriaChange = (newImages: string[]) => {
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
  };

  const onSubmit = async (data: FormData) => {
    if (
      imagenTarjetaPreview.length === 0 ||
      imagenPortadaMobilePreview.length === 0 ||
      imagenPortadaDesktopPreview.length === 0
    ) {
      toast.error('Debes agregar imagen de tarjeta, portada mobile y portada PC');
      return;
    }

    setSaving(true);
    try {
      const isDataUrl = (value: string) => value.startsWith('data:');
      const cardPreview = imagenTarjetaPreview[0] ?? '';
      const coverMobilePreview = imagenPortadaMobilePreview[0] ?? '';
      const coverDesktopPreview = imagenPortadaDesktopPreview[0] ?? '';

      const finalCard = {
        url: cardPreview,
        key: imagenTarjetaKey || getBlobKeyFromUrl(cardPreview) || '',
      };
      if (isDataUrl(cardPreview)) {
        toast.info('Subiendo imagen de tarjeta...', { id: 'upload-card' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(cardPreview, `paquete-card-${Date.now()}.jpg`),
        ]);
        finalCard.url = result.url;
        finalCard.key = result.key;
        const keyToDelete = originalImagenTarjetaKey ?? getBlobKeyFromUrl(imagenTarjetaOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[paquetes] error borrando imagen de tarjeta:', error);
          });
        }
        toast.success('Imagen de tarjeta actualizada', { id: 'upload-card' });
      }

      const finalCoverMobile = {
        url: coverMobilePreview,
        key: imagenPortadaMobileKey || getBlobKeyFromUrl(coverMobilePreview) || '',
      };
      if (isDataUrl(coverMobilePreview)) {
        toast.info('Subiendo imagen de portada mobile...', { id: 'upload-cover-mobile' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(coverMobilePreview, `paquete-cover-mobile-${Date.now()}.jpg`),
        ]);
        finalCoverMobile.url = result.url;
        finalCoverMobile.key = result.key;
        const keyToDelete = originalImagenPortadaMobileKey ?? getBlobKeyFromUrl(imagenPortadaMobileOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[paquetes] error borrando imagen de portada mobile:', error);
          });
        }
        toast.success('Imagen de portada mobile actualizada', { id: 'upload-cover-mobile' });
      }

      const finalCoverDesktop = {
        url: coverDesktopPreview,
        key: imagenPortadaDesktopKey || getBlobKeyFromUrl(coverDesktopPreview) || '',
      };
      if (isDataUrl(coverDesktopPreview)) {
        toast.info('Subiendo imagen de portada PC...', { id: 'upload-cover-desktop' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(coverDesktopPreview, `paquete-cover-desktop-${Date.now()}.jpg`),
        ]);
        finalCoverDesktop.url = result.url;
        finalCoverDesktop.key = result.key;
        const keyToDelete = originalImagenPortadaDesktopKey ?? getBlobKeyFromUrl(imagenPortadaDesktopOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[paquetes] error borrando imagen de portada PC:', error);
          });
        }
        toast.success('Imagen de portada PC actualizada', { id: 'upload-cover-desktop' });
      }

      let uploadedGalleryResults: { url: string; key: string }[] = [];
      const dataUrlGaleria = galleryAssets.filter((asset) => isDataUrl(asset.url));
      if (dataUrlGaleria.length > 0) {
        toast.info('Subiendo imágenes de galería...', { id: 'upload-gal' });
        const files = dataUrlGaleria.map((asset, index) =>
          dataURLtoFile(asset.url, `paquete-gallery-${Date.now()}-${index}.jpg`)
        );
        uploadedGalleryResults = await uploadMultipleImages(files);
        toast.success('Galería actualizada', { id: 'upload-gal' });
      }

      const finalGalleryAssets = galleryAssets.map((asset) => {
        if (isDataUrl(asset.url)) {
          const nextResult = uploadedGalleryResults.shift();
          if (!nextResult) {
            return { url: asset.url, key: asset.key ?? '' };
          }
          return { url: nextResult.url, key: nextResult.key };
        }
        const key = asset.key ?? getBlobKeyFromUrl(asset.url) ?? '';
        return { url: asset.url, key };
      });

      const galeriaUrls = finalGalleryAssets.map((asset) => asset.url);
      const galeriaKeys = finalGalleryAssets.map((asset) => asset.key);

      const keysToDelete = new Set<string>();
      if (originalImagenTarjetaKey && finalCard.key && originalImagenTarjetaKey !== finalCard.key) {
        keysToDelete.add(originalImagenTarjetaKey);
      }
      if (
        originalImagenPortadaMobileKey &&
        finalCoverMobile.key &&
        originalImagenPortadaMobileKey !== finalCoverMobile.key
      ) {
        keysToDelete.add(originalImagenPortadaMobileKey);
      }
      if (
        originalImagenPortadaDesktopKey &&
        finalCoverDesktop.key &&
        originalImagenPortadaDesktopKey !== finalCoverDesktop.key
      ) {
        keysToDelete.add(originalImagenPortadaDesktopKey);
      }
      const finalGalleryKeySet = new Set(galeriaKeys.filter((key): key is string => Boolean(key)));
      originalGaleriaKeys.forEach((key) => {
        if (key && !finalGalleryKeySet.has(key)) {
          keysToDelete.add(key);
        }
      });

      if (keysToDelete.size > 0) {
        const deletions = Array.from(keysToDelete);
        const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            console.error('[paquetes] error borrando blob:', deletions[idx], result.reason);
          }
        });
      }

      const slug = slugify(data.titulo);

      const primaryCategoriaId = data.categoriaIds[0];
      const primaryTipo = data.tipos[0];
      const categoriaSeleccionada = categorias.find((cat) => cat.id === primaryCategoriaId);
      const nombreCategoria = categoriaSeleccionada?.nombre || 'Destino';

      // Sanitizar datos antes de guardar
      const sanitizedData = {
        titulo: data.titulo.trim(),
        slug,
        descripcion: data.descripcion.trim(),
        descripcionCorta: data.descripcionCorta?.trim() || '',
        destino: nombreCategoria,
        categoriaId: primaryCategoriaId,
        categoriaIds: data.categoriaIds,
        tipo: primaryTipo,
        tipos: data.tipos,
        precio: Number(data.precio) || 0,
        precioDescuentoPrimerosCupos: data.tarifaEspecialHabilitada
          ? Number(data.tarifaEspecialPrecio) || 0
          : deleteField(),
        tarifaEspecialFechaLimite: data.tarifaEspecialHabilitada
          ? data.tarifaEspecialFechaLimite?.trim() || ''
          : deleteField(),
        moneda: data.moneda,
        mostrarDesde: Boolean(data.mostrarDesde),
        duracion: data.duracion.trim(),
        incluye: includeItems.filter(item => item.trim().length > 0),
        tiposTransporte: selectedTransportes,
        noIncluye: noIncludeItems.filter(item => item.trim().length > 0),
        condiciones: condicionesItems
          .map((item) => ({
            titulo: item.titulo.trim(),
            texto: item.texto.trim(),
          }))
          .filter((item) => item.titulo.length > 0 && item.texto.length > 0),
        salidas: salidas.map(salida => {
          const sanitizedSalida: Partial<Salida> = {
            ...salida,
            fecha: salida.fecha.trim(),
            fechaVuelta: salida.fechaVuelta?.trim() || '',
            ciudadSalida: salida.ciudadSalida.trim(),
            precio: Number(salida.precio) || 0,
            observaciones: salida.observaciones?.trim() || '',
          };
          
          // Solo agregar cupo si tiene un valor válido
          if (salida.cupo && salida.cupo > 0) {
            sanitizedSalida.cupo = Number(salida.cupo);
          }
          
          return sanitizedSalida as Salida;
        }),
        imagenPrincipal: finalCard.url,
        imagenPrincipalKey: finalCard.key,
        imagenTarjeta: finalCard.url,
        imagenTarjetaKey: finalCard.key,
        imagenPortada: finalCoverDesktop.url,
        imagenPortadaKey: finalCoverDesktop.key,
        imagenPortadaMobile: finalCoverMobile.url,
        imagenPortadaMobileKey: finalCoverMobile.key,
        imagenPortadaDesktop: finalCoverDesktop.url,
        imagenPortadaDesktopKey: finalCoverDesktop.key,
        galeria: galeriaUrls,
        galeriaKeys: galeriaKeys,
        visible: Boolean(data.visible),
        destacado: Boolean(data.destacado),
        ctaWhatsApp: Boolean(data.ctaWhatsApp),
        etiqueta: deleteField(),
        tags: deleteField(),
      };

      await updateDoc(doc(db, 'paquetes', id), sanitizedData);
      const slugNew = slugify(data.titulo);
      await revalidateFrontPaths(['/paquetes', `/paquete/${slugNew}`]);

      toast.success('Excursión actualizada correctamente');
      router.push('/admin/paquetes');
    } catch (error) {
      console.error('Error updating paquete:', error);
      toast.error('Error al actualizar paquete');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/paquetes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Editar Excursión</h1>
              <p className="text-gray-600 mt-1">Modifica la información de la excursión</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Información Principal */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    {...register('titulo')}
                    placeholder="Ej: Europa Mágica - 15 días"
                    className="mt-1.5"
                  />
                  {errors.titulo && (
                    <p className="text-base text-red-500 mt-1">{errors.titulo.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="descripcionCorta">Descripción corta (Recomendada)</Label>
                  <Input
                    id="descripcionCorta"
                    {...register('descripcionCorta')}
                    placeholder="Ej: Descubre Europa en 15 días inolvidables con todo incluido"
                    className="mt-1.5"
                    maxLength={160}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500">
                      Este texto se usa solo en la tarjeta de la excursión
                    </p>
                    <p className={`text-sm ${(descripcionCorta?.length || 0) > 140 ? 'text-orange-500' : 'text-gray-500'}`}>
                      {descripcionCorta?.length || 0}/160 caracteres
                    </p>
                  </div>
                  {errors.descripcionCorta && (
                    <p className="text-base text-red-500 mt-1">{errors.descripcionCorta.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="descripcion">Descripción completa * (Usa el editor para dar formato)</Label>
                  <div className="mt-1.5">
                    <Controller
                      name="descripcion"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor
                          content={field.value}
                          onChange={field.onChange}
                          placeholder="Describe la excursión... Puedes usar negritas, listas y links."
                        />
                      )}
                    />
                  </div>
                  {errors.descripcion && (
                    <p className="text-base text-red-500 mt-1">{errors.descripcion.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="duracion">Duración *</Label>
                  <Input
                    id="duracion"
                    {...register('duracion')}
                    placeholder="Ej: 15 días / 14 noches"
                    className="mt-1.5"
                  />
                  {errors.duracion && (
                    <p className="text-base text-red-500 mt-1">{errors.duracion.message}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <Label>Categorías *</Label>
                    <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 max-h-48 overflow-y-auto">
                      {categorias.map((cat) => {
                        const checked = (categoriaIds || []).includes(cat.id);
                        return (
                          <label key={cat.id} className="flex items-center gap-2.5 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                const want = next === true;
                                const current = categoriaIds || [];
                                const updated = want
                                  ? Array.from(new Set([...current, cat.id]))
                                  : current.filter((id) => id !== cat.id);
                                setValue('categoriaIds', updated, { shouldValidate: true });
                              }}
                              className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                            />
                            <span className="text-sm text-gray-700">{cat.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.categoriaIds && (
                      <p className="text-base text-red-500 mt-1">{errors.categoriaIds.message as string}</p>
                    )}
                  </div>

                  <div>
                    <Label>Tipo *</Label>
                    <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 max-h-48 overflow-y-auto">
                      {PAQUETE_TIPO_OPTIONS.map((opt) => {
                        const checked = (tipos || []).includes(opt.value);
                        return (
                          <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                const want = next === true;
                                const current = tipos || [];
                                const updated = want
                                  ? Array.from(new Set([...current, opt.value]))
                                  : current.filter((t) => t !== opt.value);
                                setValue('tipos', updated as FormData['tipos'], { shouldValidate: true });
                              }}
                              className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                            />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.tipos && (
                      <p className="text-base text-red-500 mt-1">{errors.tipos.message as string}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="precio">Precio *</Label>
                        <Controller
                          name="precio"
                          control={control}
                          render={({ field }) => (
                            <FormattedAmountInput
                              id="precio"
                              value={Number(field.value) || 0}
                              onChange={field.onChange}
                              placeholder="0"
                              className="mt-1.5"
                            />
                          )}
                        />
                        {errors.precio && (
                          <p className="text-base text-red-500 mt-1">{errors.precio.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="moneda">Moneda *</Label>
                        <Controller
                          name="moneda"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="tarifaEspecialHabilitada" className="text-base font-medium cursor-pointer">
                            Tarifa especial
                          </Label>
                          <p className="text-sm text-gray-500">
                            Configura un precio promocional con fecha límite. Al vencer, se vuelve a mostrar automáticamente la tarifa base.
                          </p>
                        </div>
                        <Switch
                          id="tarifaEspecialHabilitada"
                          checked={tarifaEspecialHabilitada}
                          onCheckedChange={(checked) => setValue('tarifaEspecialHabilitada', checked, { shouldValidate: true })}
                        />
                      </div>

                      {tarifaEspecialHabilitada && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor="tarifaEspecialPrecio">Tarifa especial *</Label>
                            <Controller
                              name="tarifaEspecialPrecio"
                              control={control}
                              render={({ field }) => (
                                <FormattedAmountInput
                                  id="tarifaEspecialPrecio"
                                  value={Number(field.value) || 0}
                                  onChange={field.onChange}
                                  placeholder="0"
                                  className="mt-1.5"
                                />
                              )}
                            />
                            {errors.tarifaEspecialPrecio && (
                              <p className="text-base text-red-500 mt-1">{errors.tarifaEspecialPrecio.message}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="tarifaEspecialFechaLimite">Fecha límite *</Label>
                            <Input
                              id="tarifaEspecialFechaLimite"
                              type="date"
                              {...register('tarifaEspecialFechaLimite')}
                              className="mt-1.5"
                            />
                            {errors.tarifaEspecialFechaLimite && (
                              <p className="text-base text-red-500 mt-1">{errors.tarifaEspecialFechaLimite.message}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Transporte</Label>
                      <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                        {TRANSPORTE_OPTIONS.map((opt) => {
                          const checked = selectedTransportes.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) => {
                                  const want = next === true;
                                  setSelectedTransportes((prev) =>
                                    want ? Array.from(new Set([...prev, opt.value])) : prev.filter((t) => t !== opt.value)
                                  );
                                }}
                                className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                              />
                              <span className="text-sm text-gray-700">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="space-y-0.5">
                        <Label htmlFor="mostrarDesde" className="text-base font-medium cursor-pointer">Mostrar &quot;Desde&quot;</Label>
                        <p className="text-sm text-gray-500">Se mostrará &quot;Desde $XXX&quot; en la tarjeta</p>
                      </div>
                      <Switch
                        id="mostrarDesde"
                        checked={mostrarDesde}
                        onCheckedChange={(checked) => setValue('mostrarDesde', checked)}
                      />
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Configuración de Destacado y Orden */}
            <Card className="border-2">
              <CardHeader className="pb-4">
                <CardTitle>Excursión Destacada y Orden</CardTitle>
                <p className="text-base text-gray-500 mt-1.5">
                  Las excursiones destacadas aparecen en la página de inicio (máximo 9)
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Switch de Destacado */}
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="destacado" className="text-lg font-medium cursor-pointer">Marcar como destacado</Label>
                    <p className="text-sm text-gray-500 pr-4">
                      Aparecerá en la sección destacados de la homepage (máximo 9)
                    </p>
                    {destacadosCount >= 9 && destacado && !wasDestacado && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          <strong>Límite alcanzado:</strong> Ya hay {destacadosCount} excursiones destacadas. Solo se mostrarán las primeras 9 en el inicio.
                        </p>
                      </div>
                    )}
                    {destacadosCount < 9 && destacado && (
                      <p className="text-sm text-green-600 mt-2">
                        {wasDestacado ? destacadosCount + 1 : destacadosCount + 1} de 9 destacados
                      </p>
                    )}
                  </div>
                  <Switch
                    id="destacado"
                    checked={destacado}
                    onCheckedChange={(checked) => {
                      if (checked && !wasDestacado && destacadosCount >= 9) {
                        toast.warning('Ya hay 9 excursiones destacadas', {
                          description: 'Solo se mostrarán los primeros 9 en el inicio (ordenados por número de orden)',
                        });
                      }
                      setValue('destacado', checked);
                    }}
                    className="mt-0.5"
                  />
                </div>

                {/* Gestión de Orden Visual - Solo si está destacado */}
                {destacado ? (
                  <DragDropOrderManager
                    collectionName="paquetes"
                    currentId={id}
                    maxItems={9}
                    onlyDestacados={true}
                  />
                ) : (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-base text-blue-700 font-medium">
                      Marca la excursión como destacada para gestionar su orden de aparición en la homepage
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-5">
              {/* ¿Qué Incluye? */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>¿Qué Incluye?</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditableList
                    items={includeItems}
                    onItemsChange={setIncludeItems}
                    placeholder="Ej: Vuelos ida y vuelta"
                    emptyMessage="No hay ítems en 'Incluye'"
                  />
                </CardContent>
              </Card>

              {/* ¿Qué NO Incluye? */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>¿Qué NO Incluye?</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditableList
                    items={noIncludeItems}
                    onItemsChange={setNoIncludeItems}
                    placeholder="Ej: Comidas no especificadas"
                    emptyMessage="No hay ítems en 'No Incluye'"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Condiciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {condicionesItems.map((item, index) => (
                    <div key={`${item.titulo}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label className="text-sm">Título</Label>
                            <Input
                              value={item.titulo}
                              onChange={(e) => {
                                const next = [...condicionesItems];
                                next[index] = { ...next[index], titulo: e.target.value };
                                setCondicionesItems(next);
                              }}
                              className="mt-1.5"
                              placeholder="Ej: Reserva"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Texto</Label>
                            <Textarea
                              value={item.texto}
                              onChange={(e) => {
                                const next = [...condicionesItems];
                                next[index] = { ...next[index], texto: e.target.value };
                                setCondicionesItems(next);
                              }}
                              className="mt-1.5"
                              placeholder="Ej: Seña del 40% para asegurar tu lugar."
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (index === 0) return;
                              const next = [...condicionesItems];
                              const tmp = next[index - 1];
                              next[index - 1] = next[index];
                              next[index] = tmp;
                              setCondicionesItems(next);
                            }}
                            disabled={index === 0}
                            aria-label="Subir"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (index === condicionesItems.length - 1) return;
                              const next = [...condicionesItems];
                              const tmp = next[index + 1];
                              next[index + 1] = next[index];
                              next[index] = tmp;
                              setCondicionesItems(next);
                            }}
                            disabled={index === condicionesItems.length - 1}
                            aria-label="Bajar"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCondicionesItems(condicionesItems.filter((_, i) => i !== index))}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCondicionesItems([...condicionesItems, { titulo: '', texto: '' }])}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar condición
                </Button>
              </CardContent>
            </Card>

            {/* Fechas y Salidas */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Fechas y Salidas</CardTitle>
                <p className="text-base text-gray-600 mt-1">
                  Carga salidas solo si esta excursión las necesita
                </p>
              </CardHeader>
              <CardContent>
                <SalidasManager
                  salidas={salidas}
                  onSalidasChange={setSalidas}
                />
              </CardContent>
            </Card>

            {/* Configuración y Visibilidad */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Configuración y Visibilidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="visible" className="text-lg font-medium cursor-pointer">Excursión visible</Label>
                    <p className="text-sm text-gray-500 pr-4">Activar para que sea visible en el sitio web</p>
                  </div>
                  <Switch
                    id="visible"
                    checked={visible}
                    onCheckedChange={(checked) => setValue('visible', checked)}
                    className="mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="ctaWhatsApp" className="text-lg font-medium cursor-pointer">Botón de WhatsApp</Label>
                    <p className="text-sm text-gray-500 pr-4">Mostrar botón de contacto directo por WhatsApp en el detalle</p>
                  </div>
                  <Switch
                    id="ctaWhatsApp"
                    checked={ctaWhatsApp}
                    onCheckedChange={(checked) => setValue('ctaWhatsApp', checked)}
                    className="mt-0.5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Imágenes de la Excursión - Full Width */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Imágenes de la Excursión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ImageUploader
                  images={imagenTarjetaPreview}
                  onImagesChange={handleImagenTarjetaChange}
                  maxImages={1}
                  label="Imagen de tarjeta *"
                  description="Se usa en las cards del sitio. Medida recomendada: 1200x900 px."
                />
                <ImageUploader
                  images={imagenPortadaMobilePreview}
                  onImagesChange={handleImagenPortadaMobileChange}
                  maxImages={1}
                  label="Imagen de portada mobile *"
                  description="Se usa en el hero mobile de la excursión. Medida recomendada: 1080x1350 px."
                />
                <ImageUploader
                  images={imagenPortadaDesktopPreview}
                  onImagesChange={handleImagenPortadaDesktopChange}
                  maxImages={1}
                  label="Imagen de portada PC *"
                  description="Se usa en el hero desktop de la excursión. Medida recomendada: 1920x900 px."
                />
                <ImageUploader
                  images={galeriaPreview}
                  onImagesChange={handleGaleriaChange}
                  maxImages={8}
                  label="Galería de imágenes"
                  description="Imágenes adicionales para la galería de la excursión."
                />
              </CardContent>
            </Card>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" asChild size="lg">
                <Link href="/admin/paquetes">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                size="lg"
                className="bg-black hover:bg-gray-800 text-white min-w-[180px]"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
