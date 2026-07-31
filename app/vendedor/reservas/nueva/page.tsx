'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { Experience } from '@/components/landing-reserva/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SITE_NAME } from '@/lib/constants';

type FormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCountry: string;
  customerDocument: string;
  customerComments: string;
};

const DEFAULT_FORM_STATE: FormState = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerCountry: '',
  customerDocument: '',
  customerComments: '',
};

export default function VendorNuevaReservaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [experiencias, setExperiencias] = useState<Experience[]>([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>('');
  const [date, setDate] = useState<string>('sin-fecha');
  const [people, setPeople] = useState(1);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.email) return;
      setLoading(true);
      try {
        const vq = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
        const vs = await getDocs(vq);
        const v = vs.docs[0];
        if (!v) {
          toast.error('No se encontró tu perfil de vendedor');
          return;
        }
        setVendorId(v.id);
        const vendorData = v.data() as any;
        const allowed: string[] | null = Array.isArray(vendorData?.allowedExperiences)
          ? (vendorData.allowedExperiences as string[])
          : null;
        const expSnap = await getDocs(collection(db, 'experiencias'));
        const all = expSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .map(
            (e: any) =>
              ({
                id: e.id,
                slug: String(e.slug ?? ''),
                title: String(e.title ?? ''),
                subtitle: String(e.subtitle ?? ''),
                supportText: String(e.supportText ?? ''),
                topNoticeText: String(e.topNoticeText ?? ''),
                videoOverlayText: String(e.videoOverlayText ?? ''),
                bookingConfig: e.bookingConfig,
                maxPeople: e.maxPeople,
              }) as Experience
          )
          .filter((e) => e.title && e.slug);
        const filtered =
          Array.isArray(allowed) && allowed.length > 0
            ? all.filter((e) => allowed.includes(e.id))
            : all;
        filtered.sort((a, b) => a.title.localeCompare(b.title, 'es'));
        setExperiencias(filtered);
        if (filtered[0]) setSelectedExperienceId(filtered[0].id);
      } catch (error) {
        console.error('[VendorNuevaReserva] Error cargando datos:', error);
        toast.error('No pudimos cargar los datos para crear la reserva');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const selectedExperience = useMemo(
    () => experiencias.find((item) => item.id === selectedExperienceId) ?? null,
    [experiencias, selectedExperienceId]
  );

  const availableDates = useMemo<string[]>(() => {
    if (!selectedExperience?.bookingConfig?.hasSpecificDates) return [];
    return (
      selectedExperience.bookingConfig?.dates
        ?.filter((d) => d.enabled && !!d.date)
        .map((d) => d.date)
        .sort((a, b) => a.localeCompare(b)) ?? []
    );
  }, [selectedExperience]);

  useEffect(() => {
    if (availableDates.length > 0) {
      setDate((prev) => (availableDates.includes(prev) ? prev : availableDates[0]));
    } else if (date !== 'sin-fecha') {
      setDate('sin-fecha');
    }
  }, [availableDates, date]);

  const formattedDateLabel = useMemo(() => {
    if (!date || date === 'sin-fecha') return 'Sin fecha específica';
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }, [date]);

  const currency = (selectedExperience?.bookingConfig?.currency ?? 'ars').toUpperCase();
  const unitPrice = useMemo(() => {
    const bcPrice = selectedExperience?.bookingConfig?.depositAmount;
    if (typeof bcPrice === 'number' && bcPrice > 0) return bcPrice;
    const legacy = (selectedExperience as any)?.price;
    if (typeof legacy === 'number' && legacy > 0) return legacy;
    return 0;
  }, [selectedExperience]);
  const unitAmount = useMemo(() => (unitPrice > 0 ? Math.round(unitPrice * 100) : 0), [unitPrice]);
  const amountTotal = useMemo(() => unitAmount * Math.max(1, people), [unitAmount, people]);
  const amountLabel = useMemo(() => {
    const value = amountTotal / 100;
    if (currency === 'ARS') return `$${value.toLocaleString('es-AR')}`;
    if (currency === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
    if (currency === 'USD') return `USD ${value.toLocaleString('en-US')}`;
    return `${value.toFixed(2)} ${currency}`;
  }, [amountTotal, currency]);

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedExperience) {
      toast.error('Seleccioná una experiencia antes de continuar');
      return;
    }
    if (!user) {
      toast.error('Debes iniciar sesión para crear la reserva');
      return;
    }
    if (!vendorId) {
      toast.error('No se encontró tu perfil de vendedor');
      return;
    }
    if (!form.customerEmail || !form.customerName) {
      toast.error('Completa nombre y email del cliente');
      return;
    }
    if (people < 1) {
      toast.error('La reserva debe incluir al menos una persona');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/vendor/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          experienceId: selectedExperience.id,
          date,
          people,
          customerEmail: form.customerEmail,
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          customerCountry: form.customerCountry || undefined,
          customerDocument: form.customerDocument || undefined,
          customerComments: form.customerComments || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? 'No se pudo crear la reserva');
      }

      const payload = await response.json();
      toast.success('Reserva creada exitosamente');
      router.push(`/admin/reservas/${payload.id}`);
    } catch (error) {
      console.error('[VendorNuevaReserva] Error creando reserva:', error);
      toast.error('No pudimos crear la reserva, revisá los datos e intentá otra vez');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6 pb-10">
          <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-success-strong">
                Solo para tu usuario
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">Crear reserva manual</h1>
              <p className="mt-1 text-sm text-gray-600">
                Las reservas que generes acá quedarán asociadas automáticamente a tus comisiones.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {selectedExperience ? 'Experiencia disponible' : 'Elegí una experiencia'}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : experiencias.length === 0 ? (
            <Card className="mx-auto max-w-xl border border-dashed border-gray-200 bg-white/80 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  No tenés experiencias asignadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-600">
                <p>
                  Consultá con el equipo de {SITE_NAME} para que te habiliten experiencias para crear
                  reservas manuales.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="space-y-6 bg-white/90 shadow-2xl">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Datos de la reserva
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Se calculan automáticamente precio, moneda y auditoría según la experiencia
                    elegida.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Experiencia</Label>
                        <Select
                          value={selectedExperienceId}
                          onValueChange={setSelectedExperienceId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí una experiencia" />
                          </SelectTrigger>
                          <SelectContent>
                            {experiencias.map((exp) => (
                              <SelectItem key={exp.id} value={exp.id}>
                                {exp.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Fecha de excursión</Label>
                        {availableDates.length > 0 ? (
                          <Select value={date} onValueChange={setDate}>
                            <SelectTrigger>
                              <SelectValue placeholder="Elegí una fecha" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDates.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type="text"
                            value="Sin fechas específicas (a coordinar)"
                            readOnly
                            className="bg-gray-50 text-gray-500"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Cantidad de personas</Label>
                        <Input
                          type="number"
                          min={1}
                          value={people}
                          onChange={(e) =>
                            setPeople(Math.max(1, Number.parseInt(e.target.value || '1', 10)))
                          }
                        />
                        <p className="text-xs text-gray-500">
                          Precio estimado: {unitPrice > 0 ? amountLabel : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Nombre del cliente</Label>
                        <Input
                          value={form.customerName}
                          onChange={(e) => handleFormChange('customerName', e.target.value)}
                          placeholder="Nombre y apellido"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Email del cliente</Label>
                        <Input
                          type="email"
                          value={form.customerEmail}
                          onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                          placeholder="cliente@ejemplo.com"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Teléfono</Label>
                        <Input
                          value={form.customerPhone}
                          onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                          placeholder="WhatsApp del cliente"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>País</Label>
                        <Input
                          value={form.customerCountry}
                          onChange={(e) => handleFormChange('customerCountry', e.target.value)}
                          placeholder="Ej: Argentina, Chile..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Documento</Label>
                        <Input
                          value={form.customerDocument}
                          onChange={(e) => handleFormChange('customerDocument', e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Notas internas</Label>
                      <Textarea
                        value={form.customerComments}
                        onChange={(e) => handleFormChange('customerComments', e.target.value)}
                        placeholder="Hotel, dirección, punto de encuentro u observaciones importantes"
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <Button type="submit" variant="success" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando reserva
                          </>
                        ) : (
                          'Confirmar reserva manual'
                        )}
                      </Button>
                      <p className="text-xs text-gray-500">
                        La reserva quedará asociada a tu usuario y aparecerá en tu panel de
                        comisiones.
                      </p>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="space-y-5 bg-gradient-to-b from-secondary/10 to-white/70 shadow-lg">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Resumen instantáneo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Experiencia</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedExperience?.title ?? 'Seleccioná una experiencia'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedExperience?.slug ?? 'Sin slug configurado'}
                    </p>
                    <Badge variant="outline" className="text-xs font-medium">
                      Reserva manual
                    </Badge>
                  </div>

                  <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Fecha</p>
                    <p className="text-sm font-semibold text-gray-900">{formattedDateLabel}</p>
                    <p className="text-xs text-gray-500">Personas: {people}</p>
                    <p className="text-xs text-gray-500">
                      Total estimado: {unitPrice > 0 ? amountLabel : '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
