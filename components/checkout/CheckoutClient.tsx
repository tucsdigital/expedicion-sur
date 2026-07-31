'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Lock, Loader2, ShieldCheck } from 'lucide-react';
import type { Experience } from '@/components/landing-reserva/types';

const STRIPE_PURPLE = '#635BFF';
const PIX_GREEN = '#00C389';

/** Logo Stripe oficial (wordmark) */
const StripeLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="60" height="25" fill="none" viewBox="0 0 60 25" className="shrink-0" aria-label="Logotipo de Stripe">
    <path fill="currentColor" fillRule="evenodd" d="M59.6444 14.2813h-8.062c.1843 1.9296 1.5983 2.5476 3.2032 2.5476 1.6352 0 2.9534-.3656 4.0453-.9506v3.3179c-1.1186.7115-2.5964 1.1068-4.5645 1.1068-4.011 0-6.8218-2.5122-6.8218-7.4783 0-4.19441 2.3837-7.52509 6.3017-7.52509 3.912 0 5.9537 3.28038 5.9537 7.49819 0 .3982-.0372 1.261-.0556 1.4835Zm-5.9241-5.62407c-1.0294 0-2.1739.72812-2.1739 2.58387h4.2573c0-1.85362-1.0721-2.58387-2.0834-2.58387ZM40.9547 20.303c-1.4411 0-2.322-.6087-2.9133-1.0417l-.0088 4.6271-4.1181.8755-.0014-19.19053h3.7543l.0864 1.01784c.6035-.52914 1.6114-1.29157 3.2256-1.29162 2.8925 0 5.6162 2.6052 5.6162 7.39971 0 5.2327-2.6948 7.6037-5.6409 7.6037Zm-.959-11.35573c-.9453 0-1.5376.34559-1.9669.81586l.0245 6.11967c.3997.433.9763.7813 1.9424.7813 1.5231 0 2.5437-1.6575 2.5437-3.8745 0-2.1544-1.037-3.84233-2.5437-3.84233Zm-11.7602-3.3739h4.1341V20.0088h-4.1341V5.57337Zm0-4.694699L32.3696 0v3.35821l-4.1341.87868V.878671ZM23.9198 10.2223v9.7861h-4.1156V5.57296h3.6867l.1317 1.21751c1.0035-1.7722 3.0722-1.41321 3.6209-1.21594v3.78524c-.5242-.16908-2.2894-.42779-3.3237.86253Zm-8.5525 4.7221c0 2.4275 2.5988 1.6719 3.1263 1.4609v3.3522c-.5492.3013-1.5437.5458-2.8901.5458-2.4441 0-4.2773-1.7999-4.2773-4.2379l.0173-13.17658 4.0206-.85464.0032 3.5395h3.1278V9.0857h-3.1278v5.8588-.0001Zm-4.9069.7026c0 2.9645-2.31051 4.6562-5.73464 4.6562-1.41958 0-2.92289-.2761-4.453935-.9347v-3.9319c1.382085.7516 3.093705 1.315 4.457755 1.315.91864 0 1.53106-.2459 1.53106-1.0069C6.26064 13.7786 0 14.5192 0 9.95995 0 7.04457 2.27622 5.2998 5.61655 5.2998c1.36404 0 2.72806.20934 4.09208.75351V9.9317c-1.25265-.67618-2.84332-1.05979-4.09588-1.05979-.86296 0-1.44753.24965-1.44753.8924.0001 1.85329 6.29518.97249 6.29518 5.88279v-.0001Z" clipRule="evenodd" />
  </svg>
);

/** Logo PIX (Banco Central do Brasil - palabra marca oficial) */
const PixLogo = () => (
  <span className="font-extrabold uppercase tracking-wider text-inherit" style={{ letterSpacing: '0.12em', fontSize: '1.1em' }} aria-hidden>
    Pix
  </span>
);

const getSiteUrl = () =>
  typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? '';

