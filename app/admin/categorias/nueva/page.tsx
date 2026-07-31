'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, Timestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
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
import { revalidateFrontPaths } from '@/lib/revalidate';
import ImageUploader from '@/components/admin/ImageUploader';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  destacada: z.boolean(),
  activa: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function NuevaCategoriaPage() {
  const [loading, setLoading] = useState(false);
  const [imagenTarjetaPreview, setImagenTarjetaPreview] = useState<string[]>([]);
  const [imagenPortadaMobilePreview, setImagenPortadaMobilePreview] = useState<string[]>([]);
  const [imagenPortadaDesktopPreview, setImagenPortadaDesktopPreview] = useState<string[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destacada: true,
      activa: true,
    },
  });

  const destacada = watch('destacada');
  const activa = watch('activa');

  const dataURLtoFile = async (dataUrl: string, filename: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  const onSubmit = async (data: FormData) => {
    if (
      imagenTarjetaPreview.length === 0 ||
      imagenPortadaMobilePreview.length === 0 ||
      imagenPortadaDesktopPreview.length === 0
    ) {
      toast.error('Debes cargar imagen de tarjeta, portada mobile y portada PC');
      return;
    }

    setLoading(true);
    try {
      toast.info('Subiendo imágenes...', { id: 'upload' });
      const [tarjetaFile, portadaMobileFile, portadaDesktopFile] = await Promise.all([
        dataURLtoFile(imagenTarjetaPreview[0], `categoria-card-${Date.now()}.jpg`),
        dataURLtoFile(imagenPortadaMobilePreview[0], `categoria-cover-mobile-${Date.now()}.jpg`),
        dataURLtoFile(imagenPortadaDesktopPreview[0], `categoria-cover-desktop-${Date.now()}.jpg`),
      ]);
      const [[imagenTarjeta], [imagenPortadaMobile], [imagenPortadaDesktop]] = await Promise.all([
        uploadMultipleImages([tarjetaFile]),
        uploadMultipleImages([portadaMobileFile]),
        uploadMultipleImages([portadaDesktopFile]),
      ]);
      toast.success('Imágenes subidas correctamente', { id: 'upload' });

      const slug = slugify(data.nombre);

      // Determinar el orden a usar
      let nuevoOrden: number;
      
      if (selectedPosition !== null) {
        // Usar posición elegida por el usuario
        nuevoOrden = selectedPosition;
        
        // Actualizar órdenes existentes
        const categoriasSnapshot = await getDocs(collection(db, 'categorias'));
        const categoriasData = categoriasSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as { id: string; orden: number }));
        
        const batch = writeBatch(db);
        
        categoriasData.forEach((categoria) => {
          if (categoria.orden >= nuevoOrden) {
            batch.update(doc(db, 'categorias', categoria.id), {
              orden: categoria.orden + 1
            });
          }
        });
        
        await batch.commit();
      } else {
        // Orden por defecto (al final)
        const categoriasSnapshot = await getDocs(collection(db, 'categorias'));
        const maxOrden = categoriasSnapshot.docs.length > 0 
          ? Math.max(...categoriasSnapshot.docs.map(doc => (doc.data().orden || 0))) 
          : 0;
        nuevoOrden = maxOrden + 1;
      }

      await addDoc(collection(db, 'categorias'), {
        nombre: data.nombre,
        slug,
        descripcion: data.descripcion,
        orden: nuevoOrden, // Usar la posición elegida
        destacada: data.destacada,
        activa: data.activa,
        imagen: imagenTarjeta.url,
        imagenKey: imagenTarjeta.key || undefined,
        imagenTarjeta: imagenTarjeta.url,
        imagenTarjetaKey: imagenTarjeta.key || undefined,
        imagenPortadaMobile: imagenPortadaMobile.url,
        imagenPortadaMobileKey: imagenPortadaMobile.key || undefined,
        imagenPortadaDesktop: imagenPortadaDesktop.url,
        imagenPortadaDesktopKey: imagenPortadaDesktop.key || undefined,
        fechaCreacion: Timestamp.now(),
      });
      await revalidateFrontPaths(['/paquetes', `/categoria/${slug}`]);

      toast.success('✅ Categoría creada correctamente', {
        description: 'Puedes reordenarla arrastrando desde la lista principal',
      });
      router.push('/admin/categorias');
    } catch (error) {
      console.error('Error creating categoria:', error);
      toast.error('Error al crear categoría');
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Nueva Categoría</h1>
              <p className="text-gray-600 mt-1">Crea una nueva categoría de viajes</p>
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

            {/* Gestión de Orden Visual - Solo se muestra si hay nombre válido */}
            {watch('nombre') && watch('nombre').length >= 2 && (
              <DragDropOrderManager
                collectionName="categorias"
                currentId={undefined}
                newItemName={watch('nombre')}
                onPositionChange={setSelectedPosition}
                hideSaveButton={true}
              />
            )}

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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Categoría'
                )}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
