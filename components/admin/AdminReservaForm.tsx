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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type {
  ReservationRoomType,
  ReservationStatus,
  ReservationTravelerDetails,
} from '@/components/landing-reserva/types';
import type { Vendor, ReferralLink } from '@/types/vendor';
import type { DepartureSeat, Paquete, SeatLayoutTemplate } from '@/types';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';
import SeatMap from '@/components/seats/SeatMap';
import {
  computeReservationPricing,
  getOperationalDepartureDates,
  getSeatLayoutExtraOptions,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
} from '@/lib/packages/resolve-departure';

type Props = {
  paquetes: Paquete[];
};

type FormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCountry: string;
  customerDocument: string;
  customerBirthDate: string;
  customerComments: string;
};

const DEFAULT_FORM_STATE: FormState = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerCountry: '',
  customerDocument: '',
  customerBirthDate: '',
  customerComments: '',
};

type TravelerForm = {
  firstName: string;
  lastName: string;
  age: string;
  birthDate: string;
  phone: string;
  document: string;
};

const EMPTY_TRAVELER: TravelerForm = {
  firstName: '',
  lastName: '',
  age: '',
  birthDate: '',
  phone: '',
  document: '',
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ROOM_TYPE_LABELS: Record<ReservationRoomType, string> = {
  matrimonial: 'Matrimonial',
  twin: 'Twin',
  'full-day': 'Full day',
};

function formatAmountCents(amount: number, currency: string): string {
  const value = Math.max(0, Number(amount) || 0) / 100;
  if (currency === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (currency === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  if (currency === 'USD') return `USD ${value.toLocaleString('en-US')}`;
  return `${value.toFixed(2)} ${currency}`;
}

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

export default function AdminReservaForm({ paquetes }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    paquetes[0]?.id ?? ''
  );
  const [date, setDate] = useState<string>('sin-fecha');
  const [adults, setAdults] = useState(1);
  const [minors, setMinors] = useState(0);
  const peopleTotal = useMemo(() => Math.max(0, (Number(adults) || 0) + (Number(minors) || 0)), [adults, minors]);
  const [depositPercentAdults, setDepositPercentAdults] = useState<string>('');
  const [depositPercentMinors, setDepositPercentMinors] = useState<string>('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<ReservationStatus>('reserved');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [stockInfo, setStockInfo] = useState<{ baseCapacity: number; available: number } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>('');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [selectedReferralCode, setSelectedReferralCode] = useState<string>('');
  const [manualReferralCode, setManualReferralCode] = useState<string>('');
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatData, setSeatData] = useState<{ template: SeatLayoutTemplate; seats: DepartureSeat[] } | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [pickupPoint, setPickupPoint] = useState<string>('');
  const [roomType, setRoomType] = useState<ReservationRoomType>('matrimonial');
  const [selectedExtraCodes, setSelectedExtraCodes] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<TravelerForm[]>([]);

  const selectedPaquete = useMemo(
    () => paquetes.find((item) => item.id === selectedPackageId) ?? null,
    [paquetes, selectedPackageId]
  );

  useEffect(() => {
    if (paquetes.length > 0 && !selectedPackageId) {
      setSelectedPackageId(paquetes[0].id);
    }
  }, [paquetes, selectedPackageId]);

  useEffect(() => {
    setAllowOverbook(false);
  }, [selectedPackageId, date]);

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

  const referralLinksForPackage = useMemo(() => {
    const packageId = String(selectedPaquete?.id ?? '').trim();
    if (!packageId) return referralLinks;
    return referralLinks.filter((link) => {
      const linkPackageId = String(link.packageId ?? link.experienceId ?? '').trim();
      return !linkPackageId || linkPackageId === packageId;
    });
  }, [referralLinks, selectedPaquete?.id]);

  useEffect(() => {
    if (!vendorId) {
      setSelectedReferralCode('');
      return;
    }
    if (!selectedReferralCode) return;
    const exists = referralLinksForPackage.some((link) => link.code === selectedReferralCode);
    if (!exists) setSelectedReferralCode('');
  }, [referralLinksForPackage, selectedReferralCode, vendorId]);

  const dateOptions = useMemo<string[]>(() => {
    if (!selectedPaquete) return [];
    return getOperationalDepartureDates(selectedPaquete);
  }, [selectedPaquete]);

  useEffect(() => {
    if (dateOptions.length > 0) {
      setDate((prev) => (dateOptions.includes(prev) ? prev : dateOptions[0]));
      return;
    }
    if (date !== 'sin-fecha') setDate('sin-fecha');
  }, [dateOptions]);

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

  const resolvedSelectedDeparture = useMemo(() => {
    if (!selectedPaquete) return null;
    return resolveDepartureConfig(selectedPaquete, date);
  }, [selectedPaquete, date]);
  const currency = String(resolvedSelectedDeparture?.displayCurrency ?? selectedPaquete?.moneda ?? 'ARS').toUpperCase();
  const pickupPointOptions = useMemo(
    () =>
      (resolvedSelectedDeparture?.pickupPointsConfig ?? []).filter(
        (item) => String(item?.label ?? '').trim().length > 0
      ),
    [resolvedSelectedDeparture?.pickupPointsConfig]
  );
  const pickupPointTimes = useMemo(
    () =>
      new Map(
        pickupPointOptions.map((item) => [String(item.label).trim(), String(item.time ?? '').trim() || null])
      ),
    [pickupPointOptions]
  );
  const selectedExtras = useMemo(() => {
    if (!selectedPaquete) return [];
    return resolveReservationExtraSelections({
      paquete: selectedPaquete,
      pickupPoint: pickupPoint || null,
      selectedExtraCodes,
      seatLayoutTemplate: seatData?.template ?? null,
    });
  }, [pickupPoint, seatData?.template, selectedExtraCodes, selectedPaquete]);
  const seatExtraOptions = useMemo(
    () => getSeatLayoutExtraOptions(seatData?.template ?? null),
    [seatData?.template]
  );
  const computedPricing = useMemo(() => {
    if (!selectedPaquete) return null;
    const dpAdults = depositPercentAdults.trim() ? Number(depositPercentAdults) : NaN;
    const dpMinors = depositPercentMinors.trim() ? Number(depositPercentMinors) : NaN;
    return computeReservationPricing(selectedPaquete, date, {
      peopleAdults: Math.max(0, Number(adults) || 0),
      peopleMinors: Math.max(0, Number(minors) || 0),
      depositPercentAdults: Number.isFinite(dpAdults) ? dpAdults : null,
      depositPercentMinors: Number.isFinite(dpMinors) ? dpMinors : null,
      roomType,
      selectedExtras,
    });
  }, [adults, date, depositPercentAdults, depositPercentMinors, minors, roomType, selectedExtras, selectedPaquete]);
  const amountTotal = useMemo(() => computedPricing?.subtotalAmount ?? 0, [computedPricing]);
  const amountLabel = useMemo(() => {
    const value = amountTotal / 100;
    if (currency === 'ARS') return `$${value.toLocaleString('es-AR')}`;
    if (currency === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
    if (currency === 'USD') return `USD ${value.toLocaleString('en-US')}`;
    return `${value.toFixed(2)} ${currency}`;
  }, [amountTotal, currency]);

  useEffect(() => {
    setStockInfo(null);
    setStockLoading(false);
  }, [user, selectedPaquete?.id, date]);

  const salida = useMemo(() => {
    if (!selectedPaquete || !date || date === 'sin-fecha') return null;
    return (selectedPaquete.salidas ?? []).find((s) => s.fecha === date) ?? null;
  }, [selectedPaquete, date]);

  const seatsEnabled = false;

  useEffect(() => {
    setSelectedSeatIds((prev) => prev.slice(0, Math.max(0, peopleTotal)));
  }, [peopleTotal]);

  useEffect(() => {
    setPassengerDetails((prev) => {
      const needed = Math.max(0, peopleTotal - 1);
      if (prev.length === needed) return prev;
      return Array.from({ length: needed }, (_, index) => prev[index] ?? { ...EMPTY_TRAVELER });
    });
  }, [peopleTotal]);

  useEffect(() => {
    if (!pickupPointOptions.length) {
      if (pickupPoint) setPickupPoint('');
      return;
    }
    if (!pickupPoint || !pickupPointOptions.some((item) => item.label === pickupPoint)) {
      setPickupPoint(String(pickupPointOptions[0]?.label ?? ''));
    }
  }, [pickupPoint, pickupPointOptions]);

  useEffect(() => {
    const validCodes = new Set(seatExtraOptions.map((item) => item.code));
    setSelectedExtraCodes((prev) => prev.filter((code) => validCodes.has(code as any)));
  }, [seatExtraOptions]);

  const fetchSeatMap = async () => {
    if (!user || !selectedPaquete?.id || !date || date === 'sin-fecha' || !seatsEnabled) return;
    setSeatLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/seats?packageId=${encodeURIComponent(selectedPaquete.id)}&date=${encodeURIComponent(date)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo cargar el mapa de butacas');
      }
      const json = await res.json();
      if (!json?.enabled) {
        setSeatData(null);
        setSelectedSeatIds([]);
        return;
      }
      setSeatData({ template: json.template, seats: json.seats });
    } catch {
      setSeatData(null);
    } finally {
      setSeatLoading(false);
    }
  };

  useEffect(() => {
    setSeatData(null);
    setSelectedSeatIds([]);
    if (seatsEnabled) void fetchSeatMap();
  }, [seatsEnabled, selectedPaquete?.id, date, user]);

  const seatLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seatData?.seats ?? []) map.set(String(s.seatId), String(s.label));
    return map;
  }, [seatData?.seats]);

  const selectedSeatLabels = useMemo(() => {
    return selectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean);
  }, [selectedSeatIds, seatLabelById]);

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

  const sanitizedPassengerDetails = useMemo<ReservationTravelerDetails[]>(
    () =>
      passengerDetails.map((traveler) => {
        const age = Math.max(0, Math.min(120, Number(traveler.age) || 0));
        return {
          firstName: traveler.firstName.trim(),
          lastName: traveler.lastName.trim(),
          age,
          birthDate: traveler.birthDate.trim(),
          phone: traveler.phone.trim(),
          document: traveler.document.trim(),
          travelerType: age < 18 ? 'minor' : 'adult',
        };
      }),
    [passengerDetails]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPaquete) {
      toast.error('Seleccioná un paquete antes de continuar');
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
    if (!DATE_REGEX.test(form.customerBirthDate.trim())) {
      toast.error('Completa la fecha de nacimiento del titular');
      return;
    }
    if (peopleTotal < 1) {
      toast.error('La reserva debe incluir al menos una persona');
      return;
    }
    if (seatsEnabled && selectedSeatIds.length !== peopleTotal) {
      toast.error('Debés seleccionar una butaca por pasajero');
      return;
    }
    if (sanitizedPassengerDetails.some((traveler) => {
      const fullNameOk = traveler.firstName.length >= 2 && traveler.lastName.length >= 2;
      const birthDateOk = DATE_REGEX.test(traveler.birthDate);
      const phoneOk = traveler.phone.length >= 8;
      const documentOk = traveler.document.length >= 3;
      return !fullNameOk || !birthDateOk || !phoneOk || !documentOk;
    })) {
      toast.error('Completa los datos de todos los pasajeros');
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
          packageId: selectedPaquete.id,
          date,
          peopleAdults: Math.max(0, Number(adults) || 0),
          peopleMinors: Math.max(0, Number(minors) || 0),
          status,
          allowOverbook: Boolean(allowOverbook),
          customerEmail: form.customerEmail,
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          customerCountry: form.customerCountry || undefined,
          customerDocument: form.customerDocument || undefined,
          customerBirthDate: form.customerBirthDate || undefined,
          customerComments: form.customerComments || undefined,
          passengerDetails: sanitizedPassengerDetails,
          ...(depositPercentAdults.trim() ? { depositPercentAdults: Number(depositPercentAdults) } : {}),
          ...(depositPercentMinors.trim() ? { depositPercentMinors: Number(depositPercentMinors) } : {}),
          ...(pickupPoint ? { pickupPoint } : {}),
          ...(pickupPoint ? { pickupPointTime: pickupPointTimes.get(pickupPoint) || null } : {}),
          roomType,
          ...(selectedExtraCodes.length ? { selectedExtraCodes } : {}),
          ...(seatsEnabled ? { selectedSeats: selectedSeatLabels } : {}),
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
          ...(manualReferralCode.trim()
            ? { referralCode: manualReferralCode.trim() }
            : selectedReferralCode.trim()
              ? { referralCode: selectedReferralCode.trim() }
              : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail ? `${errorData.error} (${errorData.detail})` : (errorData?.error ?? 'No se pudo crear la reserva'));
      }

      const payload = await response.json();
      toast.success('Reserva creada exitosamente');
      router.push(`/admin/ventas/${payload.id}`);
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
            {selectedPaquete ? 'Paquete seleccionado' : 'Elegí un paquete'}
          </Badge>
          <Button asChild variant="ghost" className="text-sm font-medium">
            <Link href="/admin/ventas">Ver ventas existentes</Link>
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
              Se calculan automáticamente precio, moneda y auditoría según el paquete elegido.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Paquete</Label>
                  <Select
                    value={selectedPackageId}
                    onValueChange={(value) => setSelectedPackageId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná un paquete" />
                    </SelectTrigger>
                    <SelectContent>
                      {paquetes.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.titulo}
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
                  <Label>Fecha / salida</Label>
                  {dateOptions.length > 0 ? (
                    <Select value={date} onValueChange={(value) => setDate(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná una fecha" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateOptions.map((slot) => (
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
                    {dateOptions.length > 0 && ' • Fechas disponibles'}
                  </p>
                  <p className="text-xs text-gray-500">
                    La reserva manual ya no valida cupos ni stock legacy.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Personas</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Adultos</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={adults}
                        onChange={(e) => setAdults(parseInt(e.target.value || '0', 10))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Menores</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={minors}
                        onChange={(e) => setMinors(parseInt(e.target.value || '0', 10))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Máximo por reserva:{' '}
                    {selectedPaquete?.bookingConfig?.maxPeoplePerBooking ?? selectedPaquete?.capacidadMaxima ?? 50}
                  </p>
                  <p className="text-xs text-gray-500">
                    Pasajeros: {peopleTotal} · Total: {peopleTotal > 0 ? amountLabel : '—'}
                  </p>
                  {selectedPaquete?.reservationPricing?.mode === 'percent' ? (
                    <div className="mt-2 grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-semibold text-gray-700">Override de porcentaje (opcional)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Adultos (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={depositPercentAdults}
                            onChange={(e) => setDepositPercentAdults(e.target.value)}
                            placeholder="Auto"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Menores (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={depositPercentMinors}
                            onChange={(e) => setDepositPercentMinors(e.target.value)}
                            placeholder="Auto"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Lugar de ascenso</Label>
                  {pickupPointOptions.length > 0 ? (
                    <>
                      <Select value={pickupPoint || 'none'} onValueChange={(value) => setPickupPoint(value === 'none' ? '' : value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccioná un ascenso" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin ascenso</SelectItem>
                          {pickupPointOptions.map((item) => (
                            <SelectItem key={item.label} value={item.label}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        {pickupPoint
                          ? `Horario: ${pickupPointTimes.get(pickupPoint) || 'A confirmar'}`
                          : 'Podés dejarlo sin definir si todavía no está confirmado.'}
                      </p>
                    </>
                  ) : (
                    <Input value="Sin ascensos configurados" readOnly className="bg-gray-50 text-gray-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Habitación</Label>
                  <Select value={roomType} onValueChange={(value) => setRoomType(value as ReservationRoomType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matrimonial">Matrimonial</SelectItem>
                      <SelectItem value="twin">Twin</SelectItem>
                      <SelectItem value="full-day">Full day</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Dato operativo. No modifica el precio.</p>
                </div>
                <div className="space-y-1">
                  <Label>Extras</Label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    {seatExtraOptions.length > 0 ? (
                      <div className="space-y-2">
                        {seatExtraOptions.map((extra) => (
                          <label key={extra.code} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedExtraCodes.includes(extra.code)}
                                onChange={(e) =>
                                  setSelectedExtraCodes((prev) =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, extra.code]))
                                      : prev.filter((code) => code !== extra.code)
                                  )
                                }
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              {extra.label}
                            </span>
                            <span className="text-xs font-medium text-gray-500">
                              {formatAmountCents(extra.amount, currency)}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Esta salida no tiene extras comerciales configurados.</p>
                    )}
                  </div>
                </div>
              </div>

              {seatsEnabled && date !== 'sin-fecha' ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Butacas</div>
                      <div className="text-xs text-gray-600">
                        Seleccionadas: <span className="font-semibold text-gray-900">{selectedSeatLabels.length}</span> / {peopleTotal}
                      </div>
                      {selectedSeatLabels.length > 0 ? (
                        <div className="mt-1 text-xs text-gray-600">{selectedSeatLabels.join(', ')}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={seatLoading || submitting}
                        onClick={() => {
                          setSeatDialogOpen(true);
                          if (!seatData) void fetchSeatMap();
                        }}
                      >
                        Elegir butacas
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={seatLoading || submitting}
                        onClick={() => setSelectedSeatIds([])}
                      >
                        Limpiar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Documento o DNI</Label>
                  <Input
                    value={form.customerDocument}
                    onChange={(event) => handleFormChange('customerDocument', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha de nacimiento</Label>
                  <Input
                    required
                    type="date"
                    value={form.customerBirthDate}
                    onChange={(event) => handleFormChange('customerBirthDate', event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Referidos (opcional)</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                <Select
                  value={vendorId || 'none'}
                  onValueChange={(value) => {
                    setVendorId(value === 'none' ? '' : value);
                    setSelectedReferralCode('');
                    setManualReferralCode('');
                  }}
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
                      value={selectedReferralCode || 'none'}
                      onValueChange={(value) => {
                        setSelectedReferralCode(value === 'none' ? '' : value);
                        setManualReferralCode('');
                      }}
                      disabled={!vendorId || referralLinksForPackage.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí un código del vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin código</SelectItem>
                        {referralLinksForPackage.length === 0 ? (
                      <SelectItem value="__no_codes__" disabled>
                            Sin códigos disponibles
                          </SelectItem>
                        ) : (
                          referralLinksForPackage.map((l) => (
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
                      value={manualReferralCode}
                      onChange={(e) => {
                        setManualReferralCode(e.target.value);
                        if (e.target.value.trim()) setSelectedReferralCode('');
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Si completás este campo, se usará el código exacto.
                    </p>
                  </div>
                </div>
              </div>

              {passengerDetails.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <Label>Pasajeros</Label>
                    <p className="text-xs text-gray-500">
                      Completá los datos de los {passengerDetails.length} pasajero{passengerDetails.length === 1 ? '' : 's'} adicional{passengerDetails.length === 1 ? '' : 'es'}.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {passengerDetails.map((traveler, index) => (
                      <div key={`traveler-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-sm font-semibold text-gray-900">Pasajero {index + 2}</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Nombre</Label>
                            <Input
                              value={traveler.firstName}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, firstName: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Apellido</Label>
                            <Input
                              value={traveler.lastName}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, lastName: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Edad</Label>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              value={traveler.age}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, age: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Fecha de nacimiento</Label>
                            <Input
                              type="date"
                              value={traveler.birthDate}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, birthDate: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Teléfono</Label>
                            <Input
                              value={traveler.phone}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, phone: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Documento</Label>
                            <Input
                              value={traveler.document}
                              onChange={(event) =>
                                setPassengerDetails((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, document: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
              <p className="text-xs uppercase tracking-wide text-gray-500">Paquete</p>
              <p className="text-sm font-semibold text-gray-900">
                {selectedPaquete?.titulo ?? 'Seleccioná un paquete'}
              </p>
              <p className="text-xs text-gray-500">
                {selectedPaquete?.slug ?? '—'}
              </p>
              <Badge variant="outline" className="text-xs font-medium">
                Reserva manual
              </Badge>
            </div>

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Fecha</p>
              <p className="text-sm font-semibold text-gray-900">{formattedDateLabel}</p>
              <p className="text-xs text-gray-500">Personas: {peopleTotal}</p>
              <p className="text-xs text-gray-500">
                Ascenso: {pickupPoint || 'Sin definir'}
                {pickupPoint ? ` · ${pickupPointTimes.get(pickupPoint) || 'Horario a confirmar'}` : ''}
              </p>
              <p className="text-xs text-gray-500">Habitación: {ROOM_TYPE_LABELS[roomType]}</p>
              <p className="text-xs text-gray-500">
                Base: {computedPricing ? formatAmountCents(computedPricing.baseSubtotalAmount, currency) : '—'}
              </p>
              <p className="text-xs text-gray-500">
                Extras: {computedPricing ? formatAmountCents(computedPricing.extrasTotalAmount, currency) : '—'}
              </p>
              <p className="text-xs text-gray-500">Total: {peopleTotal > 0 ? amountLabel : '—'}</p>
            </div>

            {seatsEnabled ? (
              <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Butacas</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedSeatLabels.length > 0 ? selectedSeatLabels.join(', ') : '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedSeatLabels.length} / {peopleTotal}
                </p>
              </div>
            ) : null}

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Cliente</p>
              <p className="text-sm font-semibold text-gray-900">
                {form.customerName || '—'}
              </p>
              <p className="text-xs text-gray-500">{form.customerEmail || '—'}</p>
              <p className="text-xs text-gray-500">
                Nacimiento: {form.customerBirthDate || '—'}
              </p>
            </div>

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Extras operativos</p>
              <p className="text-sm font-semibold text-gray-900">
                {selectedExtras.length > 0 ? selectedExtras.map((extra) => extra.label).join(', ') : 'Sin extras'}
              </p>
              <p className="text-xs text-gray-500">
                {passengerDetails.length > 0
                  ? `${passengerDetails.length} pasajero${passengerDetails.length === 1 ? '' : 's'} adicional${passengerDetails.length === 1 ? '' : 'es'} cargado${passengerDetails.length === 1 ? '' : 's'}`
                  : 'No hay pasajeros adicionales'}
              </p>
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

      <Dialog open={seatDialogOpen} onOpenChange={(open) => setSeatDialogOpen(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl md:w-full md:max-w-5xl">
          <div className="flex max-h-[85vh] flex-col">
            <div className="border-b border-gray-200 px-6 py-4">
              <DialogHeader className="gap-1">
                <DialogTitle>Selección de butacas</DialogTitle>
                <div className="text-sm text-gray-500">
                  Seleccioná <span className="font-semibold text-gray-900">{peopleTotal}</span> butaca{peopleTotal === 1 ? '' : 's'} · Elegidas:{' '}
                  <span className="font-semibold text-gray-900">{selectedSeatIds.length}</span> / {peopleTotal}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {seatLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando mapa…
                  </div>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-40 rounded bg-gray-200" />
                    <div className="h-[320px] w-full rounded-3xl bg-gray-100" />
                    <div className="h-4 w-56 rounded bg-gray-200" />
                  </div>
                </div>
              ) : seatData ? (
                <SeatMap
                  template={seatData.template}
                  seats={seatData.seats}
                  selectedSeatIds={selectedSeatIds}
                  maxSelectable={peopleTotal}
                  onChangeSelected={setSelectedSeatIds}
                />
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  No hay mapa de butacas disponible para esta salida.
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setSeatDialogOpen(false)}>
                  Cerrar
                </Button>
                <Button type="button" disabled={selectedSeatIds.length !== peopleTotal} onClick={() => setSeatDialogOpen(false)}>
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
