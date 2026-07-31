import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail, MessageCircle, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getExperienciaBySlug } from '@/lib/experiencias';
import ClearCheckoutStorage from '@/components/checkout/ClearCheckoutStorage';
import SuccessVerification from '@/components/checkout/SuccessVerification';
import { CONTACT_INFO, SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';

/** Sin caché: datos de experiencia siempre actualizados */
export const revalidate = 0;

type SearchParams = Promise<{
  slug?: string;
  date?: string;
  people?: string;
  sessionId?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
}>;

function formatDateLabel(dateStr: string): string {
  if (!dateStr || dateStr === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number, currency: string | undefined): string {
  if (!currency) return amount ? `$ ${amount.toFixed(2)}` : '—';
  const normalized = currency.toUpperCase();
  const locale =
    normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const slug = params.slug?.trim() || '';
  const date = params.date?.trim() || '';
  const peopleParam = params.people?.trim();
  const sessionId = params.sessionId?.trim() || '';
  const amountParam = params.amount?.trim();
  const amount = amountParam ? parseInt(amountParam, 10) : 0;
  const currency = params.currency?.trim() || 'usd';
  const paymentMethod = params.paymentMethod ? params.paymentMethod.toUpperCase() : 'CARD';
  const people = peopleParam ? parseInt(peopleParam, 10) : 0;
  const peopleLabel =
    people >= 1
      ? people === 1
        ? '1 persona'
        : `${people} personas`
      : '';

  const experience = slug ? await getExperienciaBySlug(slug) : null;
  const title = experience?.title ?? (slug || 'Tu reserva');
  const dateLabel = formatDateLabel(date);
  const whatsappHref = `${SOCIAL_MEDIA.whatsapp}?text=${encodeURIComponent(
    `Hola, acabo de confirmar mi reserva para ${title}. Fecha: ${date === 'sin-fecha' ? 'a coordinar' : date}. ${peopleLabel}. ¿Próximos pasos?`
  )}`;
  const amountLabel = amount ? formatCurrency(amount, currency) : 'Por confirmar';
  const hasSession = Boolean(sessionId);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ClearCheckoutStorage slug={slug} date={date} people={people} />
      <Navbar transparent={false} theme="rio" />
      <div className="container mx-auto max-w-xl px-4 py-12 md:py-20">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle className="h-12 w-12" strokeWidth={2} />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900 md:text-3xl">
              ¡Reserva confirmada!
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Tu pago se procesó correctamente. Estamos confirmando tu reserva y el envío de los emails automáticamente.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Resumen de tu reserva
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{title}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
              <li>
                <span className="font-medium text-gray-500">Fecha:</span>{' '}
                <span className="capitalize">{dateLabel}</span>
              </li>
              {peopleLabel && (
                <li>
                  <span className="font-medium text-gray-500">Personas:</span>{' '}
                  {peopleLabel}
                </li>
              )}
              <li>
                <span className="font-medium text-gray-500">Monto total:</span>{' '}
                {amountLabel}
              </li>
              <li>
                <span className="font-medium text-gray-500">Método de pago:</span>{' '}
                {paymentMethod === 'PIX' ? 'PIX' : 'Tarjeta (Stripe)'}
              </li>
            </ul>
            {!hasSession && (
              <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                No detectamos el identificador de sesión. Si esto sucede, escribinos por WhatsApp
                o mandá un email a {CONTACT_INFO.email} para que lo verifiquemos.
              </p>
            )}
          </div>

          {hasSession && <SuccessVerification sessionId={sessionId} />}

          <div className="mt-8 space-y-4">
            <p className="text-center text-sm font-medium text-gray-700">
              ¿Qué sigue?
            </p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  Revisá tu bandeja de entrada (y spam). Te enviamos un email con toda la información y cómo coordinar los detalles.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <span>
                  Si tenés dudas o querés coordinar horarios, escribinos por WhatsApp. Estamos para ayudarte.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="gap-2">
              <Link href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Escribir por WhatsApp
              </Link>
            </Button>
            {slug && (
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/experiencias/${slug}`}>
                  Ver experiencia
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          {SITE_NAME} · Cualquier consulta: {CONTACT_INFO.email}
        </p>
      </div>
    </div>
  );
}