/** Formatea monto según moneda (ars, brl, usd). */
function formatAmount(amount: number, currency: string): string {
  const n = amount.toLocaleString('es-AR', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  if (currency === 'brl') return `R$ ${n}`;
  if (currency === 'usd') return `USD ${n}`;
  return `$ ${n}`;
}

type CheckoutClientProps = {
  experience: Experience;
  date: string;
  people: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 2;
const PHONE_MIN_LENGTH = 8;

const CHECKOUT_STORAGE_PREFIX = 'checkout_form_';

function getCheckoutStorageKey(slug: string, date: string, people: number) {
  return `${CHECKOUT_STORAGE_PREFIX}${slug}_${date}_${people}`;
}

export default function CheckoutClient({ experience, date, people }: CheckoutClientProps) {
  const storageKey = getCheckoutStorageKey(experience.slug, date, people);
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, email: false, phone: false });
  const [form, setForm] = useState({
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    customerPhone: '',
    customerCountry: '',
    customerDocument: '',
    customerComments: '',
  });
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof form>;
        setForm((prev) => ({
          ...prev,
          ...(parsed.customerFirstName != null && { customerFirstName: String(parsed.customerFirstName) }),
          ...(parsed.customerLastName != null && { customerLastName: String(parsed.customerLastName) }),
          ...(parsed.customerEmail != null && { customerEmail: String(parsed.customerEmail) }),
          ...(parsed.customerPhone != null && { customerPhone: String(parsed.customerPhone) }),
          ...(parsed.customerCountry != null && { customerCountry: String(parsed.customerCountry) }),
          ...(parsed.customerDocument != null && { customerDocument: String(parsed.customerDocument) }),
          ...(parsed.customerComments != null && { customerComments: String(parsed.customerComments) }),
        }));
      }
    } catch {
      // ignore invalid JSON
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(form));
    } catch {
      // ignore quota / private mode
    }
  }, [restored, storageKey, form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
      setReferralCode(code && code.trim() ? code.trim() : null);
    } catch {
      setReferralCode(null);
    }
  }, []);

  const bc = experience.bookingConfig;
  const paymentMethodsFromConfig = bc?.paymentMethods;
  const hasStripe = paymentMethodsFromConfig
    ? !!paymentMethodsFromConfig.stripe
    : (experience.paymentMethods?.length ? experience.paymentMethods.includes('stripe') : true);
  const hasPix = paymentMethodsFromConfig
    ? !!paymentMethodsFromConfig.pix
    : !!(experience.paymentMethods?.includes('pix'));

  const unitPrice = typeof bc?.depositAmount === 'number' ? bc.depositAmount : (typeof experience.price === 'number' ? experience.price : 0);
  const total = unitPrice * people;
  const currency = (bc?.currency === 'brl' || bc?.currency === 'usd') ? bc.currency : 'ars';
  const dateLabel =
    date && date !== 'sin-fecha'
      ? new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Sin fecha específica (a coordinar)';

  const firstNameError = touched.firstName && form.customerFirstName.trim().length < NAME_MIN_LENGTH;
  const lastNameError = touched.lastName && form.customerLastName.trim().length < NAME_MIN_LENGTH;
  const emailError = touched.email && (!form.customerEmail.trim() || !EMAIL_REGEX.test(form.customerEmail.trim()));
  const phoneError = touched.phone && form.customerPhone.trim().length > 0 && form.customerPhone.trim().length < PHONE_MIN_LENGTH;

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, email: true, phone: true });
    const firstName = form.customerFirstName.trim();
    const lastName = form.customerLastName.trim();
    const email = form.customerEmail.trim();
    const phone = form.customerPhone.trim();

    if (!firstName || firstName.length < NAME_MIN_LENGTH) {
      setError('Ingresá tu nombre (mínimo 2 caracteres).');
      return;
    }
    if (!lastName || lastName.length < NAME_MIN_LENGTH) {
      setError('Ingresá tu apellido (mínimo 2 caracteres).');
      return;
    }
    if (!email) {
      setError('El email es obligatorio.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Ingresá un email válido.');
      return;
    }
    if (phone && phone.length < PHONE_MIN_LENGTH) {
      setError('Si ingresás teléfono, debe tener al menos 8 caracteres.');
      return;
    }
    setError(null);
    setStep('payment');
  };

  const createCheckoutSession = async (paymentMethod: 'stripe' | 'pix') => {
    setError(null);
    setIsLoading(true);
    try {
      // Revalidar disponibilidad antes de crear sesión (evitar overbooking)
      if (date && date !== 'sin-fecha') {
        try {
          const availRes = await fetch(`/api/experiencias/${encodeURIComponent(experience.slug)}/availability?date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(people))}`);
          if (!availRes.ok) {
            const d = await availRes.json().catch(() => ({}));
            throw new Error(d?.error || 'No se pudo verificar disponibilidad.');
          }
          const availData = await availRes.json();
          if (!availData.ok) {
            throw new Error(`No hay cupo suficiente. Disponible: ${availData.available ?? 0}.`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error verificando disponibilidad.');
          setIsLoading(false);
          return;
        }
      }
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: experience.slug,
          experienceId: experience.id,
          date,
          people,
          paymentMethod,
          customerEmail: form.customerEmail.trim(),
          customerName: `${form.customerFirstName.trim()} ${form.customerLastName.trim()}`.trim(),
          customerPhone: form.customerPhone.trim() || undefined,
          customerCountry: form.customerCountry.trim() || undefined,
          customerDocument: form.customerDocument.trim() || undefined,
          customerComments: form.customerComments.trim() || undefined,
          ...(referralCode ? { referralCode } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo crear la sesión de pago.');
      }

      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No se recibió URL de pago.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayStripe = () => createCheckoutSession('stripe');
  const handlePayPix = () => createCheckoutSession('pix');

  // (No QR flow) Volvemos al flujo anterior que redirige a Stripe Checkout para PIX o tarjeta.

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Security banner */}
        <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50/80 py-2.5 text-sm text-green-800">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">Conexión segura</span>
          <span className="text-green-700">· Tus datos están protegidos</span>
        </div>

        <Link
          href={`/experiencias/${experience.slug}`}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a {experience.title}
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Checkout</h1>
          <p className="mt-2 text-base text-gray-600">
            {experience.title} · {dateLabel} · {people} {people === 1 ? 'persona' : 'personas'}
          </p>
          {date === 'sin-fecha' && (
            <p className="mt-1.5 text-sm text-amber-700">La fecha se coordina después de la reserva.</p>
          )}
        </header>

        {/* Progress */}
        <div className="mb-8 flex items-center gap-2 text-sm">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${step === 'form' ? 'bg-primary text-white' : 'bg-green-600 text-white'}`}>
            {step === 'form' ? '1' : <Lock className="h-4 w-4" />}
          </span>
          <span className="text-gray-500">—</span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${step === 'payment' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            2
          </span>
          <span className="ml-2 text-gray-600">
            {step === 'form' ? 'Datos personales' : 'Método de pago'}
          </span>
        </div>

        <div className="space-y-6">
          {/* Resumen */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-900">Resumen de la reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Experiencia</span>
                <span className="font-medium text-gray-900">{experience.title}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Fecha</span>
                <span className="font-medium text-gray-900 capitalize">{dateLabel}</span>
              </div>
              {unitPrice > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Precio unitario (reserva por persona)</span>
                  <span className="font-medium text-gray-900">{formatAmount(unitPrice, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Personas</span>
                <span className="font-medium text-gray-900">{people}</span>
              </div>
              {total > 0 && (
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-900">
                  <span>Total a pagar</span>
                  <span>{formatAmount(total, currency)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {step === 'form' ? (
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Datos personales</CardTitle>
                <p className="text-sm text-gray-600">
                  Solo los usamos para la reserva y el contacto. No compartimos tu información con terceros.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitForm} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <Label htmlFor="customerFirstName" className="text-gray-700">
                        Nombre <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerFirstName"
                        name="customerFirstName"
                        type="text"
                        autoComplete="given-name"
                        value={form.customerFirstName}
                        onChange={(e) => setForm((f) => ({ ...f, customerFirstName: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                        placeholder="Ej: María"
                        className="mt-2 h-11"
                        required
                        aria-invalid={firstNameError}
                        aria-describedby={firstNameError ? 'firstName-error' : undefined}
                      />
                      {firstNameError && (
                        <p id="firstName-error" className="mt-1.5 text-sm text-red-600" role="alert">
                          Mínimo 2 caracteres.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customerLastName" className="text-gray-700">
                        Apellido <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerLastName"
                        name="customerLastName"
                        type="text"
                        autoComplete="family-name"
                        value={form.customerLastName}
                        onChange={(e) => setForm((f) => ({ ...f, customerLastName: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                        placeholder="Ej: García"
                        className="mt-2 h-11"
                        required
                        aria-invalid={lastNameError}
                        aria-describedby={lastNameError ? 'lastName-error' : undefined}
                      />
                      {lastNameError && (
                        <p id="lastName-error" className="mt-1.5 text-sm text-red-600" role="alert">
                          Mínimo 2 caracteres.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customerEmail" className="text-gray-700">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerEmail"
                        name="customerEmail"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={form.customerEmail}
                        onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        placeholder="tu@email.com"
                        className="mt-2 h-11"
                        required
                        aria-invalid={emailError}
                        aria-describedby={emailError ? 'email-error' : undefined}
                      />
                      {emailError && (
                        <p id="email-error" className="mt-1.5 text-sm text-red-600" role="alert">
                          Ingresá un email válido.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customerPhone" className="text-gray-700">
                        Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="customerPhone"
                        name="customerPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.customerPhone}
                        onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                        placeholder="+54 11 1234-5678"
                        className="mt-2 h-11"
                        aria-invalid={phoneError}
                        aria-describedby={phoneError ? 'phone-error' : undefined}
                      />
                      {phoneError && (
                        <p id="phone-error" className="mt-1.5 text-sm text-red-600" role="alert">
                          Mínimo 8 caracteres si lo completás.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customerCountry" className="text-gray-700">
                        País / Nacionalidad <span className="text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="customerCountry"
                        name="customerCountry"
                        type="text"
                        autoComplete="country-name"
                        value={form.customerCountry}
                        onChange={(e) => setForm((f) => ({ ...f, customerCountry: e.target.value }))}
                        placeholder="Ej: Argentina"
                        className="mt-2 h-11"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerDocument" className="text-gray-700">
                        DNI o Pasaporte <span className="text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="customerDocument"
                        name="customerDocument"
                        type="text"
                        autoComplete="off"
                        value={form.customerDocument}
                        onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
                        placeholder="Ej: 12.345.678"
                        className="mt-2 h-11"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="customerComments" className="text-gray-700">
                      Comentarios o preferencias <span className="text-gray-400 font-normal">(opcional)</span>
                    </Label>
                    <Textarea
                      id="customerComments"
                      name="customerComments"
                      value={form.customerComments}
                      onChange={(e) => setForm((f) => ({ ...f, customerComments: e.target.value }))}
                      placeholder="Alergias, restricciones alimentarias, punto de encuentro, preferencias para el tour..."
                      className="mt-2 min-h-[88px] resize-y"
                      rows={3}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      Útil para coordinar tu reserva (dieta, lugar de recogida, etc.).
                    </p>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="h-12 w-full rounded-lg text-base font-semibold" size="lg">
                    Continuar al pago
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Método de pago</CardTitle>
                <p className="text-sm text-gray-600">
                  Elegí cómo querés pagar. Serás redirigido al entorno seguro de pago.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 py-3 px-4 text-sm text-red-700" role="alert">
                    {error}
                  </div>
                )}
                <div className="space-y-3">
                  {hasStripe && (
                    <button
                      type="button"
                      onClick={handlePayStripe}
                      disabled={isLoading}
                      className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border-0 text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 [&_svg]:text-white"
                      style={{ backgroundColor: STRIPE_PURPLE }}
                      aria-label="Pagar con Tarjeta"
                    >
                      {isLoading ? (
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <StripeLogo />
                          <span className="ml-2 font-semibold hidden md:inline">Pagar con Tarjeta</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" aria-hidden />
                  <p>
                    Pago procesado de forma segura por <strong>Stripe</strong>. No guardamos los datos de tu tarjeta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="w-full text-center text-sm font-medium text-gray-600 underline-offset-2 hover:underline"
                >
                  Volver a datos personales
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
