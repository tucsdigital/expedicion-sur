'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getReservaById } from '@/lib/reservas';
import type {
  Reservation,
  ReservationAttachment,
  ReservationStatus,
} from '@/components/landing-reserva/types';
import type { StockMovement } from '@/lib/stock';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CreditCard,
  Database,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Vendor, ReferralLink } from '@/types/vendor';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';

const reservationStatusOptions: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'reserved', label: 'Reservada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

type StockSummary = {
  baseCapacity: number;
  available: number;
  movements: StockMovement[];
};

const formatDate = (date: unknown): string => {
  if (!date) return '—';
  if (typeof date === 'string')
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const d =
    typeof date === 'object' &&
    date !== null &&
    'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as Date);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: unknown): string => {
  if (!date) return '—';
  if (typeof date === 'string')
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const d =
    typeof date === 'object' &&
    date !== null &&
    'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as Date);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const asDate = (value as { toDate: () => Date }).toDate();
    return asDate.getTime();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return ((value as { seconds: number }).seconds ?? 0) * 1000;
  }
  return 0;
};

const formatAmount = (amountTotal: number, currency: string): string => {
  const value = amountTotal / 100;
  if (currency.toUpperCase() === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (currency.toUpperCase() === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  return `${value.toFixed(2)} ${currency.toUpperCase()}`;
};

const formatMaybeMoney = (unitAmount: number | null | undefined, currency: string): string => {
  if (!unitAmount || unitAmount <= 0) return '—';
  return formatAmount(unitAmount, currency);
};

const statusBadgeVariant: Record<ReservationStatus, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  pending: 'outline',
  reserved: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

export default function ReservaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ReservationStatus>('completed');
  const [statusNote, setStatusNote] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [attachments, setAttachments] = useState<ReservationAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [manualHistory, setManualHistory] = useState<Reservation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>('');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [referralCode, setReferralCode] = useState<string>('');
  const [updatingReferral, setUpdatingReferral] = useState(false);

  const loadReserva = async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) setLoading(true);
    try {
      const data = await getReservaById(params.id);
      if (!data) {
        toast.error('Reserva no encontrada');
        router.replace('/admin/reservas');
        return;
      }
      setReserva(data);
      setStatus(data.status);
      setAttachments(data.attachments ?? []);
    } catch (error) {
      console.error('Error cargando reserva:', error);
      toast.error('No pudimos cargar la reserva');
    } finally {
      if (options.showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadReserva({ showLoading: true });
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    const loadVendors = async () => {
      try {
        const list = await getVendors({ activeOnly: true, limit: 200 });
        if (!cancelled) setVendors(list);
      } catch {
      }
    };
    loadVendors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reserva?.referredBy) {
      setVendorId('');
      setReferralCode('');
      setReferralLinks([]);
      return;
    }
    setVendorId(reserva.referredBy.vendorId ?? '');
    setReferralCode(reserva.referredBy.code ?? '');
  }, [reserva?.referredBy]);

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

  const fetchStockInfo = useCallback(async () => {
    if (!reserva || !user || !reserva.experienceId || !reserva.date) {
      return;
    }
    setStockLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/stock?experienceId=${encodeURIComponent(
          reserva.experienceId
        )}&date=${encodeURIComponent(reserva.date)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo cargar el stock');
      }
      const data = await response.json();
      setStockSummary(data);
    } catch (error) {
      console.error('[Detalle Reserva] Error cargando stock:', error);
    } finally {
      setStockLoading(false);
    }
  }, [reserva?.experienceId, reserva?.date, user]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!reserva?.customerEmail || !user) return;
      setHistoryLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/admin/reservas/history?email=${encodeURIComponent(reserva.customerEmail)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error('No pudimos cargar el historial');
        }
        const payload = await response.json();
        setManualHistory(payload.reservations ?? []);
      } catch (error) {
        console.error('Error cargando historial de usuario:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [reserva?.customerEmail, user]);

  useEffect(() => {
    fetchStockInfo();
  }, [fetchStockInfo]);

  const referralSummary = useMemo(() => {
    if (!reserva?.referredBy) return 'Sin referido asignado';
    const channel =
      reserva.referredBy.channel === 'link'
        ? 'Link de vendedor'
        : 'Asignación manual';
    const statusLabel = reserva.referredBy.payoutStatus
      ? ` · Estado comisión: ${reserva.referredBy.payoutStatus}`
      : '';
    return `${channel}${statusLabel}`;
  }, [reserva?.referredBy]);

  const handleReferralUpdate = async (options: { clear?: boolean } = {}) => {
    if (!reserva || !user) return;
    setUpdatingReferral(true);
    try {
      const token = await user.getIdToken();
      const body: any = {
        reservationId: reserva.id,
      };
      if (options.clear) {
        body.clearReferredBy = true;
      } else {
        if (vendorId) body.vendorId = vendorId;
        if (referralCode.trim()) body.referralCode = referralCode.trim();
      }
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo actualizar el referido');
      }
      toast.success(options.clear ? 'Referido eliminado' : 'Referido actualizado');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error actualizando referido:', error);
      toast.error('No pudimos actualizar el referido');
    } finally {
      setUpdatingReferral(false);
    }
  };

  const handleStatusUpdate = async (targetStatus: ReservationStatus, note?: string) => {
    if (!reserva || !user) return;
    setStatusUpdating(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          status: targetStatus,
          note: note ?? statusNote,
        }),
      });
      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado');
      }
      toast.success('Estado actualizado');
      await loadReserva({ showLoading: false });
      await fetchStockInfo();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('No pudimos actualizar el estado');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancelReservation = () => handleStatusUpdate('cancelled', 'Cancelada desde el panel administrador');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const input = event.currentTarget;
    if (!files?.length || !reserva || !user) return;
    setUploadingAttachments(true);
    const uploadedAttachments: ReservationAttachment[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error('No se pudo subir el archivo');
        }
        const data = await uploadResponse.json();
        uploadedAttachments.push({
          id: crypto.randomUUID(),
          url: data.url,
          name: file.name,
          type: file.type,
          uploadedBy: 'admin',
          createdAt: new Date(),
        });
      } catch (error) {
        console.error('[Detalle Reserva] Error subiendo archivo:', error);
        toast.error('No pudimos subir el archivo');
      }
    }

    if (uploadedAttachments.length === 0) {
      setUploadingAttachments(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          attachments: uploadedAttachments.map((attachment) => ({
            url: attachment.url,
            name: attachment.name,
            type: attachment.type,
            uploadedBy: 'admin',
          })),
        }),
      });
      if (!response.ok) {
        throw new Error('No se pudo guardar el comprobante');
      }
      toast.success('Comprobantes actualizados');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('[Detalle Reserva] Error guardando adjuntos:', error);
      toast.error('No pudimos guardar los adjuntos');
    } finally {
      setUploadingAttachments(false);
      if (input) {
        input.value = '';
      }
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!reserva || !user) return;
    setRemovingAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          removeAttachments: [{ id: attachmentId }],
        }),
      });
      if (!response.ok) {
        throw new Error('No pudimos borrar el archivo');
      }
      toast.success('Comprobante eliminado');
      await loadReserva({ showLoading: false });
      await fetchStockInfo();
    } catch (error) {
      console.error('[Detalle Reserva] Error eliminando adjunto:', error);
      toast.error('No pudimos eliminar el comprobante');
    } finally {
      setRemovingAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-7 w-56 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-40 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-md animate-pulse" />
            </div>

            <section className="grid gap-4 rounded-3xl bg-white/90 px-5 py-4 shadow-lg ring-1 ring-black/5 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-28 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="space-y-2 border-l border-dashed border-black/5 pl-4 sm:border-l sm:pl-6">
                <div className="h-3 w-20 bg-gray-200 rounded-md animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-32 bg-gray-200 rounded-md animate-pulse" />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-40 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="mt-4 grid gap-2 rounded-2xl bg-gray-50/70 p-4 sm:grid-cols-2">
                <div className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded-md animate-pulse" />
              </div>
            </section>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!reserva) return null;

  const statusLabel = reserva.status;
  const isManual = reserva.paymentMethod === 'admin' || reserva.createdByAdmin;

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Reserva</p>
              <h1 className="text-2xl font-semibold text-gray-900">Detalle #{reserva.id.slice(0, 6)}</h1>
              <p className="text-sm text-gray-500">{reserva.stripeSessionId ?? 'Sin sesión registrada'}</p>
            </div>
            <Badge variant={statusBadgeVariant[statusLabel]} className="capitalize">
              {statusLabel}
            </Badge>
          </div>

          <section className="grid gap-4 rounded-3xl bg-white/90 px-5 py-4 shadow-lg ring-1 ring-black/5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Experiencia</p>
              <p className="text-lg font-semibold text-gray-900">{reserva.experienceTitle}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{reserva.experienceSlug}</Badge>
                <span className="text-xs text-gray-500">
                  <Calendar className="inline-block h-3 w-3" />{' '}
                  {reserva.date === 'sin-fecha'
                    ? 'Fecha por coordinar'
                    : formatDate(reserva.date)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                <Users className="inline-block h-3 w-3" /> {reserva.people} persona
                {reserva.people !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-2 border-l border-dashed border-black/5 pl-4 sm:border-l sm:pl-6">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Stock</p>
              {stockLoading ? (
                <p className="text-sm text-gray-500">Cargando stock…</p>
              ) : stockSummary ? (
                <div className="space-y-1 text-sm text-gray-700">
                  <p className="flex items-center gap-1">
                    <Database className="h-3 w-3" /> Base: {stockSummary.baseCapacity}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Disponible: {stockSummary.available}
                  </p>
                  <p className="text-xs text-gray-400">
                    {stockSummary.movements.length > 0 ? 'Movimientos recientes registrados' : 'Sin movimientos recientes'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay stock asociado</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Referido</p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {reserva.referredBy?.vendorName ?? 'Sin vendedor asignado'}
                </h2>
                <p className="text-xs text-gray-500">
                  {reserva.referredBy?.code
                    ? `Código: ${reserva.referredBy.code}`
                    : reserva.referredBy
                      ? 'Asignación manual'
                      : 'Podés vincular esta reserva a un vendedor'}
                </p>
                <p className="text-xs text-gray-400">{referralSummary}</p>
              </div>
              <div className="flex items-start gap-2">
                {reserva.referredBy && (
                  <Badge variant="outline" className="capitalize">
                    {reserva.referredBy.payoutStatus}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50/70 p-4 text-sm text-gray-700 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Vendedor</Label>
                <Select
                  value={vendorId || 'none'}
                  onValueChange={(value) => setVendorId(value === 'none' ? '' : value)}
                  disabled={updatingReferral}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin vendedor" />
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
                <Label className="text-xs font-medium text-gray-600">Código del vendedor</Label>
                <Select
                  value={referralLinks.some((l) => l.code === referralCode) ? referralCode : ''}
                  onValueChange={(value) => setReferralCode(value)}
                  disabled={!vendorId || referralLinks.length === 0 || updatingReferral}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí un código" />
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
                <Label className="text-xs font-medium text-gray-600">Código manual</Label>
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Ingresá un código específico"
                  disabled={updatingReferral}
                />
                <p className="text-[11px] text-gray-500">
                  Si elegís uno de la lista y también escribís, se usa el código exacto.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  disabled={updatingReferral || (!vendorId && !referralCode.trim())}
                  onClick={() => handleReferralUpdate()}
                >
                  {updatingReferral ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Guardando
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </Button>
                {reserva.referredBy && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingReferral}
                    onClick={() => handleReferralUpdate({ clear: true })}
                  >
                    Quitar referido
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Las comisiones se recalculan automáticamente según el vendedor y el estado de la reserva.
              </p>
            </div>

            {reserva.referredBy && (
              <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-700 sm:grid-cols-2">
                <p>
                  Comisión:{' '}
                  <span className="font-medium">
                    {(reserva.referredBy.commissionAmount / 100).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    {reserva.referredBy.commissionCurrency.toUpperCase()}
                  </span>
                </p>
                <p>
                  Regla:{' '}
                  <span className="font-medium">
                    {reserva.referredBy.commissionType === 'percent'
                      ? `${reserva.referredBy.commissionValue}%`
                      : `${reserva.referredBy.commissionValue} ${reserva.referredBy.commissionCurrency.toUpperCase()}`}
                  </span>
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Pago</p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {reserva.paymentMethod === 'admin'
                    ? 'Registro manual'
                    : formatAmount(reserva.amountTotal, reserva.currency)}
                </h2>
                <p className="text-xs text-gray-500">
                  {reserva.paymentMethod === 'admin'
                    ? 'Sin cobro'
                    : `ID: ${reserva.stripeSessionId ?? '—'}`}
                </p>
              </div>
              <Badge
                variant={
                  reserva.paymentMethod === 'pix'
                    ? 'default'
                    : isManual
                      ? 'outline'
                      : 'secondary'
                }
                className="capitalize"
              >
                {reserva.paymentMethod === 'pix'
                  ? 'PIX'
                  : isManual
                    ? 'Manual'
                    : 'Stripe'}
              </Badge>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-gray-50/70 p-4 text-sm text-gray-700 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Auditoría de precio</p>
                <p>
                  <span className="text-gray-500">Unitario:</span>{' '}
                  <span className="font-medium">
                    {formatMaybeMoney(reserva.pricingSnapshot?.unitAmount ?? null, reserva.currency)}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {reserva.pricingSnapshot?.unitPrice != null
                    ? `unitPrice: ${reserva.pricingSnapshot.unitPrice}`
                    : 'unitPrice: —'}{' '}
                  · currency: {String(reserva.pricingSnapshot?.currency ?? reserva.currency).toUpperCase()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Auditoría de cupos</p>
                <p>
                  <span className="text-gray-500">Cupo base:</span>{' '}
                  <span className="font-medium">{reserva.capacitySnapshot?.baseCapacity ?? '—'}</span>
                </p>
                <p className="text-xs text-gray-500">
                  maxPeoplePerBooking: {reserva.capacitySnapshot?.maxPeoplePerBooking ?? '—'} · fechas específicas:{' '}
                  {reserva.capacitySnapshot?.hasSpecificDates ? 'sí' : 'no'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl bg-gray-50/80 p-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-700">
                    {attachments.length} comprobante{attachments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-gray-500">No hay adjuntos.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm"
                      >
                        <Link
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
                        >
                          {attachment.name}
                        </Link>
                        <Badge variant="outline" className="text-[11px] text-gray-500">
                          {attachment.type || 'Archivo'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3 rounded-2xl bg-gray-50/80 p-4">
                <label
                  htmlFor="attachment-upload"
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-black/20"
                >
                  <span className="flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-gray-500" />
                    {uploadingAttachments ? 'Subiendo...' : 'Agregar adjuntos'}
                  </span>
                  {uploadingAttachments && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                </label>
                <input
                  id="attachment-upload"
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Eliminar comprobantes</p>
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
                        >
                          <span className="truncate font-medium">{attachment.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500"
                            disabled={removingAttachmentIds.includes(attachment.id)}
                            onClick={() => handleAttachmentDelete(attachment.id)}
                          >
                            {removingAttachmentIds.includes(attachment.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Control de estado</p>
                <p className="text-sm text-gray-500">Los cambios quedan registrados en el historial.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={handleCancelReservation} disabled={statusUpdating}>
                  Cancelar
                </Button>
                <Button variant="success" size="sm" onClick={() => handleStatusUpdate(status)}>
                  Guardar
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-[0.3em] text-gray-400">Estado</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ReservationStatus)}>
                  <SelectTrigger className="rounded-2xl border border-black/10 bg-white py-2">
                    <SelectValue placeholder="Seleccioná un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {reservationStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-[0.3em] text-gray-400">Nota interna</Label>
                <Textarea
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="Describe por qué se cambió el estado"
                  className="min-h-[96px] rounded-2xl border border-black/10 bg-white"
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Historial de estados</p>
              <div className="mt-3 space-y-3">
                {reserva.statusHistory?.length ? (
                  reserva.statusHistory
                    .slice()
                    .sort((a, b) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt))
                    .map((entry) => (
                      <div
                        key={`${entry.status}-${toTimestampMs(entry.createdAt)}`}
                        className="space-y-1 rounded-2xl border border-black/5 bg-white/80 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={statusBadgeVariant[entry.status]} className="capitalize text-xs">
                            {entry.status}
                          </Badge>
                          <span className="text-[11px] text-gray-500">{formatDateTime(entry.createdAt)}</span>
                        </div>
                        {entry.note && <p className="text-sm text-gray-700">{entry.note}</p>}
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-gray-500">No hay historial registrado.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Cliente</p>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p className="text-lg font-semibold text-gray-900">{reserva.customerName || '—'}</p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> {reserva.customerEmail || '—'}
                </p>
                {reserva.customerPhone && (
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {reserva.customerPhone}
                  </p>
                )}
                {reserva.customerCountry && (
                  <p className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {reserva.customerCountry}
                  </p>
                )}
                {reserva.customerDocument && (
                  <p className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {reserva.customerDocument}
                  </p>
                )}
                {reserva.customerComments && (
                  <p className="text-sm text-gray-700">{reserva.customerComments}</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Registro</p>
            <p className="mt-2 text-sm text-gray-600">
              {`Creada el ${formatDateTime(reserva.createdAt)}.`}
            </p>
            {reserva.updatedAt && (
              <p className="text-sm text-gray-500">
                Última modificación: {formatDateTime(reserva.updatedAt)}
              </p>
            )}
          </section>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
