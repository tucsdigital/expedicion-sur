'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

export default function PaqueteGalleryGrid({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const slides = useMemo(
    () =>
      (Array.isArray(images) ? images.filter(Boolean) : []).map((src, index) => ({
        src,
        alt: `${title} ${index + 1}`,
      })),
    [images, title]
  );
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (slides.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {slides.map((slide, slideIndex) => (
          <button
            key={`${slide.src}-${slideIndex}`}
            type="button"
            onClick={() => {
              setIndex(slideIndex);
              setOpen(true);
            }}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 text-left"
            aria-label={`Ampliar imagen ${slideIndex + 1} de ${slides.length}`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        slides={slides}
        plugins={[Zoom]}
        carousel={{ finite: slides.length <= 1 }}
        controller={{ closeOnBackdropClick: true }}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 2,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
        }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
        }}
      />
    </>
  );
}
