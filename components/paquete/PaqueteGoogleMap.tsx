type Props = {
  title: string;
  embedUrl?: string | null;
};

export default function PaqueteGoogleMap({ title, embedUrl }: Props) {
  const normalizedUrl = String(embedUrl ?? '').trim();
  if (!normalizedUrl) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold tracking-[-0.02em] text-black">Ubicación</h3>
        <p className="mt-1 text-sm text-gray-600">Explorá el punto de encuentro o la zona de la experiencia directamente en el mapa.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <div className="relative aspect-[4/3] w-full md:aspect-[16/7]">
          <iframe
            src={normalizedUrl}
            title={`Mapa de ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </section>
  );
}
