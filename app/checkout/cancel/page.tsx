import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { XCircle, MessageCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';
import { getLocale, getTranslations } from '@/lib/messages';

type SearchParams = Promise<{ slug?: string; date?: string; people?: string }>;

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations('checkout');
  const p = await getTranslations('public');
  const slug = params.slug?.trim() || '';
  const whatsappHref = `${SOCIAL_MEDIA.whatsapp}?text=${encodeURIComponent(
    'Hola, estaba por reservar una excursión y cancelé el pago. ¿Me pueden ayudar con alguna duda?'
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
      <main className="flex flex-1 items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <XCircle className="h-12 w-12" strokeWidth={2} />
              </div>
              <h1 className="mt-6 text-2xl font-bold text-gray-900 md:text-3xl">
                {t('paymentNotCompleted')}
              </h1>
              <p className="mt-3 text-base text-gray-600">
                {t('paymentNotCompletedDescription')}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <p className="text-center text-sm font-medium text-gray-700">
                {t('options')}
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    {t('tryAgainDescription')}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <span>
                    {t('whatsAppHelpDescription')}
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              {slug && (
                <Button asChild className="w-full justify-center gap-2 sm:w-auto">
                  <Link href={`/experiencia/${slug}`}>
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToExcursion')}
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="w-full justify-center gap-2 sm:w-auto"
              >
                <Link href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {p('contactWhatsApp')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-center sm:w-auto">
                <Link href={'/'}>{t('goHome')}</Link>
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            {SITE_NAME} · Sin cargo ni compromiso
          </p>
        </div>
      </main>
    </div>
  );
}
