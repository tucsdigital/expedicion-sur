'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, ChevronRight, CreditCard, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import type { Experience } from '@/components/landing-reserva/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArgentineDateInput } from '@/components/ui/argentine-date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getSpanishCountries } from '@/lib/countries';
import type { PeopleBreakdown } from '@/lib/packages/people-categories';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NAME_MIN_LENGTH = 2;
const PHONE_MIN_LENGTH = 8;
const CHECKOUT_STORAGE_PREFIX = 'checkout_form_';

type CheckoutPricing = {
  unitAmountAdults: number;
  unitAmountMinors: number;
  baseSubtotalAmount: number;
  extrasTotalAmount: number;
  subtotalAmount: number;
  currency: string;
};

type CheckoutClientProps = {
  experience: Experience;
  date: string;
  people: number;
  pax?: PeopleBreakdown;
  pricing?: CheckoutPricing;
  initialError?: string | null;
};

type CheckoutStep = 'form' | 'payment';

type CheckoutFormState = {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  customerDocument: string;
  customerBirthDate: string;
  customerNationality: string;
  customerDietaryRestrictions: string;
  customerComments: string;
};

type TravelerFormState = {
  firstName: string;
  lastName: string;
  age: string;
  birthDate: string;
  phone: string;
  document: string;
};

const EMPTY_TRAVELER: TravelerFormState = {
  firstName: '',
  lastName: '',
  age: '',
  birthDate: '',
  phone: '',
  document: '',
};

const PEOPLE_CATEGORY_LABELS: Record<string, string> = {
  adults: 'Adultos',
  minors: 'Menores',
  children: 'Niños',
};

function getSiteUrl() {
  return typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? '';
}

function getCheckoutStorageKey(slug: string, date: string, people: number) {
  return `${CHECKOUT_STORAGE_PREFIX}${slug}_${date}_${people}`;
}

function formatAmount(amount: number, currency: string) {
  const normalized = (currency || 'ars').toUpperCase();
  const locale = normalized === 'USD' ? 'en-US' : normalized === 'BRL' ? 'pt-BR' : 'es-AR';
  const symbol = normalized === 'USD' ? 'US$' : normalized === 'BRL' ? 'R$' : '$';
  return `${symbol} ${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} ${normalized}`;
}

