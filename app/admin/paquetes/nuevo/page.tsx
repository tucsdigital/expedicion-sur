'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, Timestamp, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
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
import type { Categoria, Salida } from '@/types';
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
  incluye: z.string(), // Se convertirá a array
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

export default function NuevoPaquetePage() {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [imagenTarjetaPreview, setImagenTarjetaPreview] = useState<string[]>([]);
  const [imagenPortadaMobilePreview, setImagenPortadaMobilePreview] = useState<string[]>([]);
  const [imagenPortadaDesktopPreview, setImagenPortadaDesktopPreview] = useState<string[]>([]);
  const [galeriaPreview, setGaleriaPreview] = useState<string[]>([]);
  const [includeItems, setIncludeItems] = useState<string[]>([]);
  const [selectedTransportes, setSelectedTransportes] = useState<string[]>([]);
  const [noIncludeItems, setNoIncludeItems] = useState<string[]>([]);
  const [condicionesItems, setCondicionesItems] = useState<CondicionItem[]>(
    DEFAULT_CONDICIONES.map((item) => ({ ...item }))
  );
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [destacadosCount, setDestacadosCount] = useState(0);
  const [selectedDestacadoPosition, setSelectedDestacadoPosition] = useState<number | null>(null);
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
    defaultValues: {
      visible: true,
      destacado: true,
      ctaWhatsApp: true,
      mostrarDesde: true,
      tipos: ['individual'],
      categoriaIds: [],
      tarifaEspecialHabilitada: false,
      tarifaEspecialPrecio: 0,
      tarifaEspecialFechaLimite: '',
      moneda: 'ARS',
      incluye: '',
      descripcionCorta: '',
    },
  });

  const visible = watch('visible');
  const destacado = watch('destacado');
  const ctaWhatsApp = watch('ctaWhatsApp');
  const mostrarDesde = watch('mostrarDesde');
  const descripcionCorta = watch('descripcionCorta');
  const categoriaIds = watch('categoriaIds');
  const tipos = watch('tipos');
  const tarifaEspecialHabilitada = watch('tarifaEspecialHabilitada');

  // Cargar categorías y contar destacados
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar categorías
        const categoriasQuery = query(collection(db, 'categorias'), where('activa', '==', true));
        const categoriasSnapshot = await getDocs(categoriasQuery);
        const categoriasData = categoriasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
        setCategorias(categoriasData);

        // Contar paquetes destacados actuales
        const paquetesQuery = query(collection(db, 'paquetes'), where('destacado', '==', true));
        const paquetesSnapshot = await getDocs(paquetesQuery);
        setDestacadosCount(paquetesSnapshot.size);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar datos');
      }
    };

    fetchData();
  }, []);

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

  const onSubmit = async (data: FormData) => {
    if (
      imagenTarjetaPreview.length === 0 ||
      imagenPortadaMobilePreview.length === 0 ||
      imagenPortadaDesktopPreview.length === 0
    ) {
      toast.error('Debes agregar imagen de tarjeta, portada mobile y portada PC');
      return;
    }

    setLoading(true);
    try {
      // Convertir previews a archivos y subir
      const cardFiles = imagenTarjetaPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-card-${Date.now()}-${index}.jpg`)
      );
      const coverMobileFiles = imagenPortadaMobilePreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-cover-mobile-${Date.now()}-${index}.jpg`)
      );
      const coverDesktopFiles = imagenPortadaDesktopPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-cover-desktop-${Date.now()}-${index}.jpg`)
      );
      const galleryFiles = galeriaPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-gallery-${Date.now()}-${index}.jpg`)
      );

      toast.info('Subiendo imágenes...', { id: 'upload' });
      const [imagenTarjetaResult] = await uploadMultipleImages(cardFiles);
      const [imagenPortadaMobileResult] = await uploadMultipleImages(coverMobileFiles);
      const [imagenPortadaDesktopResult] = await uploadMultipleImages(coverDesktopFiles);
      const galeriaResults = galleryFiles.length > 0 ? await uploadMultipleImages(galleryFiles) : [];
      const imagenTarjetaUrl = imagenTarjetaResult.url;
      const imagenTarjetaKey = imagenTarjetaResult.key;
      const imagenPortadaMobileUrl = imagenPortadaMobileResult.url;
      const imagenPortadaMobileKey = imagenPortadaMobileResult.key;
      const imagenPortadaDesktopUrl = imagenPortadaDesktopResult.url;
      const imagenPortadaDesktopKey = imagenPortadaDesktopResult.key;
      const galeriaUrls = galeriaResults.length > 0 ? galeriaResults.map((item) => item.url) : [];
      const galeriaKeys = galeriaResults.length > 0 ? galeriaResults.map((item) => item.key) : [];
      toast.success('Imágenes subidas correctamente', { id: 'upload' });

      const slug = slugify(data.titulo);

      const primaryCategoriaId = data.categoriaIds[0];
      const primaryTipo = data.tipos[0];
      const categoriaSeleccionada = categorias.find((cat) => cat.id === primaryCategoriaId);
      const nombreCategoria = categoriaSeleccionada?.nombre || 'Destino';

      // Determinar el orden a usar
      let nuevoOrden: number;
      
      if (data.destacado && selectedDestacadoPosition !== null) {
        // Usar posición elegida para destacados
        nuevoOrden = selectedDestacadoPosition;
        
        // Actualizar órdenes de paquetes destacados existentes
        const paquetesSnapshot = await getDocs(collection(db, 'paquetes'));
        const paquetesData = paquetesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          } as { id: string; orden: number; destacado?: boolean }))
          .filter(p => p.destacado === true); // Solo destacados
        
        const batch = writeBatch(db);
        
        paquetesData.forEach((paquete) => {
          if (paquete.orden >= nuevoOrden) {
            batch.update(doc(db, 'paquetes', paquete.id), {
              orden: paquete.orden + 1
            });
          }
        });
        
        await batch.commit();
      } else {
        // Orden por defecto (al final)
        const paquetesSnapshot = await getDocs(collection(db, 'paquetes'));
        const maxOrden = paquetesSnapshot.docs.length > 0 
          ? Math.max(...paquetesSnapshot.docs.map(doc => (doc.data().orden || 0))) 
          : 0;
        nuevoOrden = maxOrden + 1;
      }

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
        imagenPrincipal: imagenTarjetaUrl,
        imagenPrincipalKey: imagenTarjetaKey,
        imagenTarjeta: imagenTarjetaUrl,
        imagenTarjetaKey,
        imagenPortada: imagenPortadaDesktopUrl,
        imagenPortadaKey: imagenPortadaDesktopKey,
        imagenPortadaMobile: imagenPortadaMobileUrl,
        imagenPortadaMobileKey,
        imagenPortadaDesktop: imagenPortadaDesktopUrl,
        imagenPortadaDesktopKey,
        galeria: galeriaUrls,
        galeriaKeys,
        visible: Boolean(data.visible),
        destacado: Boolean(data.destacado),
        ctaWhatsApp: Boolean(data.ctaWhatsApp),
        orden: nuevoOrden, // Usar la posición elegida
        fechaCreacion: Timestamp.now(),
        ...(data.tarifaEspecialHabilitada
          ? {
              precioDescuentoPrimerosCupos: Number(data.tarifaEspecialPrecio) || 0,
              tarifaEspecialFechaLimite: data.tarifaEspecialFechaLimite?.trim() || '',
            }
          : {}),
      };

      await addDoc(collection(db, 'paquetes'), sanitizedData);
      await revalidateFrontPaths(['/paquetes', `/paquete/${slug}`]);

      toast.success('✅ Excursión creada correctamente', {
        description: 'Puedes reordenarlo arrastrando desde la lista principal',
      });
      router.push('/admin/paquetes');
    } catch (error) {
      console.error('Error creating paquete:', error);
      toast.error('Error al crear paquete');
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Nueva Excursión</h1>
              <p className="text-gray-600 mt-1">Crea una nueva excursión</p>
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
                            Configura un precio promocional con fecha límite. Al vencer, se muestra automáticamente la tarifa base.
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
                              min={new Date().toISOString().split('T')[0]}
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
                    {destacadosCount >= 9 && destacado && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          <strong>Límite alcanzado:</strong> Ya hay {destacadosCount} excursiones destacadas. Solo se mostrarán las primeras 9 en el inicio.
                        </p>
                      </div>
                    )}
                    {destacadosCount < 9 && destacado && (
                      <p className="text-sm text-green-600 mt-2">
                        {destacadosCount + 1} de 9 destacados
                      </p>
                    )}
                  </div>
                  <Switch
                    id="destacado"
                    checked={destacado}
                    onCheckedChange={(checked) => {
                      if (checked && destacadosCount >= 9) {
                        toast.warning('Ya hay 9 excursiones destacadas', {
                          description: 'Solo se mostrarán los primeros 9 en el inicio (ordenados por número de orden)',
                        });
                      }
                      setValue('destacado', checked);
                    }}
                    className="mt-0.5"
                  />
                </div>

                {/* Gestión de Orden Visual - Solo si está destacado y hay título válido */}
                {destacado ? (
                  watch('titulo') && watch('titulo').length >= 5 ? (
                    <DragDropOrderManager
                      collectionName="paquetes"
                      currentId={undefined}
                      newItemName={watch('titulo')}
                      onPositionChange={setSelectedDestacadoPosition}
                      maxItems={9}
                      onlyDestacados={true}
                      hideSaveButton={true}
                    />
                  ) : (
                    <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700 font-medium">
                        Ingresa un título válido (mínimo 5 caracteres) para gestionar el orden de aparición
                      </p>
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-base text-blue-700 font-medium">
                      Marca la excursión como destacada para gestionar su orden de aparición
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
                  onImagesChange={setImagenTarjetaPreview}
                  maxImages={1}
                  label="Imagen de tarjeta *"
                  description="Se usa en las cards del sitio. Medida recomendada: 1200x900 px."
                />
                <ImageUploader
                  images={imagenPortadaMobilePreview}
                  onImagesChange={setImagenPortadaMobilePreview}
                  maxImages={1}
                  label="Imagen de portada mobile *"
                  description="Se usa en el hero mobile de la excursión. Medida recomendada: 1080x1350 px."
                />
                <ImageUploader
                  images={imagenPortadaDesktopPreview}
                  onImagesChange={setImagenPortadaDesktopPreview}
                  maxImages={1}
                  label="Imagen de portada PC *"
                  description="Se usa en el hero desktop de la excursión. Medida recomendada: 1920x900 px."
                />
                <ImageUploader
                  images={galeriaPreview}
                  onImagesChange={setGaleriaPreview}
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Excursión'
                )}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
