import { redirect } from 'next/navigation';
import { getPaqueteBySlug, toBookingPublicData } from '@/lib/paquetes';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import {
  clampPeopleBreakdownToMax,
  getPeopleBreakdownTotal,
  getDefaultPeopleCategories,
  normalizePeopleBreakdown,
  normalizePeopleCategories,
  type PeopleBreakdown,
} from '@/lib/packages/people-categories';
import { computeReservationPricing, getPackageAddonExtraSelections, getPackageAddonOptions } from '@/lib/packages/resolve-departure';
import { formatIsoDateEs, getFirstBookableDateIso, getMinLeadHours, isDateBookable } from '@/lib/packages/booking-rules';
import { getLocale, getTranslations } from '@/lib/messages';

/** Sin caché: datos de experiencia y reserva siempre actualizados */
export const revalidate = 0;

type SearchParams = Promise<{ slug?: string; date?: string; people?: string; pax?: string; addons?: string; cart?: string }>;

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations('checkout');
  const slug = params.slug?.trim();
  const dateParam = params.date?.trim();
  const paxParam = params.pax?.trim();
  const addonsParam = params.addons?.trim();
  if (params.cart === '1') redirect(`/experiencias`);
  if (!slug) redirect('/');

  const paquete = await getPaqueteBySlug(slug);
  if (!paquete) {
    redirect('/');
  }

  // Mapeo temporal de paquete a formato Experience para compatibilidad con CheckoutClient
  const experience = {
    id: paquete.id,
    slug: paquete.slug,
    title: paquete.titulo,
    subtitle: paquete.subtitulo ?? '',
    price: paquete.precio,
    cardImage: paquete.imagenCard ?? '',
    images: paquete.imagenes ?? [],
    maxPeople: paquete.bookingConfig?.maxPeoplePerBooking ?? paquete.capacidadMaxima ?? 10,
    galleryIntro: paquete.descripcionCorta ?? '',
    dividerPhrase: paquete.subtitulo ?? '',
    calendarIntro: paquete.descripcionCorta ?? '',
    reservationMicrocopy: paquete.descripcionLarga ?? '',
    faqs: paquete.faqs?.map((f, i) => ({
      id: String(i),
      question: (f as any).pregunta ?? (f as any).question ?? '',
      answer: (f as any).respuesta ?? (f as any).answer ?? '',
    })) ?? [],
    bookingConfig: paquete.bookingConfig as any,
    supportText: paquete.descripcionCorta ?? '',
    topNoticeText: '',
    videoOverlayText: '',
    includes: [],
    highlights: [],
    itinerary: [],
    testimonials: [],
    headerImage: paquete.imagenCard ?? '',
    takeaways: [],
    forWho: [],
    notForWho: [],
  };

  const bookingData = toBookingPublicData(paquete as any, {});
  const parsedPeople = Number(params.people ?? '1');
  const people = Number.isFinite(parsedPeople) ? Math.max(1, Math.min(50, Math.floor(parsedPeople))) : 1;
  const maxPeoplePerBooking = bookingData?.maxPeoplePerBooking ?? people;
  const peopleCategories = normalizePeopleCategories((paquete.bookingConfig as any)?.peopleCategories, maxPeoplePerBooking);

  const hasSpecificDates = bookingData?.hasSpecificDates ?? true;
  const isNoDate = !dateParam || dateParam === 'sin-fecha';
  if (hasSpecificDates && isNoDate) {
    redirect(`/experiencia/${slug}`);
  }
  if (!hasSpecificDates && !isNoDate) {
    // Si no hay fechas específicas, ignorar date o normalizar a sin-fecha
  }
  const date = isNoDate ? 'sin-fecha' : dateParam;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (date !== 'sin-fecha' && !dateRegex.test(date)) {
    redirect('/');
  }
  // La anticipación mínima no redirige: el checkout muestra el aviso y bloquea el pago.
  // (Si date=sin-fecha llega hasta acá, el flujo es "a coordinar" y no aplica el plazo.)

  let checkoutError: string | null = null;
  const categoriesForCheckout = peopleCategories.length ? peopleCategories : getDefaultPeopleCategories(maxPeoplePerBooking);
  let paxInput: unknown = paxParam || null;
  let paxInvalid = false;
  if (paxParam) {
    try {
      paxInput = JSON.parse(paxParam);
    } catch {
      paxInvalid = true;
      paxInput = null;
    }
  }
  let pax: PeopleBreakdown = normalizePeopleBreakdown({ breakdown: paxInput, categories: categoriesForCheckout });
  if (!paxParam) {
    const sumMin = getPeopleBreakdownTotal(pax);
    const target = Math.min(people, maxPeoplePerBooking);
    let remaining = Math.max(0, target - sumMin);
    if (remaining > 0 && categoriesForCheckout[0]) {
      const firstKey = categoriesForCheckout[0].key;
      pax = {
        ...pax,
        [firstKey]: Math.min(categoriesForCheckout[0].max, (Number(pax[firstKey] ?? 0) || 0) + remaining),
      };
    }
  }
  pax = clampPeopleBreakdownToMax({ breakdown: pax, categories: categoriesForCheckout, maxPeoplePerBooking });
  const safePeople = Math.max(1, Math.min(maxPeoplePerBooking, getPeopleBreakdownTotal(pax)));
  if (paxInvalid) {
    checkoutError = t('invalidPassengerSelection');
    pax = normalizePeopleBreakdown({ breakdown: null, categories: categoriesForCheckout });
  }
  const minLeadHours = getMinLeadHours((paquete as any)?.bookingConfig);
  if (date !== 'sin-fecha' && minLeadHours > 0 && !isDateBookable(date, minLeadHours)) {
    const firstBookableDate = formatIsoDateEs(getFirstBookableDateIso(minLeadHours));
    checkoutError = t('leadTimeError', { hours: minLeadHours, date: firstBookableDate });
  }

  // Adicionales elegidos en el modal (ids separados por coma). Se validan contra el catálogo.
  const addonCatalog = getPackageAddonOptions(paquete as any);
  const requestedAddonIds = (addonsParam ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const validAddonIds = requestedAddonIds.filter((id) => addonCatalog.some((addon) => addon.id === id));
  const addonOptions = addonCatalog.filter((addon) => validAddonIds.includes(addon.id));
  const addonExtras = getPackageAddonExtraSelections(paquete as any, validAddonIds);
  const computedPricing = computeReservationPricing(paquete, date, {
    people: safePeople,
    peopleAdults: typeof pax.adults === 'number' ? pax.adults : null,
    peopleMinors: typeof pax.minors === 'number' ? pax.minors : null,
    selectedExtras: addonExtras,
  });
  const pricing = {
    unitAmountAdults: computedPricing.unitAmountAdults,
    unitAmountMinors: computedPricing.unitAmountMinors,
    baseSubtotalAmount: computedPricing.baseSubtotalAmount,
    extrasTotalAmount: computedPricing.extrasTotalAmount,
    subtotalAmount: computedPricing.subtotalAmount,
    currency: computedPricing.currency ?? 'ars',
  };

  return (
    <CheckoutClient
      experience={experience as any}
      date={date}
      people={safePeople}
      pax={pax}
      pricing={pricing}
      initialError={checkoutError}
      selectedAddons={addonOptions.map((addon) => ({
        id: addon.id,
        title: addon.title,
        amount: Math.round(Number(addon.price) * 100),
      }))}
    />
  );
}
