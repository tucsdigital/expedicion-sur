import { redirect } from 'next/navigation';
import { getExperienciaBySlug, toBookingPublicData } from '@/lib/experiencias';
import CheckoutClient from '@/components/checkout/CheckoutClient';

/** Sin caché: datos de experiencia y reserva siempre actualizados */
export const revalidate = 0;

type SearchParams = Promise<{ slug?: string; date?: string; people?: string }>;

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const slug = params.slug?.trim();
  const dateParam = params.date?.trim();
  const peopleParam = params.people?.trim();

  if (!slug || !peopleParam) {
    redirect('/');
  }

  const people = parseInt(peopleParam, 10);
  if (isNaN(people) || people < 1 || people > 50) {
    redirect('/');
  }

  const experience = await getExperienciaBySlug(slug);
  if (!experience) {
    redirect('/');
  }

  const bookingData = toBookingPublicData(experience);
  const maxPeople = bookingData?.maxPeoplePerBooking ?? experience.maxPeople ?? 50;
  if (people > maxPeople) {
    redirect(`/experiencias/${slug}`);
  }

  const hasSpecificDates = bookingData?.hasSpecificDates ?? true;
  const isNoDate = !dateParam || dateParam === 'sin-fecha';
  if (hasSpecificDates && isNoDate) {
    redirect(`/experiencias/${slug}`);
  }
  if (!hasSpecificDates && !isNoDate) {
    // Si no hay fechas específicas, ignorar date o normalizar a sin-fecha
  }
  const date = isNoDate ? 'sin-fecha' : dateParam;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (date !== 'sin-fecha' && !dateRegex.test(date)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CheckoutClient experience={experience} date={date} people={people} />
    </div>
  );
}
