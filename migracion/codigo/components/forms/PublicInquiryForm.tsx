'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Tag,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

type FormState = {
  name: string;
  email: string;
  whatsapp: string;
  interest: string;
  travelDate: string;
  travelers: string;
  message: string;
};

const baseInitialState: FormState = {
  name: '',
  email: '',
  whatsapp: '',
  interest: '',
  travelDate: '',
  travelers: '2',
  message: '',
};

export default function PublicInquiryForm({
  compact = false,
  interestOptions = [],
  variant = 'default',
  stretch = false,
}: {
  compact?: boolean;
  interestOptions?: string[];
  variant?: 'default' | 'contact';
  stretch?: boolean;
}) {
  const availableInterestOptions = useMemo(() => {
    const options = Array.from(
      new Set(interestOptions.map((option) => option.trim()).filter(Boolean))
    );

    return [
      ...options,
      'Paquete personalizado',
      'Asesoramiento general',
    ];
  }, [interestOptions]);

  const defaultInterest = availableInterestOptions[0] ?? 'Paquete personalizado';

  const [form, setForm] = useState<FormState>(() => ({
    ...baseInitialState,
    interest: defaultInterest,
  }));
  const [loading, setLoading] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const submitLabel = useMemo(
    () => (variant === 'contact' ? 'Enviar mensaje' : compact ? 'Solicitar asesoramiento' : 'Enviar consulta'),
    [compact, variant]
  );

  useEffect(() => {
    setForm((current) => {
      if (availableInterestOptions.includes(current.interest)) return current;
      return { ...current, interest: defaultInterest };
    });
  }, [availableInterestOptions, defaultInterest]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (variant === 'contact' && !acceptedPolicy) {
      toast.error('Necesitamos tu consentimiento', {
        description: 'Acepta la politica de privacidad para enviarnos tu consulta.',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'No pudimos enviar tu consulta.');
      }

      toast.success('Consulta enviada', {
        description:
          'Recibimos tu mensaje. Te vamos a responder a la brevedad.',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setForm({
        ...baseInitialState,
        interest: defaultInterest,
      });
    } catch (error) {
      toast.error('No se pudo enviar la consulta', {
        description:
          error instanceof Error
            ? error.message
            : 'Intenta nuevamente en unos minutos.',
      });
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const isContactVariant = variant === 'contact';
  const shouldStretch = isContactVariant && stretch;
  const inputBaseClass =
    'h-10 w-full rounded-2xl border bg-white text-[12px] text-neutral-900 outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-[#E30613]/10 md:h-11 md:text-sm';
  const inputClass = isContactVariant
    ? `${inputBaseClass} border-[#E6E0D6] pl-11 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`
    : `${inputBaseClass} border-[rgba(17,17,17,0.08)] px-4`;
  const textareaClass = isContactVariant
    ? 'w-full rounded-[22px] border border-[#E6E0D6] bg-white px-4 py-3 text-[12px] text-neutral-900 outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-[#E30613]/10 md:text-sm'
    : 'w-full rounded-[24px] border border-[rgba(17,17,17,0.08)] bg-white px-4 py-3 text-[12px] text-neutral-900 outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-[#E30613]/10 md:text-sm';

  return (
    <form
      onSubmit={handleSubmit}
      className={
        shouldStretch
          ? 'flex h-full flex-col gap-4 md:gap-5'
          : isContactVariant
            ? 'space-y-3 md:space-y-4'
            : 'space-y-4'
      }
    >
      {isContactVariant && (
        <div className="space-y-2">
          <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-neutral-950 md:text-[24px]">
            Envianos tu consulta
          </h3>
          <p className="text-[12px] leading-5 text-neutral-500 md:text-sm">
            Completa el formulario y te responderemos pronto.
          </p>
        </div>
      )}

      <div className={`grid gap-3 md:gap-3.5 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
        <label className="space-y-2">
          {isContactVariant ? (
            <span className="sr-only">Nombre y apellido</span>
          ) : (
            <span className="text-sm font-medium text-neutral-700">Nombre</span>
          )}
          <div className="relative">
            {isContactVariant && <User className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 md:h-4 md:w-4" />}
            <input
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder={isContactVariant ? 'Nombre y apellido' : 'Tu nombre completo'}
              className={inputClass}
            />
          </div>
        </label>

        <label className="space-y-2">
          {isContactVariant ? (
            <span className="sr-only">Email</span>
          ) : (
            <span className="text-sm font-medium text-neutral-700">Email</span>
          )}
          <div className="relative">
            {isContactVariant && <Mail className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 md:h-4 md:w-4" />}
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder={isContactVariant ? 'Email' : 'reservas@tucorreo.com'}
              className={inputClass}
            />
          </div>
        </label>

        <label className="space-y-2">
          {isContactVariant ? (
            <span className="sr-only">Telefono o WhatsApp</span>
          ) : (
            <span className="text-sm font-medium text-neutral-700">WhatsApp</span>
          )}
          <div className="relative">
            {isContactVariant && <Phone className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 md:h-4 md:w-4" />}
            <input
              required
              value={form.whatsapp}
              onChange={(event) => updateField('whatsapp', event.target.value)}
              placeholder={isContactVariant ? 'Telefono / WhatsApp' : '+54 9 ...'}
              className={inputClass}
            />
          </div>
        </label>

        <label className="space-y-2">
          {isContactVariant ? (
            <span className="sr-only">Tipo de consulta</span>
          ) : (
            <span className="text-sm font-medium text-neutral-700">Experiencia de interes</span>
          )}
          <div className="relative">
            {isContactVariant && <Tag className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 md:h-4 md:w-4" />}
            <select
              value={form.interest}
              onChange={(event) => updateField('interest', event.target.value)}
              className={isContactVariant ? `${inputClass} appearance-none` : inputClass}
            >
              {availableInterestOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>

        {!isContactVariant && (
          <>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Fecha estimada</span>
              <input
                value={form.travelDate}
                onChange={(event) => updateField('travelDate', event.target.value)}
                placeholder="Octubre 2026"
                className={inputClass}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Cantidad de pasajeros</span>
              <input
                value={form.travelers}
                onChange={(event) => updateField('travelers', event.target.value)}
                placeholder="2"
                className={inputClass}
              />
            </label>
          </>
        )}
      </div>

      <label className={`block space-y-2.5 ${shouldStretch ? 'flex-1' : ''}`}>
        {isContactVariant ? (
          <span className="sr-only">Mensaje</span>
        ) : (
          <span className="text-sm font-medium text-neutral-700">Mensaje</span>
        )}
        <div className="relative">
          {isContactVariant && <MessageSquare className="pointer-events-none absolute left-4 top-4 h-3.5 w-3.5 text-neutral-400 md:h-4 md:w-4" />}
          <textarea
            required
            value={form.message}
            onChange={(event) => updateField('message', event.target.value)}
            placeholder={
              isContactVariant
                ? 'Tu mensaje'
                : 'Contanos que tipo de viaje te gustaria hacer y te ayudamos a armarlo.'
            }
            rows={isContactVariant ? 8 : 5}
            className={isContactVariant ? `${textareaClass} pl-11 ${shouldStretch ? 'h-full min-h-[220px] resize-none md:min-h-[260px]' : ''}` : textareaClass}
          />
        </div>
      </label>

      {isContactVariant && (
        <label className="flex items-start gap-3 text-[11px] leading-4.5 text-neutral-500 md:text-[13px] md:leading-5">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(event) => setAcceptedPolicy(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border border-[#D8D1C6] text-[#E30613] focus:ring-[#E30613]/20"
          />
          <span>
            Acepto la{' '}
            <a href="/terminos-condiciones" className="font-medium text-[#E30613] hover:underline">
              Politica de Privacidad
            </a>{' '}
            y el tratamiento de mis datos.
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={loading}
        className={
          isContactVariant
            ? 'mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#E30613] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#c70511] disabled:cursor-not-allowed disabled:opacity-70 md:h-12 md:text-sm md:tracking-[0.16em]'
            : 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-6 text-sm font-semibold text-[#CBBBA0] transition hover:-translate-y-0.5 hover:bg-[#E30613] hover:text-[#CBBBA0] disabled:cursor-not-allowed disabled:opacity-70'
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {submitLabel}
          </>
        )}
      </button>
    </form>
  );
}
