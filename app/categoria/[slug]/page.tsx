import { permanentRedirect } from 'next/navigation';

export default async function CategoriaRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/destinos/${slug}`);
}