export default function CheckoutClient({ experience, date, people, pax, pricing, initialError }: CheckoutClientProps) {
  const travelerCount = Math.max(1, people);
  const storageKey = getCheckoutStorageKey(experience.slug, date, travelerCount);
  const [step, setStep] = useState<CheckoutStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [passengers, setPassengers] = useState<TravelerFormState[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    phone: false,
    document: false,
    birthDate: false,
    nationality: false,
    dietaryRestrictions: false,
  });
  const [form, setForm] = useState<CheckoutFormState>({
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    customerPhone: '',
    customerDocument: '',
    customerBirthDate: '',
    customerNationality: '',
    customerDietaryRestrictions: '',
    customerComments: '',
  });

  const bookingConfig = experience.bookingConfig as any;
  const currency = pricing?.currency ?? (bookingConfig?.currency === 'usd' || bookingConfig?.currency === 'brl' ? bookingConfig.currency : 'ars');
  const total = pricing?.subtotalAmount ?? 0;
  const extrasTotalAmount = pricing?.extrasTotalAmount ?? 0;
  const dateLabel =
    date && date !== 'sin-fecha'
      ? new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'A coordinar';

  const checkoutExtras = useMemo(() => {
    if (extrasTotalAmount <= 0) {
      return { items: [] as Array<{ label: string; amount: number }> };
    }
    return {
      items: [{ label: 'Gastos administrativos', amount: extrasTotalAmount }],
    };
  }, [extrasTotalAmount]);

  const paxSummary = useMemo(
    () =>
      Object.entries(pax ?? {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => ({ key, label: PEOPLE_CATEGORY_LABELS[key] ?? key, value: Number(value) })),
    [pax]
  );

  const steps = useMemo(
    () => [
      { id: 'form' as const, title: 'Tus datos', icon: User },
      { id: 'payment' as const, title: 'Pago', icon: CreditCard },
    ],
    []
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CheckoutFormState>;
        setForm((prev) => ({
          ...prev,
          ...(parsed.customerFirstName != null && { customerFirstName: String(parsed.customerFirstName) }),
          ...(parsed.customerLastName != null && { customerLastName: String(parsed.customerLastName) }),
          ...(parsed.customerEmail != null && { customerEmail: String(parsed.customerEmail) }),
          ...(parsed.customerPhone != null && { customerPhone: String(parsed.customerPhone) }),
          ...(parsed.customerDocument != null && { customerDocument: String(parsed.customerDocument) }),
          ...(parsed.customerBirthDate != null && { customerBirthDate: String(parsed.customerBirthDate) }),
          ...(parsed.customerNationality != null && { customerNationality: String(parsed.customerNationality) }),
          ...(parsed.customerDietaryRestrictions != null && { customerDietaryRestrictions: String(parsed.customerDietaryRestrictions) }),
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
      // ignore private mode / quota
    }
  }, [form, restored, storageKey]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
      setReferralCode(code && code.trim() ? code.trim() : null);
    } catch {
      setReferralCode(null);
    }
  }, []);

  useEffect(() => {
    const needed = Math.max(0, travelerCount - 1);
    setPassengers((prev) => {
      if (prev.length === needed) return prev;
      return Array.from({ length: needed }, (_, index) => prev[index] ?? { ...EMPTY_TRAVELER });
    });
  }, [travelerCount]);

  const firstNameError = touched.firstName && form.customerFirstName.trim().length < NAME_MIN_LENGTH;
  const lastNameError = touched.lastName && form.customerLastName.trim().length < NAME_MIN_LENGTH;
  const emailError = touched.email && (!form.customerEmail.trim() || !EMAIL_REGEX.test(form.customerEmail.trim()));
  const phoneError = touched.phone && form.customerPhone.trim().length < PHONE_MIN_LENGTH;
  const documentError = touched.document && !form.customerDocument.trim();
  const birthDateError = touched.birthDate && !DATE_REGEX.test(form.customerBirthDate.trim());
  const nationalityError = touched.nationality && !form.customerNationality.trim();
  const [passengersTouched, setPassengersTouched] = useState(false);

  const passengerErrors = useMemo(
    () =>
      passengers.map((traveler) => ({
        firstName: traveler.firstName.trim().length < NAME_MIN_LENGTH,
        lastName: traveler.lastName.trim().length < NAME_MIN_LENGTH,
        age: !Number.isFinite(Number(traveler.age)) || Number(traveler.age) < 0 || Number(traveler.age) > 120 || !traveler.age.trim(),
        birthDate: !DATE_REGEX.test(traveler.birthDate.trim()),
        phone: traveler.phone.trim().length < PHONE_MIN_LENGTH,
        document: !traveler.document.trim(),
      })),
    [passengers]
  );

  const passengersValid = passengerErrors.every(
    (item) => !item.firstName && !item.lastName && !item.age && !item.birthDate && !item.phone && !item.document
  );

  const updatePassenger = (index: number, patch: Partial<TravelerFormState>) => {
    setPassengers((current) => current.map((traveler, i) => (i === index ? { ...traveler, ...patch } : traveler)));
  };

  const handleSubmitForm = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      document: true,
      birthDate: true,
      nationality: true,
      dietaryRestrictions: true,
    });

    if (form.customerFirstName.trim().length < NAME_MIN_LENGTH) {
      setError('Ingresá tu nombre.');
      return;
    }
    if (form.customerLastName.trim().length < NAME_MIN_LENGTH) {
      setError('Ingresá tu apellido.');
      return;
    }
    if (!EMAIL_REGEX.test(form.customerEmail.trim())) {
      setError('Ingresá un email válido.');
      return;
    }
    if (form.customerPhone.trim().length < PHONE_MIN_LENGTH) {
      setError('Ingresá un WhatsApp válido.');
      return;
    }
    if (!form.customerDocument.trim()) {
      setError('Ingresá tu DNI o pasaporte.');
      return;
    }
    if (!DATE_REGEX.test(form.customerBirthDate.trim())) {
      setError('Ingresá tu fecha de nacimiento.');
      return;
    }
    if (!form.customerNationality.trim()) {
      setError('Seleccioná tu nacionalidad.');
      return;
    }
    if (!passengersValid) {
      setPassengersTouched(true);
      setError('Completá los datos de todos los pasajeros.');
      return;
    }

    setError(null);
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createMercadoPagoPreference = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const baseUrl = getSiteUrl();
      const passengerDetails = passengers.map((traveler) => {
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
      });
      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: experience.slug,
          packageId: experience.id,
          date,
          people: travelerCount,
          ...(pax ? { peopleBreakdown: pax } : {}),
          ...(passengerDetails.length ? { passengerDetails } : {}),
          customerEmail: form.customerEmail.trim(),
          customerName: `${form.customerFirstName.trim()} ${form.customerLastName.trim()}`.trim(),
          customerPhone: form.customerPhone.trim() || undefined,
          customerDocument: form.customerDocument.trim() || undefined,
          customerBirthDate: form.customerBirthDate.trim() || undefined,
          customerNationality: form.customerNationality.trim() || undefined,
          customerDietaryRestrictions: form.customerDietaryRestrictions.trim() || undefined,
          customerComments: form.customerComments.trim() || undefined,
          successUrl: `${baseUrl}/checkout/success?slug=${encodeURIComponent(experience.slug)}&date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(travelerCount))}`,
          failureUrl: `${baseUrl}/checkout/cancel?slug=${encodeURIComponent(experience.slug)}`,
          pendingUrl: `${baseUrl}/checkout/success?slug=${encodeURIComponent(experience.slug)}&date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(travelerCount))}`,
          ...(referralCode ? { referralCode } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'No se pudo iniciar el pago.');
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error('No se recibió la URL de pago.');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5FAFF] px-4 py-10 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/experiencia/${experience.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#F4D1D4] bg-white px-4 py-2 text-sm font-extrabold text-[#112B49] shadow-[0_10px_24px_rgba(17,43,73,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#E30613] hover:bg-[#FFF1F1] hover:text-[#E30613] hover:shadow-[0_14px_30px_rgba(17,43,73,0.12)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la excursión
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-6 shadow-[0_16px_36px_rgba(15,66,116,0.08)]">
              <div className="flex flex-wrap items-center gap-3">
                {steps.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = step === item.id;
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ${
                          isActive ? 'bg-[#E30613] text-white' : 'bg-[#EEF6FF] text-[#5A7898]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.title}
                      </div>
                      {index < steps.length - 1 ? <ChevronRight className="h-4 w-4 text-[#A5BAD1]" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 'form' ? (
                <motion.div
                  key="form-step"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="rounded-3xl border-[#D4E6F7] shadow-[0_16px_36px_rgba(15,66,116,0.08)]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-2xl font-black tracking-[-0.02em] text-[#0B2240]">Completá tus datos</CardTitle>
                      <p className="text-sm text-[#5A7898]">Reservás directo y seguís al pago, sin pasar por carrito.</p>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmitForm} className="space-y-5" noValidate>
                        <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#0B2240]">
                          Pasajero 1
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="customerFirstName">Nombre *</Label>
                            <Input
                              id="customerFirstName"
                              value={form.customerFirstName}
                              onChange={(event) => setForm((prev) => ({ ...prev, customerFirstName: event.target.value }))}
                              onBlur={() => setTouched((prev) => ({ ...prev, firstName: true }))}
                              placeholder="Ej: Juan"
                            />
                            {firstNameError ? <p className="text-xs font-semibold text-red-500">Minimo 2 caracteres.</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="customerLastName">Apellido *</Label>
                            <Input
                              id="customerLastName"
                              value={form.customerLastName}
                              onChange={(event) => setForm((prev) => ({ ...prev, customerLastName: event.target.value }))}
                              onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                              placeholder="Ej: Garcia"
                            />
                            {lastNameError ? <p className="text-xs font-semibold text-red-500">Minimo 2 caracteres.</p> : null}
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="customerEmail">Email *</Label>
                            <div className="relative">
                              <Input
                                id="customerEmail"
                                type="email"
                                value={form.customerEmail}
                                onChange={(event) => setForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
                                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                placeholder="tu@email.com"
                                className="pl-10"
                              />
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C95AE]" />
                            </div>
                            {emailError ? <p className="text-xs font-semibold text-red-500">Ingresa un email valido.</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="customerPhone">WhatsApp *</Label>
                            <Input
                              id="customerPhone"
                              value={form.customerPhone}
                              onChange={(event) => setForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
                              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                              placeholder="+54 11 ..."
                            />
                            {phoneError ? <p className="text-xs font-semibold text-red-500">Ingresa un WhatsApp valido.</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="customerDocument">DNI / Pasaporte *</Label>
                            <Input
                              id="customerDocument"
                              value={form.customerDocument}
                              onChange={(event) => setForm((prev) => ({ ...prev, customerDocument: event.target.value }))}
                              onBlur={() => setTouched((prev) => ({ ...prev, document: true }))}
                              placeholder="Numero de documento"
                            />
                            {documentError ? <p className="text-xs font-semibold text-red-500">Este dato es obligatorio.</p> : null}
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="customerBirthDate">Fecha de nacimiento *</Label>
                            <ArgentineDateInput
                              id="customerBirthDate"
                              value={form.customerBirthDate}
                              onChange={(value) => setForm((prev) => ({ ...prev, customerBirthDate: value }))}
                              onBlur={() => setTouched((prev) => ({ ...prev, birthDate: true }))}
                            />
                            {birthDateError ? <p className="text-xs font-semibold text-red-500">Ingresa una fecha valida.</p> : null}
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="customerNationality">Nacionalidad *</Label>
                            <Select
                              name="customerNationality"
                              value={form.customerNationality}
                              onValueChange={(value) => setForm((prev) => ({ ...prev, customerNationality: value }))}
                            >
                              <SelectTrigger id="customerNationality" className="w-full">
                                <SelectValue placeholder="Seleccioná tu país" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Países</SelectLabel>
                                  {getSpanishCountries().map((country) => (
                                    <SelectItem key={country.code} value={country.code}>
                                      {country.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            {nationalityError ? <p className="text-xs font-semibold text-red-500">Seleccioná tu nacionalidad.</p> : null}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="customerDietaryRestrictions">Restricción de comidas</Label>
                          <Textarea
                            id="customerDietaryRestrictions"
                            value={form.customerDietaryRestrictions}
                            onChange={(event) => setForm((prev) => ({ ...prev, customerDietaryRestrictions: event.target.value }))}
                            placeholder="Alergias, intolerancias o preferencias alimentarias (opcional)"
                          />
                        </div>

                        {passengers.length > 0 ? (
                          <div className="space-y-4 border-t border-[#E3EDF7] pt-4">
                            {passengers.map((traveler, index) => {
                              const errors = passengerErrors[index];
                              const showErrors = passengersTouched;
                              return (
                                <div key={index} className="space-y-3 rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] p-4">
                                  <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#0B2240]">
                                    Pasajero {index + 2}
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-firstName`}>Nombre *</Label>
                                      <Input
                                        id={`passenger-${index}-firstName`}
                                        value={traveler.firstName}
                                        onChange={(event) => updatePassenger(index, { firstName: event.target.value })}
                                        placeholder="Ej: Juan"
                                      />
                                      {showErrors && errors?.firstName ? <p className="text-xs font-semibold text-red-500">Minimo 2 caracteres.</p> : null}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-lastName`}>Apellido *</Label>
                                      <Input
                                        id={`passenger-${index}-lastName`}
                                        value={traveler.lastName}
                                        onChange={(event) => updatePassenger(index, { lastName: event.target.value })}
                                        placeholder="Ej: Garcia"
                                      />
                                      {showErrors && errors?.lastName ? <p className="text-xs font-semibold text-red-500">Minimo 2 caracteres.</p> : null}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-age`}>Edad *</Label>
                                      <Input
                                        id={`passenger-${index}-age`}
                                        type="number"
                                        min={0}
                                        max={120}
                                        value={traveler.age}
                                        onChange={(event) => updatePassenger(index, { age: event.target.value })}
                                        placeholder="Ej: 30"
                                      />
                                      {showErrors && errors?.age ? <p className="text-xs font-semibold text-red-500">Ingresa una edad valida.</p> : null}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-birthDate`}>Fecha de nacimiento *</Label>
                                      <ArgentineDateInput
                                        id={`passenger-${index}-birthDate`}
                                        value={traveler.birthDate}
                                        onChange={(value) => updatePassenger(index, { birthDate: value })}
                                      />
                                      {showErrors && errors?.birthDate ? <p className="text-xs font-semibold text-red-500">Ingresa una fecha valida.</p> : null}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-phone`}>Telefono *</Label>
                                      <Input
                                        id={`passenger-${index}-phone`}
                                        value={traveler.phone}
                                        onChange={(event) => updatePassenger(index, { phone: event.target.value })}
                                        placeholder="+54 11 ..."
                                      />
                                      {showErrors && errors?.phone ? <p className="text-xs font-semibold text-red-500">Ingresa un telefono valido.</p> : null}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`passenger-${index}-document`}>DNI / Pasaporte *</Label>
                                      <Input
                                        id={`passenger-${index}-document`}
                                        value={traveler.document}
                                        onChange={(event) => updatePassenger(index, { document: event.target.value })}
                                        placeholder="Numero de documento"
                                      />
                                      {showErrors && errors?.document ? <p className="text-xs font-semibold text-red-500">Este dato es obligatorio.</p> : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="space-y-1.5">
                          <Label htmlFor="customerComments">Comentarios</Label>
                          <Textarea
                            id="customerComments"
                            value={form.customerComments}
                            onChange={(event) => setForm((prev) => ({ ...prev, customerComments: event.target.value }))}
                            placeholder="Indicaciones importantes para tu reserva"
                          />
                        </div>

                        {error ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                            {error}
                          </div>
                        ) : null}

                        <Button type="submit" className="h-12 w-full rounded-2xl bg-[#E30613] text-base font-bold hover:bg-[#C70511]">
                          Continuar al pago
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : null}

              {step === 'payment' ? (
                <motion.div
                  key="payment-step"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="rounded-3xl border-[#D4E6F7] shadow-[0_16px_36px_rgba(15,66,116,0.08)]">
                    <CardHeader className="pb-3 text-center">
                      <CardTitle className="text-2xl font-black tracking-[-0.02em] text-[#0B2240]">Finalizar reserva</CardTitle>
                      <p className="text-sm text-[#5A7898]">Te redirigimos a Mercado Pago para completar el pago.</p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <button
                        type="button"
                        onClick={() => void createMercadoPagoPreference()}
                        disabled={isLoading}
                        className="flex w-full items-center justify-between rounded-3xl border border-[#D7E8F7] bg-white px-5 py-5 text-left transition hover:shadow-[0_12px_28px_rgba(15,66,116,0.1)] disabled:opacity-60"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F4FF]">
                            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-[#009EE3]" /> : <img src="/images/mercado-pago-logo.png" alt="Mercado Pago" className="h-6" />}
                          </div>
                          <div>
                            <div className="text-base font-bold text-[#0B2240]">Mercado Pago</div>
                            <div className="text-sm text-[#5A7898]">Tarjetas, debito o dinero en cuenta</div>
                          </div>
                        </div>
                        <div className="rounded-full bg-[#009EE3] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
                          Pagar
                        </div>
                      </button>

                      <div className="rounded-2xl border border-[#DDEAF8] bg-[#F6FBFF] px-4 py-4 text-sm text-[#486887]">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="mt-0.5 h-4 w-4 text-[#009EE3]" />
                          <p>La operacion se realiza fuera del sitio y queda protegida por Mercado Pago.</p>
                        </div>
                      </div>

                      {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                          {error}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="w-full text-center text-sm font-semibold text-[#5A7898] transition hover:text-[#E30613]"
                        onClick={() => setStep('form')}
                      >
                        Volver
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <aside className="xl:sticky xl:top-8">
            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-5 shadow-[0_16px_36px_rgba(15,66,116,0.08)]">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#7C95AE]">Tu reserva</div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.02em] text-[#0B2240]">{experience.title}</h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Salida</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-bold text-[#12325D]">
                    <Calendar className="h-4 w-4 text-[#E30613]" />
                    {dateLabel}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Modalidad</div>
                  <div className="mt-1 text-sm font-bold text-[#12325D]">Reserva directa</div>
                </div>
                <div className="rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Personas</div>
                  <div className="mt-1 text-sm font-bold text-[#12325D]">{travelerCount}</div>
                  {paxSummary.length > 0 ? (
                    <div className="mt-1 text-xs text-[#5A7898]">
                      {paxSummary.map((item) => `${item.value} ${item.label}`).join(' · ')}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-0.5 text-xs text-[#5A7898]">
                    {Array.from({ length: travelerCount }).map((_, index) => (
                      <div key={index}>
                        Pasajero {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Reserva</div>
                  <div className="mt-1 text-sm font-bold text-[#12325D]">Titular + pago directo</div>
                </div>
                <div className="rounded-2xl border border-[#E3EDF7] bg-[#F8FBFF] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Total</div>
                  <div className="mt-1 text-2xl font-black tracking-[-0.02em] text-[#0B2240]">
                    {formatAmount(total / 100, currency)}
                  </div>
                </div>
              </div>

              {checkoutExtras.items.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-[#E3EDF7] bg-white px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C95AE]">Incluye</div>
                  <div className="mt-2 space-y-2">
                    {checkoutExtras.items.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm text-[#486887]">
                        <span>{item.label}</span>
                        <span className="font-bold text-[#12325D]">{formatAmount(item.amount / 100, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7C95AE]">
                <Lock className="h-3.5 w-3.5" />
                Transaccion segura
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
