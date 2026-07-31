'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  BookOpen,
  Package, 
  Newspaper,
  Handshake,
  FolderKanban, 
  Image as ImageIcon,
  LogOut, 
  Menu, 
  X,
  MessageSquare,
  Mail,
  Loader2,
  Compass,
  CalendarCheck,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { SITE_NAME } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Categorías', href: '/admin/categorias', icon: FolderKanban },
  { name: 'Excursiones', href: '/admin/paquetes', icon: Package },
   { name: 'Banners', href: '/admin/banners', icon: ImageIcon },
  { name: 'Consultas', href: '/admin/consultas', icon: MessageSquare },
  { name: 'Newsletter', href: '/admin/newsletter', icon: Mail },
  { name: 'Documentación', href: '/admin/documentacion', icon: BookOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  const handleLogout = async () => {
    if (loggingOut) return;
    
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/admin/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const currentTitle = useMemo(() => {
    const found = navigation.find((n) => {
      if (n.href === '/admin') return pathname === n.href;
      return pathname === n.href || pathname.startsWith(n.href + '/');
    });
    return found?.name ?? 'Admin';
  }, [pathname]);

  return (
    <div className={cn('min-h-screen bg-gray-50')}>
      {/* Sidebar móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 bg-gray-900 text-gray-200 transform transition-transform duration-200 ease-in-out z-50',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
            <Link href="/admin" className="flex items-center space-x-3">
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
                <span className="font-logo text-white text-lg whitespace-nowrap">{siteConfig.branding.logo.titleText}</span>
                <span className="text-[11px] text-white/70 font-semibold tracking-wide">Admin</span>
              </div>
            </Link>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-2 relative">
            {navigation.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'relative group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-white text-gray-950 shadow ring-1 ring-white/70'
                      : 'text-gray-200 hover:bg-white/5 hover:text-white'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-rail"
                      className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-full bg-white/90"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'h-5 w-5 transition-colors',
                      isActive ? 'text-gray-950' : 'text-gray-400 group-hover:text-white'
                    )}
                  />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-white/10">
            {user && (
              <div className="mb-3 px-3 py-2 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400">Conectado como:</p>
                <p className="text-base font-medium text-white truncate">
                  {user.email}
                </p>
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

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
          <div className="h-16 flex items-center justify-between px-6">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-900">{currentTitle}</span>
              <Button asChild variant="outline" size="sm">
                <Link href="/" target="_blank">
                  Ver sitio
                </Link>
              </Button>
            </div>
          </div>
          {/* Breadcrumbs para subnavegaciones */}
          {(() => {
            const parts = pathname.split('/').filter(Boolean);
            const isSub = parts.length > 1; // incluye 'admin'
            if (!isSub) return null;
            const crumbs = parts.slice(0); // usar todas para contexto
            let hrefAcc = '';
            return (
              <nav className="px-6 pb-3">
                <ol className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
                  {crumbs.map((seg, idx) => {
                    hrefAcc += `/${seg}`;
                    const label = seg === 'admin'
                      ? 'Admin'
                      : seg.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
                    const isLast = idx === crumbs.length - 1;
                    return (
                      <li key={`${seg}-${idx}`} className="flex items-center gap-1.5">
                        {idx > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
                        {isLast ? (
                          <span className="text-gray-700 font-medium">{label}</span>
                        ) : (
                          <Link href={hrefAcc} className="hover:text-gray-700 transition-colors">
                            {label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            );
          })()}
        </header>

        {/* Page content */}
        <main className="max-w-7xl mx-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
