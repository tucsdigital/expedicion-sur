'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import ImageUploader from '@/components/admin/ImageUploader';
import EditableList from '@/components/admin/EditableList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormattedAmountInput } from '@/components/ui/formatted-amount-input';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Calendar, CalendarPlus, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { slugify } from '@/lib/utils/slugify';
import { getExperienciaById, updateExperiencia, type ExperienceInput } from '@/lib/experiencias';
import { revalidateFrontPaths } from '@/lib/revalidate';
import type { Experience, Testimonial, FaqItem, BookingConfig, BookingDate } from '@/components/landing-reserva/types';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { bookingConfigSchema } from '@/lib/schemas/booking';
import BookingCalendarAdmin from '@/components/admin/BookingCalendarAdmin';
import VideoSectionAdmin from '@/components/admin/VideoSectionAdmin';
import { AdminTestimonialsSection } from '@/components/admin/AdminTestimonialsSection';
import { SITE_NAME } from '@/lib/constants';
import { getReservasCountByExperienceAndDate } from '@/lib/reservas';

function formatDateLabelAdmin(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function todayIso(): string {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

const defaultBookingConfig: BookingConfig = {
  enabled: true,
  title: '',
  subtitle1: '',
  subtitle2: '',
  hasSpecificDates: true,
  dates: [],
  depositAmount: 0,
  maxPeoplePerBooking: undefined,
  currency: 'brl',
  paymentMethods: { stripe: true, pix: false },
};

function bookingConfigFromExperience(exp: Experience): BookingConfig {
  const bc = exp.bookingConfig;
  if (bc) {
    const dates = [...(bc.dates || [])].sort((a, b) => a.date.localeCompare(b.date));
    const currency = (bc.currency === 'brl' || bc.currency === 'usd') ? bc.currency : 'ars';
    return {
      enabled: bc.enabled !== false,
      title: (bc.title ?? '').trim(),
      subtitle1: (bc.subtitle1 ?? '').trim(),
      subtitle2: (bc.subtitle2 ?? '').trim(),
      hasSpecificDates: bc.hasSpecificDates !== false,
      dates,
      depositAmount: typeof bc.depositAmount === 'number' ? bc.depositAmount : (exp.price ?? 0),
      maxPeoplePerBooking: typeof bc.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : (typeof exp.maxPeople === 'number' ? exp.maxPeople : undefined),
      currency,
      paymentMethods: {
        stripe: bc.paymentMethods?.stripe !== false,
        pix: bc.paymentMethods?.pix === true,
      },
    };
  }
  const dates: BookingDate[] = (exp.availableDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).map((date) => ({ date, capacity: 1, enabled: true }));
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return {
    enabled: true,
    title: '',
    subtitle1: (exp.calendarIntro ?? '').trim(),
    subtitle2: (exp.reservationMicrocopy ?? '').trim(),
    hasSpecificDates: dates.length > 0,
    dates,
    depositAmount: exp.price ?? 0,
    maxPeoplePerBooking: typeof exp.maxPeople === 'number' ? exp.maxPeople : undefined,
    currency: 'brl',
    paymentMethods: {
      stripe: Array.isArray(exp.paymentMethods) ? exp.paymentMethods.includes('stripe') : true,
      pix: Array.isArray(exp.paymentMethods) ? exp.paymentMethods.includes('pix') : false,
    },
  };
}

const formSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(120),
  subtitle: z.string().max(200).optional().or(z.literal('')),
  supportText: z.string().max(400).optional().or(z.literal('')),
  topNoticeText: z.string().max(120).optional().or(z.literal('')),
  videoOverlayText: z.string().max(120).optional().or(z.literal('')),
  videoUrl: z.string().max(500).optional().or(z.literal('')),
  youtubeVideoUrl: z.string().optional().refine((v) => !v || v.trim() === '' || /^https?:\/\//.test(v), 'URL inválida').or(z.literal('')),
  tiktokVideoId: z.string().max(50).optional().or(z.literal('')),
  midVideoUrl: z.string().max(500).optional().or(z.literal('')),
  midYoutubeVideoUrl: z.string().optional().refine((v) => !v || v.trim() === '' || /^https?:\/\//.test(v), 'URL inválida').or(z.literal('')),
  midTiktokVideoId: z.string().max(50).optional().or(z.literal('')),
  midVideoOverlayText: z.string().max(120).optional().or(z.literal('')),
  galleryIntro: z.string().max(300).optional().or(z.literal('')),
  dividerPhrase: z.string().max(200).optional().or(z.literal('')),
  calendarIntro: z.string().max(300).optional().or(z.literal('')),
  reservationMicrocopy: z.string().max(400).optional().or(z.literal('')),
  price: z.coerce.number().min(0).optional(),
  maxPeople: z.coerce.number().min(1).max(50).optional(),
  orden: z.coerce.number().min(0).optional(),
  visible: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
};

const isDataUrl = (s: string) => s.startsWith('data:');

type ImageAsset = {
  url: string;
  key?: string;
};

export default function EditarExperienciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardImage, setCardImage] = useState<string>('');
  const [cardImageKey, setCardImageKey] = useState<string>('');
  const [originalCardImageKey, setOriginalCardImageKey] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [galleryAssets, setGalleryAssets] = useState<ImageAsset[]>([]);
  const [originalGalleryKeys, setOriginalGalleryKeys] = useState<string[]>([]);
  const [includes, setIncludes] = useState<string[]>([]);
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [forWho, setForWho] = useState<string[]>([]);
  const [notForWho, setNotForWho] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([{ name: '', quote: '', role: '' }]);
  const [faqs, setFaqs] = useState<FaqItem[]>([{ question: '', answer: '' }]);
  const [bookingConfig, setBookingConfig] = useState<BookingConfig>(defaultBookingConfig);
  const [newDateCapacity, setNewDateCapacity] = useState(1);
  const [datesVisibleCount, setDatesVisibleCount] = useState(10);
  const [reservedByDate, setReservedByDate] = useState<Record<string, number>>({});
  const [testimonialLibraryOpen, setTestimonialLibraryOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    getReservasCountByExperienceAndDate(id).then(setReservedByDate);
  }, [id]);

  const updateBookingConfig = (updater: (prev: BookingConfig) => BookingConfig) => {
    setBookingConfig((prev) => {
      const next = updater(prev);
      const dates = [...next.dates].sort((a, b) => a.date.localeCompare(b.date));
      return { ...next, dates };
    });
  };

  const removeBookingDate = (index: number) => {
    updateBookingConfig((prev) => ({
      ...prev,
      dates: prev.dates.filter((_, i) => i !== index),
    }));
  };

  const removeBookingDateByDate = (date: string) => {
    updateBookingConfig((prev) => ({
      ...prev,
      dates: prev.dates.filter((d) => d.date !== date),
    }));
  };

  const addDateRange = (from: string, to: string, capacity: number) => {
    const fromD = new Date(from + 'T12:00:00');
    const toD = new Date(to + 'T12:00:00');
    if (fromD.getTime() > toD.getTime()) {
      toast.error('La fecha "Desde" debe ser anterior a "Hasta".');
      return;
    }
    const existing = new Set(bookingConfig.dates.map((d) => d.date));
    const toAdd: BookingDate[] = [];
    const cur = new Date(fromD);
    while (cur.getTime() <= toD.getTime()) {
      const iso = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      if (!existing.has(iso)) {
        toAdd.push({ date: iso, capacity, enabled: true });
        existing.add(iso);
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (toAdd.length === 0) {
      toast.info('Todas las fechas del rango ya estaban agregadas.');
      return;
    }
    updateBookingConfig((prev) => ({
      ...prev,
      dates: [...prev.dates, ...toAdd],
    }));
    toast.success(`${toAdd.length} fecha${toAdd.length === 1 ? '' : 's'} agregada${toAdd.length === 1 ? '' : 's'}`);
  };

  const handleCardImageChange = (urls: string[]) => {
    const nextUrl = urls[0] ?? '';
    setCardImage(nextUrl);
    if (!nextUrl) {
      setCardImageKey('');
      return;
    }
    if (nextUrl !== cardImage) {
      setCardImageKey('');
    }
  };

  const handleGalleryChange = (newImages: string[]) => {
    setImages(newImages);
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

  const updateBookingDate = (index: number, field: keyof BookingDate, value: string | number | boolean) => {
    updateBookingConfig((prev) => ({
      ...prev,
      dates: prev.dates.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }));
  };

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const title = watch('title');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const exp = await getExperienciaById(id);
        if (!exp) {
          toast.error('Experiencia no encontrada');
          router.push('/admin/experiencias');
          return;
        }
        setValue('title', exp.title);
        setValue('subtitle', exp.subtitle ?? '');
        setValue('supportText', exp.supportText ?? '');
        setValue('topNoticeText', exp.topNoticeText ?? '');
        setValue('videoOverlayText', exp.videoOverlayText ?? '');
        setValue('videoUrl', exp.videoUrl ?? '');
        setValue('youtubeVideoUrl', exp.youtubeVideoUrl ?? '');
        setValue('tiktokVideoId', exp.tiktokVideoId ?? '');
        setValue('midVideoUrl', exp.midVideoUrl ?? '');
        setValue('midYoutubeVideoUrl', exp.midYoutubeVideoUrl ?? '');
        setValue('midTiktokVideoId', exp.midTiktokVideoId ?? '');
        setValue('midVideoOverlayText', exp.midVideoOverlayText ?? '');
        setValue('galleryIntro', exp.galleryIntro ?? '');
        setValue('dividerPhrase', exp.dividerPhrase ?? '');
        setValue('calendarIntro', exp.calendarIntro ?? '');
        setValue('reservationMicrocopy', exp.reservationMicrocopy ?? '');
        setValue('price', exp.price ?? undefined);
        setValue('maxPeople', exp.maxPeople ?? undefined);
        setValue('orden', exp.orden ?? 0);
        setValue('visible', exp.visible !== false);
        const cardUrl = exp.cardImage ?? exp.images?.[0] ?? '';
        const galleryFromExp = exp.cardImage ? exp.images ?? [] : exp.images?.slice(1) ?? [];
        const cardKey = exp.cardImageKey ?? getBlobKeyFromUrl(cardUrl) ?? '';
        const galleryKeys = exp.imageKeys ?? [];

        setCardImage(cardUrl);
        setCardImageKey(cardKey);
        setOriginalCardImageKey(cardKey || null);

        setImages(galleryFromExp);
        setGalleryAssets(
          galleryFromExp.map((url, idx) => ({
            url,
            key: (galleryKeys[idx] || getBlobKeyFromUrl(url)) ?? undefined,
          }))
        );
        setOriginalGalleryKeys(
          galleryFromExp
            .map((url, idx) => (galleryKeys[idx] || getBlobKeyFromUrl(url)) ?? '')
            .filter((key): key is string => Boolean(key))
        );
        setIncludes(exp.includes ?? []);
        setTakeaways(exp.takeaways ?? []);
        setForWho(exp.forWho ?? []);
        setNotForWho(exp.notForWho ?? []);
        setTestimonials(
          (exp.testimonials?.length && exp.testimonials) || [{ name: '', quote: '', role: '' }]
        );
        setFaqs((exp.faqs?.length && exp.faqs) || [{ question: '', answer: '' }]);
        setBookingConfig(bookingConfigFromExperience(exp));
      } catch (err) {
        console.error(err);
        toast.error('Error al cargar experiencia');
        router.push('/admin/experiencias');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router, setValue]);

  const addTestimonial = () => setTestimonials((t) => [...t, { name: '', quote: '', role: '' }]);
  const removeTestimonial = (i: number) => setTestimonials((t) => t.filter((_, j) => j !== i));
  const updateTestimonial = (i: number, field: keyof Testimonial, value: string) => {
    setTestimonials((t) => t.map((item, j) => (j === i ? { ...item, [field]: value } : item)));
  };

  const addFaq = () => setFaqs((f) => [...f, { question: '', answer: '' }]);
  const removeFaq = (i: number) => setFaqs((f) => f.filter((_, j) => j !== i));
  const updateFaq = (i: number, field: 'question' | 'answer', value: string) => {
    setFaqs((f) => f.map((item, j) => (j === i ? { ...item, [field]: value } : item)));
  };

  const onSubmit = async (data: FormData) => {
    if (!cardImage?.trim()) {
      toast.error('Agregá la imagen de tarjeta (obligatoria para las cards del sitio).');
      return;
    }

    const bcToSave = {
      ...bookingConfig,
      title: '',
      subtitle1: bookingConfig.subtitle1.trim(),
      subtitle2: bookingConfig.subtitle2.trim(),
      depositAmount: Math.max(0, bookingConfig.depositAmount),
      ...(typeof bookingConfig.maxPeoplePerBooking === 'number' ? { maxPeoplePerBooking: Math.max(1, Math.min(50, bookingConfig.maxPeoplePerBooking)) } : {}),
      currency: (bookingConfig.currency === 'brl' || bookingConfig.currency === 'usd') ? bookingConfig.currency : 'ars',
    };
    const parsed = bookingConfigSchema.safeParse(bcToSave);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('. ');
      toast.error(msg || 'Revisá la sección Reserva / Calendario.');
      return;
    }
    if (!parsed.data.paymentMethods.stripe && !parsed.data.paymentMethods.pix) {
      toast.error('Elegí qué opciones mostrar en el checkout (al menos una).');
      return;
    }

    setSaving(true);
    try {
      const finalCard = {
        url: cardImage,
        key: cardImageKey || getBlobKeyFromUrl(cardImage) || '',
      };

      if (isDataUrl(cardImage)) {
        toast.info('Subiendo imagen de tarjeta...', { id: 'upload' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(cardImage, `exp-card-${Date.now()}.jpg`),
        ]);
        finalCard.url = result.url;
        finalCard.key = result.key;
        toast.success('Imagen de tarjeta subida', { id: 'upload' });
      }

      let uploadedGalleryResults: { url: string; key: string }[] = [];
      const dataUrlSpecs = galleryAssets
        .map((asset, idx) => ({ asset, idx }))
        .filter(({ asset }) => isDataUrl(asset.url));

      if (dataUrlSpecs.length > 0) {
        toast.info('Subiendo imágenes de galería...', { id: 'upload-gal' });
        const files = dataUrlSpecs.map((spec, idx) =>
          dataURLtoFile(spec.asset.url, `exp-gallery-${Date.now()}-${idx}.jpg`)
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

      const galleryUrls = finalGalleryAssets.map((asset) => asset.url);
      const galleryKeys = finalGalleryAssets.map((asset) => asset.key);

      const keysToDelete: string[] = [];
      if (originalCardImageKey && finalCard.key && originalCardImageKey !== finalCard.key) {
        keysToDelete.push(originalCardImageKey);
      }

      const finalGalleryKeySet = new Set(
        galleryKeys.filter((key): key is string => Boolean(key))
      );

      originalGalleryKeys.forEach((key) => {
        if (key && !finalGalleryKeySet.has(key)) {
          keysToDelete.push(key);
        }
      });

      if (keysToDelete.length > 0) {
        await Promise.allSettled(
          keysToDelete.map((key) =>
            deleteBlobByKey(key).catch((error) => {
              console.error('[experiencias] error borrando blob:', error);
            })
          )
        );
      }

      const payload: Partial<ExperienceInput> = {
        slug: slugify(data.title),
        title: data.title.trim(),
        subtitle: (data.subtitle || '').trim(),
        supportText: (data.supportText || '').trim(),
        topNoticeText: (data.topNoticeText || '').trim(),
        videoOverlayText: (data.videoOverlayText || '').trim(),
        videoUrl: (data.videoUrl || '').trim() || undefined,
        youtubeVideoUrl: (data.youtubeVideoUrl || '').trim(),
        tiktokVideoId: (data.tiktokVideoId || '').trim(),
        midVideoUrl: (data.midVideoUrl || '').trim() || undefined,
        midYoutubeVideoUrl: (data.midYoutubeVideoUrl || '').trim(),
        midTiktokVideoId: (data.midTiktokVideoId || '').trim(),
        midVideoOverlayText: (data.midVideoOverlayText || '').trim() || undefined,
        cardImage: finalCard.url,
        cardImageKey: finalCard.key,
        images: galleryUrls,
        imageKeys: galleryKeys,
        galleryIntro: (data.galleryIntro || '').trim(),
        includes: includes.filter(Boolean),
        takeaways: takeaways.filter(Boolean),
        forWho: forWho.filter(Boolean),
        notForWho: notForWho.filter(Boolean),
        testimonials: testimonials.filter((t) => t.name.trim() || t.quote.trim()),
        dividerPhrase: (data.dividerPhrase || '').trim(),
        calendarIntro: (data.calendarIntro || '').trim(),
        reservationMicrocopy: (data.reservationMicrocopy || '').trim(),
        faqs: faqs.filter((f) => f.question.trim() || f.answer.trim()),
        orden: data.orden ?? 0,
        visible: data.visible,
        bookingConfig: parsed.data,
      };

      await updateExperiencia(id, payload);
      setCardImage(finalCard.url);
      setCardImageKey(finalCard.key);
      setOriginalCardImageKey(finalCard.key || null);
      setGalleryAssets(finalGalleryAssets);
      setImages(galleryUrls);
      setOriginalGalleryKeys(galleryKeys.filter((key): key is string => Boolean(key)));

      const slugNew = slugify(data.title);
      await revalidateFrontPaths(['/experiencias', `/experiencias/${slugNew}`]);
      toast.success('Cambios guardados correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
              <Link href="/admin/experiencias">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Editar experiencia</h1>
              <p className="text-gray-600 mt-1">Modificá los datos de la experiencia</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input {...register('title')} placeholder={`Ej: ${SITE_NAME} en Río de Janeiro`} className="mt-1.5" />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
                </div>
                <div>
                  <Label>Subtítulo</Label>
                  <Input {...register('subtitle')} className="mt-1.5" />
                </div>
                <div>
                  <Label>Texto de apoyo</Label>
                  <Input {...register('supportText')} placeholder="Línea breve debajo del subtítulo" className="mt-1.5" />
                </div>
                <div>
                  <Label>Aviso destacado</Label>
                  <Input {...register('topNoticeText')} placeholder="Ej: Cupos por salida · Guías locales" className="mt-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <Controller
                    name="visible"
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                  <Label>Visible en listado</Label>
                </div>
                <div>
                  <Label>Orden</Label>
                  <Input type="number" {...register('orden')} className="mt-1.5 w-24" />
                </div>
                <div className="mt-6 space-y-3">
                  <Label>Comisión por referido (específica de la excursión)</Label>
                  <p className="text-xs text-gray-500">
                    Si no definís esta comisión, se usará la comisión por defecto del vendedor.
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!bookingConfig.referralCommission}
                        onChange={(e) =>
                          updateBookingConfig((prev) => ({
                            ...prev,
                            referralCommission: e.target.checked
                              ? (prev.referralCommission ?? {
                                  type: 'percent',
                                  value: 10,
                                  currency: prev.currency,
                                })
                              : undefined,
                          }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Definir comisión específica</span>
                    </label>
                  </div>
                  {bookingConfig.referralCommission && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Tipo</Label>
                        <Select
                          value={bookingConfig.referralCommission.type}
                          onValueChange={(v) =>
                            updateBookingConfig((prev) => ({
                              ...prev,
                              referralCommission: { ...prev.referralCommission!, type: v as 'percent' | 'fixed' },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Porcentaje</SelectItem>
                            <SelectItem value="fixed">Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          min={0}
                          value={bookingConfig.referralCommission.value}
                          onChange={(e) =>
                            updateBookingConfig((prev) => ({
                              ...prev,
                              referralCommission: {
                                ...prev.referralCommission!,
                                value: Math.max(0, parseFloat(e.target.value || '0')),
                              },
                            }))
                          }
                        />
                        <p className="text-xs text-gray-500">
                          {bookingConfig.referralCommission.type === 'percent' ? '% sobre venta' : 'monto por persona'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label>Moneda</Label>
                        <Select
                          value={bookingConfig.referralCommission.currency}
                          onValueChange={(v) =>
                            updateBookingConfig((prev) => ({
                              ...prev,
                              referralCommission: { ...prev.referralCommission!, currency: v as 'ars' | 'brl' | 'usd' },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí moneda" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ars">ARS</SelectItem>
                            <SelectItem value="brl">BRL</SelectItem>
                            <SelectItem value="usd">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vídeo</CardTitle>
                <p className="text-sm text-gray-500 font-normal">Video local (drop/URL) o enlace de YouTube, Shorts o TikTok. En el front se reproduce automáticamente con sonido y sin controles.</p>
              </CardHeader>
              <CardContent>
                <VideoSectionAdmin
                  videoUrl={watch('videoUrl') ?? ''}
                  youtubeVideoUrl={watch('youtubeVideoUrl') ?? ''}
                  tiktokVideoId={watch('tiktokVideoId') ?? ''}
                  videoOverlayText={watch('videoOverlayText') ?? ''}
                  onVideoUrlChange={(v) => setValue('videoUrl', v)}
                  onYoutubeVideoUrlChange={(v) => setValue('youtubeVideoUrl', v)}
                  onTiktokVideoIdChange={(v) => setValue('tiktokVideoId', v)}
                  onVideoOverlayTextChange={(v) => setValue('videoOverlayText', v)}
                  youtubeError={errors.youtubeVideoUrl?.message}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vídeo (entre reserva y FAQ)</CardTitle>
                <p className="text-sm text-gray-500 font-normal">Video que se muestra arriba de Preguntas frecuentes. Misma lógica que el del inicio (YouTube, Shorts, TikTok o local).</p>
              </CardHeader>
              <CardContent>
                <VideoSectionAdmin
                  videoUrl={watch('midVideoUrl') ?? ''}
                  youtubeVideoUrl={watch('midYoutubeVideoUrl') ?? ''}
                  tiktokVideoId={watch('midTiktokVideoId') ?? ''}
                  videoOverlayText={watch('midVideoOverlayText') ?? ''}
                  onVideoUrlChange={(v) => setValue('midVideoUrl', v)}
                  onYoutubeVideoUrlChange={(v) => setValue('midYoutubeVideoUrl', v)}
                  onTiktokVideoIdChange={(v) => setValue('midTiktokVideoId', v)}
                  onVideoOverlayTextChange={(v) => setValue('midVideoOverlayText', v)}
                  youtubeError={errors.midYoutubeVideoUrl?.message}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Imágenes de la experiencia</CardTitle>
                <p className="text-sm text-gray-500 font-normal">Imagen de tarjeta para las cards del sitio y galería adicional. No se incluye banner.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ImageUploader
                  images={cardImage ? [cardImage] : []}
                  onImagesChange={handleCardImageChange}
                  maxImages={1}
                  label="Imagen de tarjeta *"
                  description="Se usa en las cards del sitio."
                />
                <ImageUploader
                  images={images}
                  onImagesChange={handleGalleryChange}
                  maxImages={15}
                  label="Galería de imágenes"
                  description="Imágenes adicionales para la galería de la experiencia."
                />
                <div>
                  <Label>Intro galería</Label>
                  <Input {...register('galleryIntro')} className="mt-1.5" placeholder="Texto opcional sobre la galería" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Qué incluye, qué llevás y para quién</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2.5">
                  <Label>Incluye</Label>
                  <EditableList items={includes} onItemsChange={setIncludes} placeholder="Agregar ítem..." />
                </div>
                <div className="space-y-2.5">
                  <Label>Qué llevás</Label>
                  <EditableList items={takeaways} onItemsChange={setTakeaways} placeholder="Agregar ítem..." />
                </div>
                <div className="space-y-2.5">
                  <Label>Para quién es</Label>
                  <EditableList items={forWho} onItemsChange={setForWho} placeholder="Agregar ítem..." />
                </div>
                <div className="space-y-2.5">
                  <Label>Para quién NO es</Label>
                  <EditableList items={notForWho} onItemsChange={setNotForWho} placeholder="Agregar ítem..." />
                </div>
              </CardContent>
            </Card>

            <AdminTestimonialsSection
              testimonials={testimonials}
              onUpdate={updateTestimonial}
              onRemove={removeTestimonial}
              onAdd={addTestimonial}
              libraryOpen={testimonialLibraryOpen}
              onLibraryOpenChange={setTestimonialLibraryOpen}
              onAddFromLibrary={(toAdd) => {
                setTestimonials((prev) => [...prev, ...toAdd]);
                toast.success(`${toAdd.length} testimonio${toAdd.length !== 1 ? 's' : ''} agregado${toAdd.length !== 1 ? 's' : ''}`);
                setTestimonialLibraryOpen(false);
              }}
            />

            <Card>
              <CardHeader>
                <CardTitle>Reserva / Calendario</CardTitle>
                <p className="text-sm text-gray-500 font-normal">Textos del bloque, fechas con cupos, precio de seña y métodos de pago.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Primera línea del bloque</Label>
                  <Input
                    value={bookingConfig.subtitle1}
                    onChange={(e) => updateBookingConfig((prev) => ({ ...prev, subtitle1: e.target.value.trim() }))}
                    placeholder="Elegí tu fecha ideal..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Segunda línea del bloque</Label>
                  <Input
                    value={bookingConfig.subtitle2}
                    onChange={(e) => updateBookingConfig((prev) => ({ ...prev, subtitle2: e.target.value.trim() }))}
                    placeholder="Pago seguro..."
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={!bookingConfig.hasSpecificDates}
                    onCheckedChange={(checked) => updateBookingConfig((prev) => ({ ...prev, hasSpecificDates: !checked }))}
                  />
                  <Label>Sin fechas específicas</Label>
                </div>
                <p className="text-xs text-gray-500 -mt-2">Si está activo, no se obliga a elegir fecha; se coordina después.</p>

                {bookingConfig.hasSpecificDates && (
                  <>
                    <BookingCalendarAdmin
                      dates={bookingConfig.dates}
                      defaultCapacity={newDateCapacity}
                      onAddDate={(date, capacity) => {
                        if (bookingConfig.dates.some((d) => d.date === date)) return;
                        updateBookingConfig((prev) => ({
                          ...prev,
                          dates: [...prev.dates, { date, capacity, enabled: true }],
                        }));
                        toast.success('Fecha agregada');
                      }}
                      onRemoveDate={(date) => {
                        removeBookingDateByDate(date);
                        toast.success('Fecha quitada');
                      }}
                      onAddRange={addDateRange}
                      minDate={todayIso()}
                    />

                    {bookingConfig.dates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 py-10 text-center">
                        <Calendar className="h-12 w-12 text-gray-400 mb-3" strokeWidth={1.2} />
                        <p className="text-sm font-medium text-gray-600">Aún no hay fechas</p>
                        <p className="mt-1 text-xs text-gray-500 max-w-[260px]">Agregá al menos una fecha con cupos para que los usuarios puedan reservar.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          {bookingConfig.dates.length} {bookingConfig.dates.length === 1 ? 'fecha' : 'fechas'} configurada{bookingConfig.dates.length === 1 ? '' : 's'}
                          {bookingConfig.dates.length > 10 && (
                            <span className="ml-1.5 font-normal text-gray-500">
                              (mostrando {Math.min(datesVisibleCount, bookingConfig.dates.length)})
                            </span>
                          )}
                        </p>
                        <ul className="space-y-2">
                          {bookingConfig.dates.slice(0, datesVisibleCount).map((d, i) => (
                            <li
                              key={`${d.date}-${i}`}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 sm:flex-nowrap"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Calendar className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium capitalize text-gray-900">{formatDateLabelAdmin(d.date)}</p>
                                  <p className="text-xs text-gray-500">{d.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-gray-500 whitespace-nowrap">Cupos</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={d.capacity}
                                    onChange={(e) => updateBookingDate(i, 'capacity', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="h-9 w-20 text-center"
                                  />
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Reservados:</span>
                                  <span className="font-medium text-gray-900">{reservedByDate[d.date] ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Disponibles:</span>
                                  <span className="font-medium text-primary">{Math.max(0, d.capacity - (reservedByDate[d.date] ?? 0))}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-gray-500 whitespace-nowrap">Activa</Label>
                                  <Switch
                                    checked={d.enabled}
                                    onCheckedChange={(checked) => updateBookingDate(i, 'enabled', checked)}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBookingDate(i)}
                                  aria-label="Eliminar fecha"
                                  className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {bookingConfig.dates.length > 10 && (
                          <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {datesVisibleCount < bookingConfig.dates.length && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDatesVisibleCount((prev) => Math.min(prev + 10, bookingConfig.dates.length))}
                                className="gap-1.5"
                              >
                                <ChevronDown className="h-4 w-4" />
                                Ver más ({bookingConfig.dates.length - datesVisibleCount} restantes)
                              </Button>
                            )}
                            {datesVisibleCount > 10 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDatesVisibleCount(10)}
                                className="gap-1.5 text-gray-600"
                              >
                                <ChevronUp className="h-4 w-4" />
                                Ver menos
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-end gap-6">
                  <div className="flex flex-col gap-1.5">
                    <Label>Precio de reserva / seña</Label>
                    <FormattedAmountInput
                      value={bookingConfig.depositAmount ?? 0}
                      onChange={(v) => updateBookingConfig((prev) => ({ ...prev, depositAmount: v }))}
                      placeholder="120.000"
                      className="h-10 w-40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Moneda</Label>
                    <Select
                      value={bookingConfig.currency ?? 'brl'}
                      onValueChange={(v:  'brl' | 'usd' | 'ars') => updateBookingConfig((prev) => ({ ...prev, currency: v }))}
                    >
                      <SelectTrigger className="h-10 w-[140px]">
                        <SelectValue placeholder="Moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brl">BRL (Reales)</SelectItem>
                        <SelectItem value="ars">ARS (Pesos)</SelectItem>
                        <SelectItem value="usd">USD (Dólares)</SelectItem>
                      </SelectContent>
                    </Select>

                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Cupos máximos por compra</Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {typeof bookingConfig.maxPeoplePerBooking === 'number'
                          ? 'Se muestra &quot;Máximo X personas&quot; en el front y se limita la cantidad.'
                          : 'Sin límite: no se muestra máximo; el usuario puede elegir hasta 50.'}
                      </p>
                    </div>
                    <Switch
                      checked={typeof bookingConfig.maxPeoplePerBooking === 'number'}
                      onCheckedChange={(checked) =>
                        updateBookingConfig((prev) => ({
                          ...prev,
                          maxPeoplePerBooking: checked ? (prev.maxPeoplePerBooking ?? 10) : undefined,
                        }))
                      }
                    />
                  </div>
                  {typeof bookingConfig.maxPeoplePerBooking === 'number' && (
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-gray-500 shrink-0">Máximo</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={bookingConfig.maxPeoplePerBooking}
                        onChange={(e) =>
                          updateBookingConfig((prev) => ({
                            ...prev,
                            maxPeoplePerBooking: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)),
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-gray-500">personas por compra</span>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Métodos de pago</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">Elegí qué opciones mostrar en el checkout (al menos una)</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingConfig.paymentMethods.stripe}
                        onChange={() => updateBookingConfig((prev) => ({
                          ...prev,
                          paymentMethods: { ...prev.paymentMethods, stripe: !prev.paymentMethods.stripe },
                        }))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Stripe (tarjeta)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingConfig.paymentMethods.pix}
                        onChange={() => updateBookingConfig((prev) => ({
                          ...prev,
                          paymentMethods: { ...prev.paymentMethods, pix: !prev.paymentMethods.pix },
                        }))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">PIX</span>
                    </label>
                  </div>
                  {!bookingConfig.paymentMethods.stripe && !bookingConfig.paymentMethods.pix && (
                    <p className="text-sm text-red-500 mt-1">Elegí qué opciones mostrar en el checkout (al menos una)</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preguntas frecuentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {faqs.map((f, i) => (
                  <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50/50">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Pregunta"
                        value={f.question}
                        onChange={(e) => updateFaq(i, 'question', e.target.value)}
                      />
                      <Input
                        placeholder="Respuesta"
                        value={f.answer}
                        onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFaq(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addFaq}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar FAQ
                </Button>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar cambios
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/experiencias">Cancelar</Link>
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
