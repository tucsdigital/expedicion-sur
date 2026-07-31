'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { slugify } from '@/lib/utils/slugify';
import { revalidateFrontPaths } from '@/lib/revalidate';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';
import { BlogPost } from '@/types';

const formSchema = z.object({
  titulo: z
    .string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(120, 'El título no puede exceder 120 caracteres'),
  extracto: z
    .string()
    .min(10, 'El extracto debe tener al menos 10 caracteres')
    .max(200, 'El extracto no puede exceder 200 caracteres'),
  contenido: z.string().min(20, 'El contenido debe tener al menos 20 caracteres'),
  visible: z.boolean(),
  destacado: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function EditarBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [imagenTarjeta, setImagenTarjeta] = useState<string[]>([]);
  const [imagenPortada, setImagenPortada] = useState<string[]>([]);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const tituloActual = watch('titulo');

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, 'blog', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          toast.error('Entrada no encontrada');
          router.push('/admin/blog');
          return;
        }

        const data = docSnap.data() as BlogPost;
        reset({
          titulo: data.titulo,
          extracto: data.extracto,
          contenido: data.contenido,
          visible: data.visible,
          destacado: data.destacado,
        });
        setImagenTarjeta(
          data.imagenTarjeta
            ? [data.imagenTarjeta]
            : data.imagenPrincipal
            ? [data.imagenPrincipal]
            : []
        );
        setImagenPortada(
          data.imagenPortada
            ? [data.imagenPortada]
            : data.imagenPrincipal
            ? [data.imagenPrincipal]
            : []
        );
      } catch (error) {
        console.error('Error fetching post:', error);
        toast.error('Error al cargar la entrada');
      }
    };

    fetchPost();
  }, [id, reset, router]);

  const onSubmit = async (data: FormData) => {
    if (imagenTarjeta.length === 0 || imagenPortada.length === 0) {
      toast.error('Debes subir una imagen de tarjeta y una de portada');
      return;
    }

    setLoading(true);
    try {
      const slug = slugify(data.titulo);
      const isDataUrl = (value: string) => value.startsWith('data:');
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

      const existingCardUrls = imagenTarjeta.filter((item) => !isDataUrl(item));
      const cardFiles = imagenTarjeta
        .filter(isDataUrl)
        .map((preview, index) => dataURLtoFile(preview, `blog-card-${Date.now()}-${index}.jpg`));

      const existingCoverUrls = imagenPortada.filter((item) => !isDataUrl(item));
      const coverFiles = imagenPortada
        .filter(isDataUrl)
        .map((preview, index) => dataURLtoFile(preview, `blog-cover-${Date.now()}-${index}.jpg`));

      const uploadedCardResults = cardFiles.length > 0 ? await uploadMultipleImages(cardFiles) : [];
      const uploadedCoverResults = coverFiles.length > 0 ? await uploadMultipleImages(coverFiles) : [];
      const uploadedCardUrls = uploadedCardResults.map((result) => result.url);
      const uploadedCoverUrls = uploadedCoverResults.map((result) => result.url);
      const imagenTarjetaUrl = uploadedCardUrls[0] || existingCardUrls[0] || '';
      const imagenPortadaUrl = uploadedCoverUrls[0] || existingCoverUrls[0] || '';

      await updateDoc(doc(db, 'blog', id), {
        titulo: data.titulo.trim(),
        slug,
        extracto: data.extracto.trim(),
        contenido: data.contenido,
        imagenTarjeta: imagenTarjetaUrl,
        imagenPortada: imagenPortadaUrl,
        imagenPrincipal: imagenTarjetaUrl,
        visible: Boolean(data.visible),
        destacado: Boolean(data.destacado),
      });
      await revalidateFrontPaths(['/blog', `/blog/${slug}`]);

      toast.success('✅ Entrada actualizada');
      router.push('/admin/blog');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Error al actualizar la entrada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Editar entrada</h1>
              <p className="text-gray-600">Actualizá la información del blog</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contenido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="titulo">Título</Label>
                    <Input id="titulo" {...register('titulo')} />
                    {errors.titulo && <p className="text-sm text-red-500">{errors.titulo.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="extracto">Extracto</Label>
                    <Input id="extracto" {...register('extracto')} />
                    {errors.extracto && <p className="text-sm text-red-500">{errors.extracto.message}</p>}
                  </div>
                  <div>
                    <Label>Contenido</Label>
                    <Controller
                      name="contenido"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor content={field.value} onChange={field.onChange} />
                      )}
                    />
                    {errors.contenido && <p className="text-sm text-red-500">{errors.contenido.message}</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Imágenes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ImageUploader
                    images={imagenTarjeta}
                    onImagesChange={setImagenTarjeta}
                    maxImages={1}
                    label="Imagen de tarjeta"
                    description="Se usa en las cards del blog."
                  />
                  <ImageUploader
                    images={imagenPortada}
                    onImagesChange={setImagenPortada}
                    maxImages={1}
                    label="Imagen de portada"
                    description="Se usa en la portada del artículo."
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Publicación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Visible</Label>
                    <Controller
                      name="visible"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Destacado</Label>
                    <Controller
                      name="destacado"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <DragDropOrderManager
                collectionName="blog"
                currentId={id}
                newItemName={tituloActual || 'Entrada'}
              />
            </div>
          </div>

          <Button type="submit" className="bg-black hover:bg-gray-800 text-white" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </form>
      </AdminLayout>
    </ProtectedRoute>
  );
}
