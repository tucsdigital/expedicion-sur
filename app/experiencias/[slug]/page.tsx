'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getExperienciaBySlug } from '@/lib/experiencias';
import type { Experience } from '@/components/landing-reserva/types';
import LandingReservaPage from '@/components/landing-reserva/LandingReservaPage';
import { Loader2 } from 'lucide-react';

export default function ExperienciaSlugPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const [experience, setExperience] = useState<Experience | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) {
      setExperience(null);
      return;
    }
    let cancelled = false;
    const fetchExp = () => {
      getExperienciaBySlug(slug).then((data) => {
        if (!cancelled) setExperience(data ?? null);
      });
    };
    fetchExp();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchExp();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [slug]);

  if (experience === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary/5">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (experience === null) {
    notFound();
  }

  return <LandingReservaPage experienceProp={experience} />;
}
