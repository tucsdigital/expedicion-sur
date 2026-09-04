'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Paquete } from '@/types';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Headphones, MapPin, ShieldCheck, Users, X } from 'lucide-react';
import { getWhatsAppLinkForPackage } from '@/lib/utils/whatsapp';
import {
  buildBookingCalendarMonth,
  filterAvailabilityToBookingWindow,
  getMaxSelectablePeople,
  type BookingAvailabilityItem,
} from '@/lib/packages/booking-calendar';
import {
  clampPeopleBreakdownToMax,
  getPeopleBreakdownTotal,
  normalizePeopleBreakdown,
  normalizePeopleCategories,
  type PeopleBreakdown,
  type PeopleCategoryConfig,
} from '@/lib/packages/people-categories';

interface PaqueteSidebarProps {
  paquete: Paquete;
  bookingDates?: BookingAvailabilityItem[];
}

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function parsePromoDeadline(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T23:59:59`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPromoDeadline(value?: string | null) {
  const parsed = parsePromoDeadline(value);
  if (!parsed) return '';
  return parsed
    .toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace('.', '');
}

function formatDateLabel(value: string) {
  if (!value || value === 'sin-fecha') return 'A coordinar';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

export default function PaqueteSidebar({ paquete, bookingDates = [] }: PaqueteSidebarProps) {
  const destino = paquete.destino || paquete.eventoLugar || '-';
  const duracion = paquete.duracion || '-';
  const bookingEnabled = paquete.bookingConfig?.enabled !== false;
  const maxPeoplePerBooking = paquete.bookingConfig?.maxPeoplePerBooking ?? paquete.capacidadMaxima ?? 6;
  const peopleCategories: PeopleCategoryConfig[] = useMemo(
    () => normalizePeopleCategories((paquete.bookingConfig as any)?.peopleCategories, maxPeoplePerBooking),
    [maxPeoplePerBooking, paquete.bookingConfig]
  );
  const specialPrice = Number(paquete.precioDescuentoPrimerosCupos ?? 0);
  const specialDeadline = formatPromoDeadline(paquete.tarifaEspecialFechaLimite);
  const specialDeadlineDate = parsePromoDeadline(paquete.tarifaEspecialFechaLimite);
  const [renderedAt] = useState(() => Date.now());
  const hasSpecialPrice =
    specialPrice > 0 &&
    paquete.precio > 0 &&
    specialPrice < paquete.precio &&
    Boolean(specialDeadline) &&
    Boolean(specialDeadlineDate && specialDeadlineDate.getTime() >= renderedAt);
  const [step, setStep] = useState<'people' | 'calendar'>('people');
  const [selectedDate, setSelectedDate] = useState('');
  const [pax, setPax] = useState<PeopleBreakdown>(() =>
    normalizePeopleBreakdown({ breakdown: null, categories: peopleCategories })
  );
  const people = Math.max(1, Math.floor(getPeopleBreakdownTotal(pax)));
  const whatsappHref = useMemo(() => getWhatsAppLinkForPackage(paquete.titulo), [paquete.titulo]);
  const paymentMethods = ['VISA', 'mastercard', 'NARANJA', 'mercado pago'];
  const condiciones = useMemo(
    () =>
      Array.isArray(paquete.condiciones)
        ? paquete.condiciones
            .map((item) => ({
              titulo: String(item?.titulo ?? '').trim(),
              texto: String(item?.texto ?? '').trim(),
            }))
            .filter((item) => item.titulo.length > 0 && item.texto.length > 0)
        : [],
    [paquete.condiciones]
  );

  const visibleBookingDates = useMemo(
    () => filterAvailabilityToBookingWindow(bookingDates, new Date()).sort((a, b) => a.date.localeCompare(b.date)),
    [bookingDates]
  );

  const selectedAvailability = useMemo(
    () => visibleBookingDates.find((item) => item.date === selectedDate) ?? null,
    [selectedDate, visibleBookingDates]
  );

  const getSalidaForDate = (date: string) => paquete.salidas?.find((salida) => salida.fecha === date) ?? null;

  const maxSelectablePeopleForDate = getMaxSelectablePeople(selectedAvailability?.available ?? 0, maxPeoplePerBooking);

  useEffect(() => {
    const safeMax = Math.max(1, Math.floor(Number(maxPeoplePerBooking) || 1));
    const normalizedCategories = normalizePeopleCategories((paquete.bookingConfig as any)?.peopleCategories, safeMax);
    const normalized = normalizePeopleBreakdown({ breakdown: pax, categories: normalizedCategories });
    const clamped = clampPeopleBreakdownToMax({
      breakdown: normalized,
      categories: normalizedCategories,
      maxPeoplePerBooking: safeMax,
    });
    setPax((current) => (JSON.stringify(current) === JSON.stringify(clamped) ? current : clamped));
  }, [maxPeoplePerBooking, paquete.bookingConfig, pax]);

  useEffect(() => {
    if (!selectedDate || !selectedAvailability) return;
    if (maxSelectablePeopleForDate <= 0) {
      setSelectedDate('');
      setStep('calendar');
      return;
    }
    if (people <= maxSelectablePeopleForDate) return;
    setPax((current) =>
      clampPeopleBreakdownToMax({
        breakdown: current,
        categories: peopleCategories,
        maxPeoplePerBooking: maxSelectablePeopleForDate,
      })
    );
  }, [maxSelectablePeopleForDate, people, peopleCategories, selectedAvailability, selectedDate]);

  const bookingHref = `/checkout?slug=${encodeURIComponent(paquete.slug)}&date=${encodeURIComponent(
    selectedDate || 'sin-fecha'
  )}&people=${encodeURIComponent(String(people))}&pax=${encodeURIComponent(JSON.stringify(pax))}`;

  const months = useMemo(() => {
    const monthKeys = new Set(visibleBookingDates.map((item) => item.date.slice(0, 7)));
    return [...monthKeys].sort().map((key) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month: month - 1 };
    });
  }, [visibleBookingDates]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-black">
            Reserva directa
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Precio {paquete.mostrarDesde ? 'desde' : ''} 
          </div>

          {hasSpecialPrice ? (
            <div className="mt-3">
              <div className="flex items-end gap-3 text-gray-500">
                <div className="text-[22px] font-semibold leading-none line-through decoration-2">
                  ${paquete.precio.toLocaleString('es-AR')}
                </div>
                <div className="mb-0.5 text-xs font-extrabold uppercase">{paquete.moneda || 'ARS'}</div>
              </div>

              <div className="mt-1 flex items-end gap-3">
                <div className="text-[44px] leading-none font-black tracking-[-0.03em] text-black">
                  ${specialPrice.toLocaleString('es-AR')}
                </div>
                <div className="mb-2 text-sm font-extrabold uppercase text-black">{paquete.moneda || 'ARS'}</div>
              </div>

              <div className="mt-2 text-sm font-semibold text-green-700">Tarifa especial</div>
              <div className="mt-1 text-sm text-gray-600">Vigente hasta el {specialDeadline}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Por persona</div>
            </div>
          ) : (
            <div className="mt-1 flex items-end gap-3">
              <div className="text-[44px] leading-none font-black tracking-[-0.02em] text-black">
                ${paquete.precio.toLocaleString('es-AR')}
              </div>
              <div className="mb-2 text-sm font-extrabold uppercase text-gray-600">{paquete.moneda || 'ARS'}</div>
            </div>
          )}
        </div>

        {String((paquete as any)?.fechaVencimiento ?? '').trim() ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <Clock className="h-4 w-4 text-gray-600" />
            Vence: <span className="font-semibold text-gray-900">{String((paquete as any).fechaVencimiento)}</span>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100">
                <MapPin className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</div>
                <div className="truncate text-sm font-bold text-black">{destino}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100">
                <Calendar className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha elegida</div>
                <div className="truncate text-sm font-bold text-black">{formatDateLabel(selectedDate)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100">
                <Clock className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duración</div>
                <div className="truncate text-sm font-bold text-black">{duracion}</div>
              </div>
            </div>
          </div>

          {bookingEnabled ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              {step === 'people' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-extrabold text-black">Cantidad de personas</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</div>
                    <div className="mt-1 text-sm font-bold text-black">
                      {visibleBookingDates.length > 0 ? 'Elegís la fecha en el siguiente paso' : 'A coordinar'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Users className="h-4 w-4 text-success" />
                      Personas
                    </div>

                    <div className="mt-3 grid gap-3">
                      {peopleCategories.map((category) => {
                        const value = Math.max(0, Number(pax[category.key] ?? category.min) || 0);
                        const canIncrement = people < maxPeoplePerBooking && value < category.max;
                        const canDecrement = value > category.min;
                        const minLabel = category.min > 0 ? `Mínimo ${category.min}` : 'Opcional';
                        return (
                          <div
                            key={category.key}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                          >
                            <div>
                              <div className="text-sm font-bold text-black">{category.label}</div>
                              <div className="text-xs text-slate-500">{minLabel}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPax((current) => ({
                                    ...current,
                                    [category.key]: Math.max(category.min, (Number(current[category.key] ?? 0) || 0) - 1),
                                  }))
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-300 bg-white text-lg font-bold text-black transition hover:bg-gray-50 disabled:opacity-60"
                                aria-label={`Restar ${category.label}`}
                                disabled={!canDecrement}
                              >
                                -
                              </button>
                              <div className="min-w-[42px] text-center text-lg font-black text-black">{value}</div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canIncrement) return;
                                  setPax((current) => ({
                                    ...current,
                                    [category.key]: Math.min(category.max, (Number(current[category.key] ?? 0) || 0) + 1),
                                  }));
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-300 bg-white text-lg font-bold text-black transition hover:bg-gray-50 disabled:opacity-60"
                                aria-label={`Sumar ${category.label}`}
                                disabled={!canIncrement}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-slate-600">
                        Total: <span className="font-extrabold text-black">{people}</span> · Máximo por reserva:{' '}
                        <span className="font-extrabold text-black">{maxPeoplePerBooking}</span>
                      </div>
                    </div>

                    {visibleBookingDates.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setStep('calendar')}
                        className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-black font-extrabold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 focus-visible:ring-offset-2 active:bg-neutral-900"
                      >
                        Continuar
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <Link
                          href={bookingHref}
                          className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-black font-extrabold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 focus-visible:ring-offset-2 active:bg-neutral-900"
                        >
                          Reservar
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]">
                  <div className="my-auto w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-black">Elegí tu fecha</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Disponibilidad para <span className="font-extrabold text-black">{people}</span>{' '}
                        {people === 1 ? 'persona' : 'personas'}.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('people')}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-black"
                      aria-label="Cerrar calendario"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {visibleBookingDates.some((item) => item.available >= people) ? (
                    <div className="space-y-3">
                      {months.map(({ year, month }) => {
                        const cells = buildBookingCalendarMonth({
                          year,
                          month,
                          entries: visibleBookingDates,
                          requiredPeople: people,
                        });

                        return (
                          <div key={`${year}-${month}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-3 text-sm font-extrabold capitalize text-black">{formatMonthLabel(year, month)}</div>
                            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
                              {WEEK_DAYS.map((day) => (
                                <div key={`${year}-${month}-${day}`}>{day}</div>
                              ))}
                            </div>
                            <div className="mt-2 grid grid-cols-7 gap-1">
                              {cells.map((cell) => {
                                const isSelected = selectedDate === cell.isoDate;
                                const sharedClasses =
                                  'flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold transition';

                                if (!cell.inMonth) {
                                  return <div key={cell.isoDate} className={`${sharedClasses} opacity-0`} aria-hidden="true" />;
                                }

                                if (cell.isSelectable) {
                                  return (
                                    <button
                                      key={cell.isoDate}
                                      type="button"
                                      onClick={() => setSelectedDate(cell.isoDate)}
                                      className={`${sharedClasses} ${
                                        isSelected
                                          ? 'bg-black text-white'
                                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                                      }`}
                                      aria-label={`Seleccionar ${formatDateLabel(cell.isoDate)}. ${cell.available} cupos disponibles.`}
                                    >
                                      {cell.day}
                                    </button>
                                  );
                                }

                                return (
                                  <div
                                    key={cell.isoDate}
                                    className={`${sharedClasses} ${
                                      cell.isSoldOut ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-slate-400'
                                    }`}
                                    aria-label={cell.isSoldOut ? `${cell.day} agotado` : `${cell.day} sin salida`}
                                  >
                                    {cell.day}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
                      No hay fechas con cupo para {people} {people === 1 ? 'persona' : 'personas'}. Probá bajar la cantidad.
                    </div>
                  )}

                  {selectedDate ? (
                    <>
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha seleccionada</div>
                        <div className="mt-1 text-sm font-bold text-black">{formatDateLabel(selectedDate)}</div>
                        {selectedAvailability ? (
                          <div className="mt-2 text-xs text-slate-600">
                            Precio por persona: <span className="font-bold text-black">{getSalidaForDate(selectedDate)?.moneda || paquete.moneda || 'ARS'} ${Number(getSalidaForDate(selectedDate)?.precio ?? paquete.precio ?? 0).toLocaleString('es-AR')}</span>
                            <br />
                            Cupos disponibles: <span className="font-bold text-green-700">{selectedAvailability.available}</span>
                            {selectedAvailability.capacity > 0 ? ` de ${selectedAvailability.capacity}` : ''}
                          </div>
                        ) : null}
                      </div>

                      <Link
                        href={bookingHref}
                        className="flex h-11 w-full items-center justify-center rounded-2xl bg-black font-extrabold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 focus-visible:ring-offset-2 active:bg-neutral-900"
                      >
                        Reservar
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </>
                  ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-slate-700">
              Las reservas online no están habilitadas para esta experiencia en este momento.
            </div>
          )}

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-success bg-white font-bold text-success-strong transition hover:bg-green-50"
          >
            Consultar por WhatsApp
          </a>

          {condiciones.length > 0 ? (
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-slate-700">
              {condiciones.map((item, index) => (
                <div key={`${item.titulo}-${index}`} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <div className="font-semibold text-black">{item.titulo}</div>
                    <div className="mt-0.5 text-slate-600">{item.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-bold text-black">¿Tenés dudas?</div>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100">
            <Headphones className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700">Nuestro equipo te asesora de forma personalizada.</div>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-success hover:underline">
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-black">
          <ShieldCheck className="h-4 w-4 text-success" />
          Comprás tranquila
        </div>
        <p className="mt-1 text-xs text-slate-600">Tu compra está protegida</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {paymentMethods.map((method) => (
            <span key={method} className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-600">
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
