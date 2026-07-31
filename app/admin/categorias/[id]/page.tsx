'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { revalidateFrontPaths } from '@/lib/revalidate';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { Categoria } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { slugify } from '@/lib/utils/slugify';
import ImageUploader from '@/components/admin/ImageUploader';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  destacada: z.boolean(),
  activa: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const destacada = watch('destacada');
  const activa = watch('activa');

  useEffect(() => {
    const fetchCategoria = async () => {
      try {
        const docRef = doc(db, 'categorias', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Categoria;
          setValue('nombre', data.nombre);
          setValue('descripcion', data.descripcion);
          setValue('destacada', data.destacada);
          setValue('activa', data.activa);
          const tarjeta = data.imagenTarjeta || data.imagen || '';
          const portadaMobile = data.imagenPortadaMobile || data.imagen || tarjeta;
          const portadaDesktop = data.imagenPortadaDesktop || data.imagen || tarjeta;

          setImagenTarjetaOriginal(tarjeta);
          setImagenTarjetaPreview(tarjeta ? [tarjeta] : []);
          const derivedTarjetaKey = data.imagenTarjetaKey ?? data.imagenKey ?? getBlobKeyFromUrl(tarjeta);
          setImagenTarjetaKey(derivedTarjetaKey ?? '');
          setOriginalImagenTarjetaKey(derivedTarjetaKey ?? null);

          setImagenPortadaMobileOriginal(portadaMobile);
          setImagenPortadaMobilePreview(portadaMobile ? [portadaMobile] : []);
          const derivedPortadaMobileKey =
            data.imagenPortadaMobileKey ?? getBlobKeyFromUrl(portadaMobile);
          setImagenPortadaMobileKey(derivedPortadaMobileKey ?? '');
          setOriginalImagenPortadaMobileKey(derivedPortadaMobileKey ?? null);

          setImagenPortadaDesktopOriginal(portadaDesktop);
          setImagenPortadaDesktopPreview(portadaDesktop ? [portadaDesktop] : []);
          const derivedPortadaDesktopKey =
            data.imagenPortadaDesktopKey ?? getBlobKeyFromUrl(portadaDesktop);
          setImagenPortadaDesktopKey(derivedPortadaDesktopKey ?? '');
          setOriginalImagenPortadaDesktopKey(derivedPortadaDesktopKey ?? null);
        } else {
          toast.error('Categoría no encontrada');
          router.push('/admin/categorias');
        }
      } catch (error) {
        console.error('Error fetching categoria:', error);
        toast.error('Error al cargar categoría');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoria();
  }, [id, router, setValue]);

  const onSubmit = async (data: FormData) => {
    if (
      imagenTarjetaPreview.length === 0 ||
      imagenPortadaMobilePreview.length === 0 ||
      imagenPortadaDesktopPreview.length === 0
    ) {
      toast.error('Debes cargar imagen de tarjeta, portada mobile y portada PC');
      return;
    }

    setSaving(true);
    try {
      const isDataUrl = (value: string) => value.startsWith('data:');
      const currentTarjeta = imagenTarjetaPreview[0] ?? '';
      const currentPortadaMobile = imagenPortadaMobilePreview[0] ?? '';
      const currentPortadaDesktop = imagenPortadaDesktopPreview[0] ?? '';

      const finalTarjeta = {
        url: currentTarjeta,
        key: imagenTarjetaKey || getBlobKeyFromUrl(currentTarjeta) || '',
      };
      if (isDataUrl(currentTarjeta)) {
        toast.info('Subiendo imagen de tarjeta...', { id: 'upload-card' });
        const [uploaded] = await uploadMultipleImages([
          new File([await (await fetch(currentTarjeta)).blob()], `categoria-card-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        ]);
        finalTarjeta.url = uploaded.url;
        finalTarjeta.key = uploaded.key;
        toast.success('Imagen de tarjeta actualizada', { id: 'upload-card' });
      }

      const finalPortadaMobile = {
        url: currentPortadaMobile,
        key: imagenPortadaMobileKey || getBlobKeyFromUrl(currentPortadaMobile) || '',
      };
      if (isDataUrl(currentPortadaMobile)) {
        toast.info('Subiendo portada mobile...', { id: 'upload-mobile' });
        const [uploaded] = await uploadMultipleImages([
          new File([await (await fetch(currentPortadaMobile)).blob()], `categoria-cover-mobile-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        ]);
        finalPortadaMobile.url = uploaded.url;
        finalPortadaMobile.key = uploaded.key;
        toast.success('Portada mobile actualizada', { id: 'upload-mobile' });
      }

      const finalPortadaDesktop = {
        url: currentPortadaDesktop,
        key: imagenPortadaDesktopKey || getBlobKeyFromUrl(currentPortadaDesktop) || '',
      };
      if (isDataUrl(currentPortadaDesktop)) {
        toast.info('Subiendo portada PC...', { id: 'upload-desktop' });
        const [uploaded] = await uploadMultipleImages([
          new File([await (await fetch(currentPortadaDesktop)).blob()], `categoria-cover-desktop-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        ]);
        finalPortadaDesktop.url = uploaded.url;
        finalPortadaDesktop.key = uploaded.key;
        toast.success('Portada PC actualizada', { id: 'upload-desktop' });
      }

      const keysToDelete = new Set<string>();
      if (originalImagenTarjetaKey && finalTarjeta.key && originalImagenTarjetaKey !== finalTarjeta.key) {
        keysToDelete.add(originalImagenTarjetaKey);
      }
      if (
        originalImagenPortadaMobileKey &&
        finalPortadaMobile.key &&
        originalImagenPortadaMobileKey !== finalPortadaMobile.key
      ) {
        keysToDelete.add(originalImagenPortadaMobileKey);
      }
      if (
        originalImagenPortadaDesktopKey &&
        finalPortadaDesktop.key &&
        originalImagenPortadaDesktopKey !== finalPortadaDesktop.key
      ) {
        keysToDelete.add(originalImagenPortadaDesktopKey);
      }

      if (keysToDelete.size > 0) {
        await Promise.allSettled(Array.from(keysToDelete).map((key) => deleteBlobByKey(key)));
      }

      const slug = slugify(data.nombre);

      await updateDoc(doc(db, 'categorias', id), {
        nombre: data.nombre,
        slug,
        descripcion: data.descripcion,
        destacada: data.destacada,
        activa: data.activa,
        imagen: finalTarjeta.url,
        imagenKey: finalTarjeta.key || undefined,
        imagenTarjeta: finalTarjeta.url,
        imagenTarjetaKey: finalTarjeta.key || undefined,
        imagenPortadaMobile: finalPortadaMobile.url,
        imagenPortadaMobileKey: finalPortadaMobile.key || undefined,
        imagenPortadaDesktop: finalPortadaDesktop.url,
        imagenPortadaDesktopKey: finalPortadaDesktop.key || undefined,
      });
      await revalidateFrontPaths(['/paquetes', `/categoria/${slug}`]);

      toast.success('Categoría actualizada correctamente');
      router.push('/admin/categorias');
    } catch (error) {
      console.error('Error updating categoria:', error);
      toast.error('Error al actualizar categoría');
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
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/categorias">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Editar Categoría</h1>
              <p className="text-gray-600 mt-1">Modifica la información de la categoría</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Información de la Categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    {...register('nombre')}
                    placeholder="Ej: Europa"
                    className="mt-1.5"
                  />
                  {errors.nombre && (
                    <p className="text-base text-red-500 mt-1">{errors.nombre.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="descripcion">Descripción *</Label>
                  <Textarea
                    id="descripcion"
                    {...register('descripcion')}
                    placeholder="Describe esta categoría..."
                    rows={4}
                    className="mt-1.5"
                  />
                  {errors.descripcion && (
                    <p className="text-base text-red-500 mt-1">{errors.descripcion.message}</p>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Gestión de Orden Visual */}
            <DragDropOrderManager
              collectionName="categorias"
              currentId={id}
            />

            {/* Imágenes */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Imágenes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ImageUploader
                  images={imagenPortadaMobilePreview}
                  onImagesChange={setImagenPortadaMobilePreview}
                  maxImages={1}
                  label="Imagen de portada mobile *"
                  description="Se usa en el hero mobile de la categoría. Medida recomendada: 1080x1350 px."
                />
                {imagenPortadaMobilePreview.length === 0 && (
                  <p className="text-sm text-amber-600 mt-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    La imagen de portada mobile es obligatoria
                  </p>
                )}

                <ImageUploader
                  images={imagenPortadaDesktopPreview}
                  onImagesChange={setImagenPortadaDesktopPreview}
                  maxImages={1}
                  label="Imagen de portada PC *"
                  description="Se usa en el hero desktop de la categoría. Medida recomendada: 1920x900 px."
                />
                {imagenPortadaDesktopPreview.length === 0 && (
                  <p className="text-sm text-amber-600 mt-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    La imagen de portada PC es obligatoria
                  </p>
                )}

                <ImageUploader
                  images={imagenTarjetaPreview}
                  onImagesChange={setImagenTarjetaPreview}
                  maxImages={1}
                  label="Imagen de tarjeta *"
                  description="Se usa en cards y listados. Medida recomendada: 1200x900 px."
                />
                {imagenTarjetaPreview.length === 0 && (
                  <p className="text-sm text-amber-600 mt-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    La imagen de tarjeta es obligatoria
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Configuración y Visibilidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="destacada" className="text-lg font-medium cursor-pointer">Categoría destacada</Label>
                    <p className="text-sm text-gray-500 pr-4">
                      Aparecerá en la sección destacados de la homepage
                    </p>
                  </div>
                  <Switch
                    id="destacada"
                    checked={destacada}
                    onCheckedChange={(checked) => setValue('destacada', checked)}
                    className="mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="activa" className="text-lg font-medium cursor-pointer">Categoría activa</Label>
                    <p className="text-sm text-gray-500 pr-4">
                      Visible para los usuarios en el sitio web
                    </p>
                  </div>
                  <Switch
                    id="activa"
                    checked={activa}
                    onCheckedChange={(checked) => setValue('activa', checked)}
                    className="mt-0.5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" asChild size="lg">
                <Link href="/admin/categorias">Cancelar</Link>
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

