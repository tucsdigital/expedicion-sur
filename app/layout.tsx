import type { CSSProperties } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Berkshire_Swash, Manrope } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { SITE_NAME, CONTACT_INFO, SITE_URL, SITE_DESCRIPTION } from '@/lib/constants';
import SchemaOrg from '@/components/SchemaOrg';
import PageTransition from '@/components/PageTransition';
import { getOpenGraphImageAbsolute, getSiteIconAbsolute, renderTemplate, siteConfig } from '@/lib/siteConfig';

const brandHeading = localFont({
  src: './fonts/tt-norms-pro-bold/tt-norms-pro-bold.woff2',
  variable: '--font-brand-heading',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const berkshireSwash = Berkshire_Swash({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-berkshire-swash',
  display: 'swap',
});

const siteUrl = SITE_URL;
const siteIconUrl = getSiteIconAbsolute(siteUrl);
const r2PublicOrigin = (() => {
  const baseUrl = process.env.R2_PUBLIC_BASE || '';
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: renderTemplate(siteConfig.seo.titleDefaultTemplate),
    template: renderTemplate(siteConfig.seo.titleTemplate),
  },
  description: SITE_DESCRIPTION,
  keywords: siteConfig.seo.keywords,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.seo.locale,
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - ${SITE_DESCRIPTION}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: getOpenGraphImageAbsolute(siteUrl),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - ${SITE_DESCRIPTION}`,
    description: SITE_DESCRIPTION,
    images: [getOpenGraphImageAbsolute(siteUrl)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    // Agregar cuando tengas Google Search Console
    // google: 'tu-codigo-de-verificacion',
  },
  category: 'travel',
  classification: 'Travel Agency',
  other: {
    'contact:phone_number': CONTACT_INFO.telefono,
    'contact:email': CONTACT_INFO.email,
    'contact:address': CONTACT_INFO.direccion,
  },
  icons: {
    icon: [
      { url: siteIconUrl },
    ],
    apple: [
      { url: siteIconUrl },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: siteConfig.branding.palette.primary,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cssVars = {
    ['--sherpa-blue' as string]: siteConfig.branding.palette.primary,
    ['--sherpa-yellow' as string]: siteConfig.branding.palette.secondary,
    ['--sherpa-green' as string]: '#CA9E67',
    ['--sherpa-green-strong' as string]: '#8E6B45',
    ['--sherpa-black' as string]: siteConfig.branding.palette.dark,
    ['--sherpa-cream' as string]: siteConfig.branding.palette.cream,
  } as CSSProperties;

  return (
    <html
      lang="es"
      className={`${brandHeading.variable} ${manrope.variable} ${berkshireSwash.variable}`}
      data-scroll-behavior="smooth"
      style={cssVars}
    >
      <head>
        {/* Preconnect para orígenes críticos - ordenados por prioridad */}
        {/* Firebase - crítico para páginas admin, diferido para páginas públicas */}
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
        
        {/* R2 - para imágenes */}
        {r2PublicOrigin ? <link rel="preconnect" href={r2PublicOrigin} /> : null}
        {r2PublicOrigin ? <link rel="dns-prefetch" href={r2PublicOrigin} /> : null}
        
        <link rel="icon" href={siteIconUrl} />
        <link rel="apple-touch-icon" href={siteIconUrl} />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="font-body antialiased">
        <SchemaOrg />
        <main id="main-content" className="relative z-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: { 
              zIndex: 99999,
            },
            className: 'bg-white border border-gray-200 shadow-lg',
          }}
          style={{
            zIndex: 99999,
          }}
        />
      </body>
    </html>
  );
}
