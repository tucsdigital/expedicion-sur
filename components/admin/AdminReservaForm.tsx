'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Experience, ReservationStatus } from '@/components/landing-reserva/types';
import type { Vendor, ReferralLink } from '@/types/vendor';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';

type Props = {
  experiencias: Experience[];
};

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

type AttachmentPreview = {
  id: string;
  key: string;
  url: string;
  name: string;
  type?: string;
};

const statusOptions: { value: ReservationStatus; label: string }[] = [
  { value: 'reserved', label: 'Reservada (pendiente de cobro)' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Completada' },
];

export default function AdminReservaForm({ experiencias }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>(
    experiencias[0]?.id ?? ''
  );
  const [date, setDate] = useState<string>('sin-fecha');
  const [people, setPeople] = useState(1);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<ReservationStatus>('reserved');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [stockInfo, setStockInfo] = useState<{ baseCapacity: number; available: number } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>('');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [referralCode, setReferralCode] = useState<string>('');

  const selectedExperience = useMemo(
    () => experiencias.find((item) => item.id === selectedExperienceId) ?? null,
    [experiencias, selectedExperienceId]
  );

  useEffect(() => {
    if (experiencias.length > 0 && !selectedExperienceId) {
      setSelectedExperienceId(experiencias[0].id);
    }
  }, [experiencias, selectedExperienceId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await getVendors({ activeOnly: true, limit: 200 });
        if (!cancelled) setVendors(list);
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLinks = async () => {
      if (!vendorId) {
        setReferralLinks([]);
        return;
      }
      try {
        const links = await getReferralLinksByVendor(vendorId);
        if (!cancelled) setReferralLinks(links);
      } catch {
        setReferralLinks([]);
      }
    };
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

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

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
    const legacy = selectedExperience?.price;
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

  useEffect(() => {
    const run = async () => {
      if (!user || !selectedExperience?.id || !date || date === 'sin-fecha') {
        setStockInfo(null);
        return;
      }
      setStockLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/admin/stock?experienceId=${encodeURIComponent(selectedExperience.id)}&date=${encodeURIComponent(date)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('No se pudo cargar el stock');
        const data = await res.json();
        setStockInfo({ baseCapacity: data.baseCapacity ?? 0, available: data.available ?? 0 });
      } catch (e) {
        setStockInfo(null);
      } finally {
        setStockLoading(false);
      }
    };
    run();
  }, [user, selectedExperience?.id, date]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setUploadingFiles(true);
    const uploaded: AttachmentPreview[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      const key = `reservas/${crypto.randomUUID()}-${file.name}`;
      formData.append('file', file);
      formData.append('key', key);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          toast.error('No se pudo subir el archivo', {
            description: error?.error ?? 'Reintentá con otro archivo',
          });
          continue;
        }
        const data = await response.json();
        uploaded.push({
          id: crypto.randomUUID(),
          key: data.key,
          url: data.url,
          name: file.name,
          type: file.type,
        });
      } catch (error) {
        console.error('[AdminReservaForm] Upload error:', error);
        toast.error('Error subiendo archivo');
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploadingFiles(false);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachment: AttachmentPreview) => {
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: attachment.key }),
      });
    } catch (error) {
      console.error('[AdminReservaForm] Error deleting blob:', error);
      toast.error('No pudimos eliminar el archivo');
      return;
    }
    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
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
      const response = await fetch('/api/admin/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          experienceId: selectedExperience.id,
          date,
          people,
          status,
          customerEmail: form.customerEmail,
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          customerCountry: form.customerCountry || undefined,
          customerDocument: form.customerDocument || undefined,
          customerComments: form.customerComments || undefined,
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((item) => ({
                  key: item.key,
                  url: item.url,
                  name: item.name,
                  type: item.type,
                  uploadedBy: 'admin',
                })),
              }
            : {}),
          ...(vendorId ? { vendorId } : {}),
          ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail ? `${errorData.error} (${errorData.detail})` : (errorData?.error ?? 'No se pudo crear la reserva'));
      }

      const payload = await response.json();
      toast.success('Reserva creada exitosamente');
      router.push(`/admin/reservas/${payload.id}`);
    } catch (error) {
      console.error('[AdminReservaForm] Error creando reserva:', error);
      toast.error('No pudimos crear la reserva, revisá los datos e intentá otra vez');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-success-strong">
            Acción exclusiva
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Crear reserva manual</h1>
          <p className="mt-1 text-sm text-gray-600">
            Completa los datos del cliente, agrega lo documentos necesarios y define el estado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {selectedExperience ? 'Experiencia disponible' : 'Elegí una experiencia'}
          </Badge>
          <Button asChild variant="ghost" className="text-sm font-medium">
            <Link href="/admin/reservas">Ver reservas existentes</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6 bg-white/90 shadow-2xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Datos de la reserva
            </CardTitle>
            <p className="text-sm text-gray-500">
              Se calculan automáticamente precio, moneda y auditoría según la experiencia elegida.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Experiencia</Label>
                  <Select
                    value={selectedExperienceId}
                    onValueChange={(value) => setSelectedExperienceId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná una experiencia" />
                    </SelectTrigger>
                    <SelectContent>
                      {experiencias.map((experience) => (
                        <SelectItem key={experience.id} value={experience.id}>
                          {experience.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ReservationStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fecha de experiencia</Label>
                  {availableDates.length > 0 ? (
                    <Select value={date} onValueChange={(value) => setDate(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná una fecha" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                        <SelectItem value="sin-fecha">Sin fecha específica</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="date"
                      value={date === 'sin-fecha' ? '' : date}
                      onChange={(event) => setDate(event.target.value || 'sin-fecha')}
                    />
                  )}
                  <p className="text-xs text-gray-500">
                    {formattedDateLabel}
                    {availableDates.length > 0 && ' • Las fechas habilitadas aparecen arriba'}
                  </p>
                  {date !== 'sin-fecha' && (
                    <p className="text-xs text-gray-500">
                      {stockLoading ? 'Cargando cupos...' : stockInfo ? `Cupo base: ${stockInfo.baseCapacity} · Disponible: ${stockInfo.available}` : 'Stock no disponible'}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Personas</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full px-4"
                      onClick={() => setPeople(Math.max(1, people - 1))}
                    >
                      -
                    </Button>
                    <span className="text-xl font-semibold">{people}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full px-4"
                      onClick={() => setPeople(Math.min(50, people + 1))}
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Máximo por reserva:{' '}
                    {selectedExperience?.bookingConfig?.maxPeoplePerBooking ?? 'sin límite'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Precio unitario: {unitPrice > 0 ? `${unitPrice} ${currency}` : '—'} · Total: {unitPrice > 0 ? amountLabel : '—'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nombre del cliente</Label>
                  <Input
                    required
                    value={form.customerName}
                    onChange={(event) => handleFormChange('customerName', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email del cliente</Label>
                  <Input
                    required
                    type="email"
                    value={form.customerEmail}
                    onChange={(event) => handleFormChange('customerEmail', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input
                    type="tel"
                    value={form.customerPhone}
                    onChange={(event) => handleFormChange('customerPhone', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>País</Label>
                  <Input
                    value={form.customerCountry}
                    onChange={(event) => handleFormChange('customerCountry', event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Referidos (opcional)</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                <Select
                  value={vendorId || 'none'}
                  onValueChange={(value) => setVendorId(value === 'none' ? '' : value)}
                >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná un vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                    <SelectItem value="none">Sin vendedor</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Select
                      value={referralCode}
                      onValueChange={(value) => setReferralCode(value)}
                      disabled={!vendorId || referralLinks.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí un código del vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {referralLinks.length === 0 ? (
                      <SelectItem value="__no_codes__" disabled>
                            Sin códigos disponibles
                          </SelectItem>
                        ) : (
                          referralLinks.map((l) => (
                            <SelectItem key={l.id} value={l.code}>
                              {l.code} {l.experienceName ? `· ${l.experienceName}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="o ingresá un código manual"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Prioriza el código elegido si ambos están completos.</p>
                  </div>
                </div>
              </div>

          <div className="space-y-1">
            <Label>Documento o DNI</Label>
            <Input
              value={form.customerDocument}
              onChange={(event) => handleFormChange('customerDocument', event.target.value)}
            />
          </div>

              <div className="space-y-1">
                <Label>Comentarios del cliente</Label>
                <Textarea
                  value={form.customerComments}
                  onChange={(event) => handleFormChange('customerComments', event.target.value)}
                  placeholder="Anotá condiciones especiales, requerimientos o cualquier observación"
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Comprobantes y archivos</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="rounded-full px-4" asChild>
                    <label className="cursor-pointer">
                      {uploadingFiles ? 'Subiendo...' : 'Subir archivos'}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </Button>
                  {uploadingFiles && <span className="text-xs text-gray-500">Procesando archivos...</span>}
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/80 p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{attachment.type || 'Archivo adjunto'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(attachment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Aún no cargaste comprobantes.</p>
                )}
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
                  Se registrará el precio y el snapshot de cupo/config. Si la fecha tiene cupos, se valida disponibilidad antes de confirmar.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="space-y-5 bg-gradient-to-b from-secondary/10 to-white/70 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base font-semibold text-gray-900">Resumen instantáneo</CardTitle>
            <p className="text-xs text-gray-500">
              Revisa los datos antes de confirmar. Todo se guarda en Firestore y queda disponible en
              la sección de reservas.
            </p>
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
              <p className="text-xs text-gray-500">Total: {unitPrice > 0 ? amountLabel : '—'}</p>
              {date !== 'sin-fecha' && stockInfo && (
                <p className="text-xs text-gray-500">
                  Cupo base: {stockInfo.baseCapacity} · Disponible: {stockInfo.available}
                  {people > stockInfo.available ? ' (insuficiente)' : ''}
                </p>
              )}
            </div>

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Cliente</p>
              <p className="text-sm font-semibold text-gray-900">
                {form.customerName || '—'}
              </p>
              <p className="text-xs text-gray-500">{form.customerEmail || '—'}</p>
            </div>

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Comprobante</p>
              {attachments.length > 0 ? (
                <ul className="space-y-1 text-sm text-gray-700">
                  {attachments.map((attachment) => (
                    <li key={attachment.id}>{attachment.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Aún no cargaste comprobantes.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
