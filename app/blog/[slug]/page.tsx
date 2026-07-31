import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { BlogPost } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import Image from 'next/image';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_NAME, SITE_URL, SOCIAL_MEDIA } from '@/lib/constants';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import ShareBar from '@/components/ShareBar';

/** Sin caché: los cambios del admin (blog) se ven de inmediato */
export const revalidate = 0;

async function getPost(slug: string): Promise<BlogPost | null> {
  if (!firebaseEnabled) return null;
  try {
    const q = query(collection(db, 'blog'), where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const post = serializeFirestoreData<BlogPost>({
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    });

    if (!post.visible) return null;
    return post;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const url = `${SITE_URL}/blog/${slug}`;
    return {
      title: `${slug} - ${SITE_NAME}`,
      description: `Nota ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Entrada no encontrada' };
  }

  const url = `${SITE_URL}/blog/${slug}`;
  const description = post.extracto || post.contenido.replace(/<[^>]*>/g, '').substring(0, 160);

  const coverImage = post.imagenPortada || post.imagenTarjeta || post.imagenPrincipal;

  return {
    title: `${post.titulo} - ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${post.titulo} - ${SITE_NAME}`,
      description,
      siteName: SITE_NAME,
      locale: 'es_AR',
      images: coverImage
        ? [
            {
              url: coverImage,
              width: 1200,
              height: 630,
              alt: post.titulo,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.titulo} - ${SITE_NAME}`,
      description,
      images: coverImage ? [coverImage] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!firebaseEnabled) {
    return (
      <>
        <Navbar transparent forceTransparent reserveSpace />
        <WhatsAppButton />
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{slug}</h1>
              <p className="text-base md:text-lg text-gray-700 mt-3 max-w-none">
                Este contenido requiere configuración de Firebase para mostrarse.
              </p>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const coverImage = post.imagenPortada || post.imagenTarjeta || post.imagenPrincipal;

  const shareUrl = `${SITE_URL}/blog/${slug}`;
  const shareDescription = post.extracto || post.contenido.replace(/<[^>]*>/g, '').substring(0, 160);

  return (
    <>
      <Navbar transparent forceTransparent reserveSpace />
      <WhatsAppButton />
      <section className="pb-10 md:pb-14 bg-white overflow-x-hidden">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mx-auto max-w-none space-y-10">
            {coverImage ? (
              <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen h-[420px] md:h-[560px] overflow-hidden">
                <Image src={coverImage} alt={post.titulo} fill className="object-cover" priority />
                <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/20 to-black/70" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 pb-8 md:pb-12">
                  <div className="container mx-auto px-4 md:px-6 lg:px-8">
                    <div className="max-w-3xl w-full">
                      <p className="text-sm text-white/80">
                        {post.fechaPublicacion
                          ? new Date(
                              (post.fechaPublicacion as unknown as { seconds?: number }).seconds
                                ? (post.fechaPublicacion as unknown as { seconds: number }).seconds * 1000
                                : post.fechaPublicacion instanceof Date
                                ? post.fechaPublicacion
                                : Date.now()
                            ).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                          : ''}
                      </p>
                      <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">{post.titulo}</h1>
                      <p className="text-base md:text-lg text-white/80 mt-3 max-w-none">{post.extracto}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl w-full">
                <p className="text-sm text-gray-500">
                  {post.fechaPublicacion
                    ? new Date(
                        (post.fechaPublicacion as unknown as { seconds?: number }).seconds
                          ? (post.fechaPublicacion as unknown as { seconds: number }).seconds * 1000
                          : post.fechaPublicacion instanceof Date
                          ? post.fechaPublicacion
                          : Date.now()
                      ).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{post.titulo}</h1>
                <p className="text-base md:text-lg text-gray-600 mt-3 max-w-none">{post.extracto}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
              <div className="rounded-3xl bg-white">
                <article
                  className="prose prose-lg lg:prose-xl max-w-none text-gray-800 prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-primary prose-a:font-semibold prose-a:underline-offset-4 prose-strong:text-gray-900 prose-hr:border-gray-200 prose-blockquote:border-l-primary/50 prose-blockquote:text-gray-600 prose-img:rounded-2xl prose-img:shadow-md prose-img:border prose-img:border-gray-200 [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-2xl [&_iframe]:shadow-md [&_iframe]:border [&_iframe]:border-gray-200 [&_iframe]:my-6 [&_video]:w-full [&_video]:rounded-2xl [&_video]:shadow-md [&_video]:border [&_video]:border-gray-200 wrap-break-word"
                  dangerouslySetInnerHTML={{ __html: post.contenido }}
                />
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
                <ShareBar title={post.titulo} url={shareUrl} excerpt={shareDescription} />

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-gray-900">¿Querés un viaje similar?</p>
                  <p className="text-sm text-gray-600">
                    Contanos tu idea y armamos un plan a medida.
                  </p>
                  <a
                    href="https://wa.me/5493513154330"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full rounded-xl bg-primary text-white text-sm font-semibold py-2.5 hover:bg-primary/90"
                  >
                    Hablar con un asesor
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Explorar más</p>
                  <Link
                    href="/#productos"
                    className="inline-flex items-center justify-center w-full rounded-xl border border-gray-200 text-sm font-semibold py-2.5 hover:bg-gray-50"
                  >
                    Ver excursiones
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
