'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Camera, Heart, MapPin } from 'lucide-react';

export default function PaqueteCarousel({
  images,
  title,
  badgeLabel,
  locationLabel,
  caption,
}: {
  images: string[];
  title: string;
  badgeLabel?: string | null;
  locationLabel?: string;
  caption?: string;
}) {
  const list = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const [imageLoading, setImageLoading] = useState(true);
  const total = Math.max(1, list.length);
  const current = list.length ? list[0] : '/images/placeholder-package.jpg';

  return (
    <div className="relative isolate overflow-hidden">
      <div className="relative min-h-[240px] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[500px]">
        {imageLoading ? <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" /> : null}
        <Image
          src={current}
          alt={title}
          fill
          className={`object-cover object-center transition-opacity duration-500 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          priority
          onLoad={() => setImageLoading(false)}
        />

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-black/10 to-black/45" />

        {badgeLabel ? (
          <div className="absolute left-4 top-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-black shadow-sm">
            {badgeLabel}
          </div>
        ) : null}

      </div>
    </div>
  );
}
