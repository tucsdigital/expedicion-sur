'use client';

import { useEffect, useMemo, useState } from 'react';
import { experience as defaultExperience } from './experience-data';
import testimonialsData from '@/testimonials/testimonials.json';
import HeroSection from './HeroSection';
import ImageCarousel from './ImageCarousel';
import TwoColumnLists from './TwoColumnLists';
import CtaSection from './CtaSection';
import TestimonialsSection from './TestimonialsSection';
import ReservaWidget from './ReservaWidget';
import MidVideoSection from './MidVideoSection';
import FaqSection from './FaqSection';
import LandingFooter from './LandingFooter';
import WhatsAppCtaButton from './WhatsAppCtaButton';
import { getWhatsAppLinkForExperience } from '@/lib/utils/whatsapp';
import { toBookingPublicData } from '@/lib/experiencias';
import ScrollSmoother from '@/components/ScrollSmoother';
import type { Experience, BookingPublicData } from './types';

const formatDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type Props = {
  /** Cuando se pasa (ej. desde /experiencias/[slug]), se usa esta experiencia en lugar de la por defecto. */
  experienceProp?: Experience;
};

export default function LandingReservaPage({ experienceProp }: Props) {
  const experience = experienceProp ?? defaultExperience;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [people, setPeople] = useState(1);
  const [peopleTouched, setPeopleTouched] = useState(false);

  const whatsappLink = useMemo(() => {
    const date = selectedDate ? formatDateIso(selectedDate) : undefined;
    const includePeople = peopleTouched || !!selectedDate;

    return getWhatsAppLinkForExperience({
      experienceTitle: experience.title,
      date,
      people: includePeople ? people : undefined,
    });
  }, [experience.title, selectedDate, people, peopleTouched]);

  const handlePeopleChange = (value: number) => {
    setPeopleTouched(true);
    setPeople(value);
  };

  const testimonials = useMemo(() => {
    if (experience.testimonials?.length) {
      return experience.testimonials.map((t) => ({
        name: t.name,
        quote: t.quote,
        role: t.role ?? '',
      }));
    }
    return testimonialsData.testimonials.map((testimonial) => ({
      name: testimonial.name,
      quote: testimonial.comment,
      role: testimonial.country,
    }));
  }, [experience.testimonials]);

  const fallbackBookingData = useMemo(
    () => (experienceProp ? toBookingPublicData(experienceProp) : null),
    [experienceProp]
  );
  const [bookingDataFromApi, setBookingDataFromApi] = useState<BookingPublicData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!experienceProp?.slug) {
      return;
    }
    const fetchBooking = () => {
      fetch(`/api/experiencias/${encodeURIComponent(experienceProp.slug)}/booking`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.booking) setBookingDataFromApi(data.booking);
          else if (!cancelled) setBookingDataFromApi(null);
        })
        .catch(() => {
          if (!cancelled) setBookingDataFromApi(null);
        });
    };

    fetchBooking();
    const interval = setInterval(() => {
      fetchBooking();
    }, 30000); // refrescar cada 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [experienceProp?.slug]);

  const bookingData = bookingDataFromApi !== undefined ? bookingDataFromApi : fallbackBookingData;
  const showReservaBlock = !bookingData || bookingData.enabled;

  return (
    <div className="landing-reserva">
      <ScrollSmoother />
      <HeroSection experience={experience} whatsappLink={whatsappLink} hideWhatsApp />
      <ImageCarousel
        images={experience.cardImage ? [experience.cardImage, ...(experience.images ?? [])] : (experience.images ?? [])}
        title={experience.title}
        intro={experience.galleryIntro}
      />
      <TwoColumnLists experience={experience} />
      <CtaSection
        whatsappLink={whatsappLink}
        title={`Reservá tu lugar en ${experience.title}`}
        description="Coordinamos todo para que vivas una experiencia a tu medida con Viaggio Tur."
        dividerText={experience.dividerPhrase}
        sectionId="cta-reserva"
        hideWhatsApp
      />
      <div id="cta-reserva-end" className="h-px w-full" />
      <TestimonialsSection testimonials={testimonials} />
      {showReservaBlock && (
        <ReservaWidget
          experienceId={experience.id}
          experienceSlug={experience.slug}
          bookingData={bookingData ?? undefined}
          maxPeople={experience.maxPeople}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          people={people}
          onPeopleChange={handlePeopleChange}
          calendarIntro={experience.calendarIntro}
          reservationMicrocopy={experience.reservationMicrocopy}
        />
      )}
      <MidVideoSection experience={experience} />
      <FaqSection faqs={experience.faqs} />
      <LandingFooter />
    </div>
  );
}
