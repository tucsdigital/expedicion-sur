'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getReservaById, getReservaPayments, type ReservaPaymentEvent } from '@/lib/reservas';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Globe,
  Loader2,
  Mail,
  MailCheck,
  Paperclip,
  Receipt,
  Plus,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Vendor, ReferralLink } from '@/types/vendor';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';
import {
  buildVentaStatuses,
  deriveAdminEmailStatus,
  deriveCustomerConfirmationEmailStatus,
  deriveVoucherStatus,
  ventaStatusLabel,
} from '@/lib/sales/status';

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

type PaymentMovementType = 'payment' | 'extra' | 'discount' | 'refund' | 'adjustment';

type PaymentFormState = {
  movementType: PaymentMovementType;
  amount: string;
  method: string;
  reference: string;
  message: string;
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

const statusBadgeVariant: Record<ReservationStatus, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  pending: 'outline',
  reserved: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

const emailStatusLabel = (status: string) =>
  status === 'sent'
    ? 'Enviado'
    : status === 'queued'
      ? 'En cola'
      : status === 'sending'
        ? 'Enviando'
        : status === 'failed'
          ? 'Fallido'
          : 'Sin enviar';

const voucherStatusLabel = (status: string) =>
  status === 'sent'
    ? 'Voucher enviado'
    : status === 'generated'
      ? 'Voucher generado'
      : status === 'queued'
        ? 'Voucher en cola'
        : status === 'failed'
          ? 'Voucher fallido'
          : 'Sin voucher';

const paymentMovementLabels: Record<PaymentMovementType, string> = {
  payment: 'Pago recibido',
  extra: 'Extra',
  discount: 'Descuento',
  refund: 'Reintegro',
  adjustment: 'Ajuste',
};

const paymentMethodLabels: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  admin: 'Manual',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

const reservationStatusText = (status: ReservationStatus): string =>
  reservationStatusOptions.find((option) => option.value === status)?.label ?? status;

const normalizePaymentMovementType = (payment: ReservaPaymentEvent): PaymentMovementType => {
  const value = String(payment.movementType ?? '').trim().toLowerCase();
  if (value === 'extra' || value === 'discount' || value === 'refund' || value === 'adjustment') {
    return value;
  }
  return 'payment';
};

const paymentMethodLabel = (value: string | null | undefined): string => {
  const key = String(value ?? '').trim().toLowerCase();
  return paymentMethodLabels[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sin definir');
};

const paymentDateLabel = (payment: ReservaPaymentEvent): string =>
  formatDateTime(payment.occurredAt ?? payment.createdAt);

const roomTypeLabel = (value: string | null | undefined): string => {
  if (value === 'matrimonial') return 'Matrimonial';
  if (value === 'twin') return 'Twin';
  if (value === 'full-day') return 'Full day';
  return '—';
};

const moneyInputToCents = (value: string): number => {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
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
  const [payments, setPayments] = useState<ReservaPaymentEvent[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>('');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [referralLinksLoading, setReferralLinksLoading] = useState(false);
  const [selectedReferralCode, setSelectedReferralCode] = useState<string>('');
  const [manualReferralCode, setManualReferralCode] = useState<string>('');
  const [updatingReferral, setUpdatingReferral] = useState(false);
  const [savingPaymentEvent, setSavingPaymentEvent] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    movementType: 'payment',
    amount: '',
    method: 'transfer',
    reference: '',
    message: '',
  });

  const loadReserva = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) setLoading(true);
    try {
      const data = await getReservaById(params.id);
      if (!data) {
        toast.error('Venta no encontrada');
        router.replace('/admin/ventas');
        return;
      }
      setReserva(data);
      setStatus(data.status);
      setAttachments(data.attachments ?? []);
      setPaymentsLoading(true);
      const pay = await getReservaPayments(params.id, { limit: 50 });
      setPayments(pay);
    } catch (error) {
      console.error('Error cargando venta:', error);
      toast.error('No pudimos cargar la venta');
    } finally {
      if (options.showLoading) setLoading(false);
      setPaymentsLoading(false);
    }
  }, [params.id, router]);

  const ventaStatuses = useMemo(() => (reserva ? buildVentaStatuses(reserva) : null), [reserva]);
  const paymentsCurrency = useMemo(() => {
    const first = payments.find((p) => typeof p.currency === 'string' && p.currency.trim());
    return String(first?.currency ?? reserva?.currency ?? 'ars');
  }, [payments, reserva?.currency]);
  const referralLinksForReservation = useMemo(() => {
    const packageId = String(reserva?.packageId ?? reserva?.experienceId ?? '').trim();
    if (!packageId) return referralLinks;
    return referralLinks.filter((link) => {
      const linkPackageId = String(link.packageId ?? link.experienceId ?? '').trim();
      return !linkPackageId || linkPackageId === packageId;
    });
  }, [referralLinks, reserva?.experienceId, reserva?.packageId]);
  const paymentSummary = useMemo(() => {
    const baseTotal = Number(reserva?.amountTotal ?? 0);
    let totalPaid = 0;
    let totalAdjustments = 0;
    for (const payment of payments) {
      const movementType = normalizePaymentMovementType(payment);
      const amount = Math.max(0, Number(payment.amount ?? 0));
      if (movementType === 'payment') totalPaid += amount;
      if (movementType === 'refund') totalPaid -= amount;
      if (movementType === 'extra' || movementType === 'adjustment') totalAdjustments += amount;
      if (movementType === 'discount') totalAdjustments -= amount;
    }
    const billedTotal = Math.max(0, baseTotal + totalAdjustments);
    const balance = billedTotal - totalPaid;
    return { baseTotal, totalAdjustments, billedTotal, totalPaid, balance };
  }, [payments, reserva?.amountTotal]);

  useEffect(() => {
    loadReserva({ showLoading: true });
  }, [loadReserva]);

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
      setSelectedReferralCode('');
      setManualReferralCode('');
      setReferralLinks([]);
      return;
    }
    setVendorId(reserva.referredBy.vendorId ?? '');
    setSelectedReferralCode(reserva.referredBy.code ?? '');
    setManualReferralCode('');
  }, [reserva?.referredBy]);

  useEffect(() => {
    let cancelled = false;
    const loadLinks = async () => {
      if (!vendorId) {
        setReferralLinks([]);
        setReferralLinksLoading(false);
        return;
      }
      setReferralLinksLoading(true);
      try {
        const links = await getReferralLinksByVendor(vendorId);
        if (!cancelled) setReferralLinks(links);
      } catch {
        if (!cancelled) setReferralLinks([]);
      } finally {
        if (!cancelled) setReferralLinksLoading(false);
      }
    };
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!selectedReferralCode || referralLinksLoading) return;
    const exists = referralLinksForReservation.some((link) => link.code === selectedReferralCode);
    const currentAssignedCode = String(reserva?.referredBy?.code ?? '').trim();
    if (!exists && selectedReferralCode !== currentAssignedCode) setSelectedReferralCode('');
  }, [referralLinksForReservation, referralLinksLoading, reserva?.referredBy?.code, selectedReferralCode]);

  const fetchStockInfo = useCallback(async () => {
    const packageId = String(reserva?.packageId ?? reserva?.experienceId ?? '').trim();
    const date = String(reserva?.date ?? '').trim();
    if (!reserva || !user || !packageId || !date || date === 'sin-fecha') {
      setStockSummary(null);
      return;
    }
    setStockLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/stock?packageId=${encodeURIComponent(packageId)}&date=${encodeURIComponent(date)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        setStockSummary(null);
        return;
      }
      const data = await response.json();
      setStockSummary(data);
    } catch {
      setStockSummary(null);
    } finally {
      setStockLoading(false);
    }
  }, [reserva, user]);

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
          setManualHistory([]);
          return;
        }
        const payload = await response.json();
        setManualHistory(payload.reservations ?? []);
      } catch {
        setManualHistory([]);
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
    const manualCode = manualReferralCode.trim();
    const suggestedCode = selectedReferralCode.trim();
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
        if (manualCode) {
          body.referralCode = manualCode;
        } else if (suggestedCode) {
          body.referralCode = suggestedCode;
        }
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

  const handleAddPaymentEvent = async () => {
    if (!reserva || !user) return;
    const amount = moneyInputToCents(paymentForm.amount);
    if (!amount) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!paymentForm.message.trim()) {
      toast.error('Ingresá un detalle del movimiento');
      return;
    }

    setSavingPaymentEvent(true);
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
          addPaymentEvent: {
            movementType: paymentForm.movementType,
            amount,
            currency: reserva.currency,
            method: paymentForm.method,
            reference: paymentForm.reference.trim() || undefined,
            message: paymentForm.message.trim(),
          },
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo registrar el movimiento');
      }
      toast.success('Movimiento registrado');
      setPaymentForm({
        movementType: 'payment',
        amount: '',
        method: 'transfer',
        reference: '',
        message: '',
      });
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error registrando movimiento financiero:', error);
      toast.error('No pudimos registrar el movimiento');
    } finally {
      setSavingPaymentEvent(false);
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

  const enqueueEmail = async (type: 'customer' | 'admin') => {
    if (!reserva || !user) return;
    try {
      setStatusUpdating(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          ...(type === 'customer'
            ? { enqueueCustomerVoucherEmail: true }
            : { enqueueAdminNotificationEmail: true }),
        }),
      });
      if (!response.ok) throw new Error('No se pudo encolar el email');
      toast.success(type === 'customer' ? 'Voucher reencolado' : 'Aviso interno reencolado');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error reenviando email:', error);
      toast.error('No pudimos encolar el email');
    } finally {
      setStatusUpdating(false);
    }
  };

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
  const reservationLabel = reserva.packageTitle || reserva.experienceTitle || 'Reserva confirmada';
  const reservationCode = String((reserva as any).reservationCode ?? '').trim();
  const pickupPointLabel = String((reserva as any).pickupPoint ?? '').trim();
  const pickupPointTimeLabel = String((reserva as any).pickupPointTime ?? '').trim();
  const selectedExtras = Array.isArray((reserva as any).selectedExtras)
    ? (reserva as any).selectedExtras.filter((item: any) => String(item?.label ?? '').trim().length > 0)
    : [];
  const passengerDetails = Array.isArray((reserva as any).passengerDetails)
    ? (reserva as any).passengerDetails
    : [];
  const paymentRows = payments
    .slice()
    .sort((a, b) => toTimestampMs(b.occurredAt ?? b.createdAt) - toTimestampMs(a.occurredAt ?? a.createdAt));

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pb-10 pt-6 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Venta</p>
              <h1 className="text-xl font-semibold text-gray-900 sm:text-[22px]">{reservationLabel}</h1>
              <p className="text-xs text-gray-600 sm:text-sm">
                {reservationCode ? `Código de reserva ${reservationCode}` : 'Código pendiente de asignación'}
              </p>
              <p className="text-xs text-gray-500 sm:text-sm">
                {reserva.date === 'sin-fecha'
                  ? 'Fecha a coordinar'
                  : `${formatDate(reserva.date)} · ${reserva.people} persona${reserva.people !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Badge variant={statusBadgeVariant[statusLabel]} className="capitalize">
              {ventaStatuses?.commercialStatusLabel ?? ventaStatusLabel(statusLabel)}
            </Badge>
          </div>

          <section className="grid gap-4 rounded-3xl bg-white/90 px-4 py-4 shadow-lg ring-1 ring-black/5 sm:grid-cols-2 sm:px-5">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Resumen operativo</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm font-medium text-gray-900">
                      {reserva.date === 'sin-fecha' ? 'A coordinar' : formatDate(reserva.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pasajeros</p>
                    <p className="text-sm font-medium text-gray-900">
                      {reserva.people} persona{reserva.people !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cliente</p>
                    <p className="text-sm font-medium text-gray-900">{reserva.customerName || 'Sin nombre'}</p>
                    <p className="text-xs text-gray-500">{reserva.customerEmail || 'Sin email'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cobranza</p>
                    <p className="text-sm font-medium text-gray-900">
                      {paymentSummary.balance > 0
                        ? `Saldo pendiente ${formatAmount(paymentSummary.balance, reserva.currency)}`
                        : paymentSummary.balance < 0
                          ? `Saldo a favor ${formatAmount(Math.abs(paymentSummary.balance), reserva.currency)}`
                          : 'Al día'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Ascenso</p>
                    <p className="text-sm font-medium text-gray-900">
                      {pickupPointLabel || 'Sin definir'}
                      {pickupPointTimeLabel ? ` · ${pickupPointTimeLabel}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Habitación</p>
                    <p className="text-sm font-medium text-gray-900">
                      {roomTypeLabel((reserva as any).roomType ?? null)}
                    </p>
                  </div>
                </div>
              </div>
              {Array.isArray((reserva as any).selectedSeats) && (reserva as any).selectedSeats.length > 0 ? (
                <div className="rounded-2xl bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Butacas</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{(reserva as any).selectedSeats.join(', ')}</p>
                </div>
              ) : null}
              {selectedExtras.length > 0 ? (
                <div className="rounded-2xl bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Extras</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {selectedExtras.map((item: any) => String(item.label)).join(', ')}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Pasajeros</p>
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    Pasajero 1: {reserva.customerName || 'Sin nombre'}
                  </p>
                  {passengerDetails.map((traveler: any, index: number) => {
                    const fullName = `${String(traveler?.firstName ?? '').trim()} ${String(traveler?.lastName ?? '').trim()}`.trim();
                    return (
                      <p key={index} className="text-sm font-medium text-gray-900">
                        Pasajero {index + 2}: {fullName || 'Sin nombre'}
                      </p>
                    );
                  })}
                </div>
              </div>
              {Array.isArray((reserva as any).selectedSeats) &&
              (reserva as any).selectedSeats.length > 0 &&
              reserva.date !== 'sin-fecha' ? (
                <div className="pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/butacas?packageId=${encodeURIComponent(String(reserva.packageId ?? reserva.experienceId))}&date=${encodeURIComponent(String(reserva.date))}`}>
                      Ver en mapa de butacas
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-4 border-l border-dashed border-black/5 pl-4 sm:border-l sm:pl-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Estado de la venta</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                    <p className="text-xs text-gray-500">Comercial</p>
                    <p className="text-sm font-medium text-gray-900">{ventaStatuses?.commercialStatusLabel ?? '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                    <p className="text-xs text-gray-500">Operativo</p>
                    <p className="text-sm font-medium text-gray-900">{ventaStatuses?.operationalStatusLabel ?? '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                    <p className="text-xs text-gray-500">Medio de cobro</p>
                    <p className="text-sm font-medium text-gray-900">
                      {ventaStatuses?.paymentMethodLabel ?? paymentMethodLabel(reserva.paymentMethod)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                    <p className="text-xs text-gray-500">Estado del pago</p>
                    <p className="text-sm font-medium text-gray-900">{ventaStatuses?.paymentStatusLabel ?? '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Disponibilidad</p>
              </div>
              {stockLoading ? (
                <p className="text-sm text-gray-500">Cargando disponibilidad…</p>
              ) : stockSummary ? (
                <div className="rounded-2xl bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">
                    {stockSummary.available} lugar{stockSummary.available !== 1 ? 'es' : ''} disponible
                    {stockSummary.available !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    Salida base de {stockSummary.baseCapacity} lugar{stockSummary.baseCapacity !== 1 ? 'es' : ''}.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {stockSummary.movements.length > 0
                      ? `${stockSummary.movements.length} movimiento${stockSummary.movements.length !== 1 ? 's' : ''} registrado${stockSummary.movements.length !== 1 ? 's' : ''} recientemente.`
                      : 'Sin movimientos recientes.'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay disponibilidad asociada a esta salida.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Comunicación</p>
                <h2 className="text-base font-semibold text-gray-900">Voucher y emails</h2>
                <p className="text-xs text-gray-500 sm:text-sm">Seguimiento del envío automático y reintentos manuales de esta venta.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={statusUpdating} onClick={() => enqueueEmail('customer')}>
                  <MailCheck className="mr-2 h-4 w-4" />
                  Reenviar voucher
                </Button>
                <Button size="sm" variant="outline" disabled={statusUpdating} onClick={() => enqueueEmail('admin')}>
                  <Mail className="mr-2 h-4 w-4" />
                  Avisar al admin
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-black/5 bg-gray-50/80 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  <MailCheck className="h-3.5 w-3.5" />
                  Email confirmación
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 sm:text-base">
                  {emailStatusLabel(ventaStatuses?.customerConfirmationEmailStatus ?? deriveCustomerConfirmationEmailStatus(reserva))}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {reserva.emailDelivery?.customerConfirmation?.error || 'Confirmación inmediata de compra.'}
                </div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50/80 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  <Receipt className="h-3.5 w-3.5" />
                  Voucher 48 hs
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 sm:text-base">{voucherStatusLabel(ventaStatuses?.voucherStatus ?? deriveVoucherStatus(reserva))}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {reserva.voucherSentAt
                    ? `Enviado: ${formatDateTime(reserva.voucherSentAt)}`
                    : reserva.voucherScheduledAt
                      ? `Programado: ${formatDateTime(reserva.voucherScheduledAt)}`
                      : 'Sin programación confirmada.'}
                </div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50/80 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  <Mail className="h-3.5 w-3.5" />
                  Email interno
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 sm:text-base">{emailStatusLabel(ventaStatuses?.adminEmailStatus ?? deriveAdminEmailStatus(reserva))}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {reserva.emailDelivery?.adminNotification?.error || 'Notificación operativa para el panel interno.'}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Canal comercial</p>
                <h2 className="text-base font-semibold text-gray-900">
                  {reserva.referredBy?.vendorName ?? 'Sin vendedor asignado'}
                </h2>
                <p className="text-xs text-gray-500">
                  {reserva.referredBy?.code
                    ? `Código activo: ${reserva.referredBy.code}`
                    : reserva.referredBy
                      ? 'Asignación manual'
                      : 'Podés vincular esta venta a un vendedor o código'}
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
                  onValueChange={(value) => {
                    const nextVendorId = value === 'none' ? '' : value;
                    setVendorId(nextVendorId);
                    setSelectedReferralCode('');
                    setManualReferralCode('');
                  }}
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
                <Label className="text-xs font-medium text-gray-600">Código sugerido</Label>
                <Select
                  value={selectedReferralCode || 'none'}
                  onValueChange={(value) => {
                    setSelectedReferralCode(value === 'none' ? '' : value);
                    setManualReferralCode('');
                  }}
                  disabled={!vendorId || referralLinksForReservation.length === 0 || referralLinksLoading || updatingReferral}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí un código" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin código</SelectItem>
                    {referralLinksForReservation.map((link) => (
                      <SelectItem key={link.id} value={link.code}>
                        {link.code} {link.experienceName ? `· ${link.experienceName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {referralLinksLoading ? (
                  <p className="text-[11px] text-gray-500">Cargando códigos disponibles…</p>
                ) : !vendorId ? (
                  <p className="text-[11px] text-gray-500">Primero elegí un vendedor.</p>
                ) : referralLinksForReservation.length === 0 ? (
                  <p className="text-[11px] text-gray-500">Ese vendedor no tiene códigos activos para este paquete.</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Código manual</Label>
                <Input
                  value={manualReferralCode}
                  onChange={(event) => {
                    setManualReferralCode(event.target.value);
                    if (event.target.value.trim()) setSelectedReferralCode('');
                  }}
                  placeholder="Ingresá un código exacto"
                  disabled={updatingReferral}
                />
                <p className="text-[11px] text-gray-500">
                  Si cargás un código manual, se valida para este paquete y reemplaza al sugerido.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  disabled={updatingReferral || (!vendorId && !selectedReferralCode && !manualReferralCode.trim())}
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
                    Cancelar vínculo
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                La comisión se recalcula automáticamente según el vendedor y el estado actual de la venta.
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

          <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Cobranza</p>
                <h2 className="text-base font-semibold text-gray-900">Resumen financiero</h2>
                <p className="text-xs text-gray-500 sm:text-sm">Movimientos de cobro, ajustes y saldo de la reserva.</p>
              </div>
              <Badge
                variant={paymentSummary.balance > 0 ? 'outline' : 'default'}
                className="capitalize"
              >
                {paymentSummary.balance > 0
                  ? 'Saldo pendiente'
                  : paymentSummary.balance < 0
                    ? 'Saldo a favor'
                    : 'Saldo conciliado'}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                <p className="text-xs text-gray-500">Venta base</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatAmount(paymentSummary.baseTotal, reserva.currency)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                <p className="text-xs text-gray-500">Ajustes</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {paymentSummary.totalAdjustments === 0
                    ? 'Sin cambios'
                    : `${paymentSummary.totalAdjustments > 0 ? '+' : '-'}${formatAmount(Math.abs(paymentSummary.totalAdjustments), reserva.currency)}`}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                <p className="text-xs text-gray-500">Total a cobrar</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatAmount(paymentSummary.billedTotal, reserva.currency)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50/80 px-4 py-3">
                <p className="text-xs text-gray-500">Cobrado</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatAmount(paymentSummary.totalPaid, paymentsCurrency)}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Saldo actual</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {paymentSummary.balance > 0
                  ? `${formatAmount(paymentSummary.balance, reserva.currency)} pendiente`
                  : paymentSummary.balance < 0
                    ? `${formatAmount(Math.abs(paymentSummary.balance), reserva.currency)} a favor`
                    : 'Sin saldo pendiente'}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-black/5 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Historial financiero</p>
                    <p className="text-sm font-semibold text-gray-900">Movimientos registrados</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {paymentsLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
                    <Badge variant="outline" className="text-[11px] text-gray-600">
                      {paymentRows.length}
                    </Badge>
                  </div>
                </div>

                {paymentsLoading ? (
                  <div className="mt-3 space-y-2">
                    <div className="h-10 w-full animate-pulse rounded-xl bg-gray-100" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-gray-100" />
                  </div>
                ) : paymentRows.length === 0 ? (
                  <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-600">
                    No hay movimientos registrados para esta venta.
                  </div>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-black/5">
                    <div className="grid grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr] gap-3 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      <span>Fecha</span>
                      <span>Concepto</span>
                      <span>Medio</span>
                      <span className="text-right">Monto</span>
                    </div>
                    <div className="divide-y divide-black/5 bg-white">
                      {paymentRows.map((payment) => {
                        const movementType = normalizePaymentMovementType(payment);
                        const sign = movementType === 'discount' || movementType === 'refund' ? '-' : '+';
                        const amountClass =
                          movementType === 'discount' || movementType === 'refund'
                            ? 'text-rose-600'
                            : movementType === 'extra' || movementType === 'adjustment'
                              ? 'text-amber-600'
                              : 'text-emerald-600';
                        return (
                          <div
                            key={payment.id}
                            className="grid grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm text-gray-700"
                          >
                            <div className="min-w-0">
                              <p className="mt-1 text-sm font-semibold text-gray-900">{paymentDateLabel(payment)}</p>
                              <p className="text-xs text-gray-500">
                                {payment.source === 'manual' ? 'Carga manual' : 'Registro automático'}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="mt-1 text-sm font-semibold text-gray-900">{paymentMovementLabels[movementType]}</p>
                              <p className="truncate text-xs text-gray-500">
                                {payment.message || 'Sin detalle'}
                                {payment.reference ? ` · Ref. ${payment.reference}` : ''}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="mt-1 text-sm font-semibold text-gray-900">{paymentMethodLabel(payment.method)}</p>
                              <p className="text-xs text-gray-500">{String(payment.status || 'registrado')}</p>
                            </div>
                            <div className={`text-right font-semibold ${amountClass}`}>
                              {sign}
                              {formatAmount(Number(payment.amount ?? 0), String(payment.currency ?? reserva.currency))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Agregar movimiento</p>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Tipo</Label>
                    <Select
                      value={paymentForm.movementType}
                      onValueChange={(value) =>
                        setPaymentForm((current) => ({ ...current, movementType: value as PaymentMovementType }))
                      }
                      disabled={savingPaymentEvent}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentMovementLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Monto</Label>
                      <Input
                        value={paymentForm.amount}
                        onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="0,00"
                        disabled={savingPaymentEvent}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Medio</Label>
                      <Select
                        value={paymentForm.method}
                        onValueChange={(value) => setPaymentForm((current) => ({ ...current, method: value }))}
                        disabled={savingPaymentEvent}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="card">Tarjeta</SelectItem>
                          <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                          <SelectItem value="admin">Manual</SelectItem>
                          <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Referencia</Label>
                    <Input
                      value={paymentForm.reference}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                      placeholder="Factura, transferencia, caja, cupón"
                      disabled={savingPaymentEvent}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Detalle</Label>
                    <Textarea
                      value={paymentForm.message}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, message: event.target.value }))}
                      placeholder="Ej. pago parcial por transferencia, descuento comercial, extra por servicio adicional"
                      className="min-h-[96px] rounded-2xl border border-black/10 bg-white"
                      disabled={savingPaymentEvent}
                    />
                  </div>
                  <Button size="sm" variant="success" disabled={savingPaymentEvent} onClick={handleAddPaymentEvent}>
                    {savingPaymentEvent ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar movimiento
                      </>
                    )}
                  </Button>
                </div>
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

          <section className="space-y-4 rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Control de estado</p>
                <p className="text-xs text-gray-500 sm:text-sm">Los cambios quedan registrados en el historial.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-[#DC2626] text-white shadow-[0_8px_18px_rgba(220,38,38,0.22)] hover:bg-[#B91C1C]"
                  onClick={handleCancelReservation}
                  disabled={statusUpdating}
                >
                  Cancelar venta
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
            <div className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Timeline de la venta</p>
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
                            {reservationStatusText(entry.status)}
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

            <div className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Cliente</p>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p className="text-base font-semibold text-gray-900">{reserva.customerName || '—'}</p>
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
                {(reserva as any).customerBirthDate && (
                  <p className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Nacimiento: {String((reserva as any).customerBirthDate)}
                  </p>
                )}
                {reserva.customerComments && (
                  <p className="text-sm text-gray-700">{reserva.customerComments}</p>
                )}
                {passengerDetails.length > 0 ? (
                  <div className="rounded-2xl border border-black/5 bg-gray-50/80 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Pasajeros</p>
                    <div className="mt-3 space-y-2">
                      {passengerDetails.map((traveler: any, index: number) => (
                        <div key={`traveler-${index}`} className="rounded-2xl bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-black/5">
                          <p className="font-medium text-gray-900">
                            {traveler.firstName || '—'} {traveler.lastName || ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            {traveler.birthDate ? `Nacimiento ${traveler.birthDate}` : 'Nacimiento sin dato'}
                            {traveler.document ? ` · DNI ${traveler.document}` : ''}
                            {traveler.phone ? ` · ${traveler.phone}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Registro</p>
            <p className="mt-2 text-xs text-gray-600 sm:text-sm">
              {`Creada el ${formatDateTime(reserva.createdAt)}.`}
            </p>
            {reserva.updatedAt && (
              <p className="text-xs text-gray-500 sm:text-sm">
                Última modificación: {formatDateTime(reserva.updatedAt)}
              </p>
            )}
          </section>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
