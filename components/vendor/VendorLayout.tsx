'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  CalendarCheck,
  Link2,
  LogOut,
  Menu,
  X,
  Loader2,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useVendor } from '@/components/vendor/VendorContext';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

const navigation = [
  { name: 'Inicio', href: '/vendedor', icon: LayoutDashboard },
  { name: 'Reservas', href: '/vendedor/reservas', icon: CalendarCheck },
  { name: 'Enlaces', href: '/vendedor/enlaces', icon: Link2 },
];

const SEGMENT_LABELS: Record<string, string> = {
  vendedor: 'Inicio',
  reservas: 'Reservas',
  nueva: 'Nueva reserva',
  enlaces: 'Enlaces',
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const vendor = useVendor();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/vendedor/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const crumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    let acc = '';
    return parts.map((seg, idx) => {
      acc += `/${seg}`;
      const isDynamic = idx > 1 && !SEGMENT_LABELS[seg];
      return { href: acc, label: isDynamic ? 'Detalle' : SEGMENT_LABELS[seg] ?? seg };
    });
  }, [pathname]);
  return (
    <div className={cn('min-h-screen bg-gray-50 vendor-scope')}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 bg-gray-900 text-gray-200 transform transition-transform duration-200 ease-in-out z-50',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
            <Link href="/vendedor" className="flex items-center space-x-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={logoAlt} className="w-8 h-8 object-contain" />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    width={40}
                    height={40}
                    className="w-8 h-8 object-contain"
                  />
                )}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold text-white whitespace-nowrap">{siteConfig.branding.logo.titleText}</span>
                <span className="text-[11px] text-white/70 font-medium tracking-wide uppercase">Portal vendedor</span>
              </div>
            </Link>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-2 relative">
            {navigation.map((item) => {
              const isActive =
                item.href === '/vendedor'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'relative group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    isActive
                      ? 'bg-white text-slate-950 shadow-lg shadow-black/20'
                      : 'text-gray-200 hover:bg-white/5 hover:text-white'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="vendor-sidebar-rail"
                      className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-full bg-cyan-400"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn('h-5 w-5', isActive ? 'text-slate-950' : 'text-gray-400 group-hover:text-white')} />
                  <span className={cn('font-medium', isActive && 'font-semibold')}>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            {user && (
              <div className="mb-3 px-3 py-2 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-400">Conectado como</p>
                <p className="text-sm font-medium text-white truncate">{vendor.name || user.email}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-200 hover:bg-white/5 hover:text-white disabled:opacity-50"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Cerrando...
                </>
              ) : (
                <>
                  <LogOut className="mr-3 h-5 w-5" />
                  Cerrar sesión
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
                <Menu className="h-6 w-6" />
              </button>
              <nav aria-label="Breadcrumb" className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                  {crumbs.map((c, idx) => (
                    <li key={c.href} className="flex min-w-0 items-center gap-1.5">
                      {idx > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
                      {idx === crumbs.length - 1 ? (
                        <span className="truncate font-semibold text-gray-900">{c.label}</span>
                      ) : (
                        <Link href={c.href} className="truncate transition-colors hover:text-gray-700">
                          {c.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/" target="_blank">
                  Ver sitio
                </Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
