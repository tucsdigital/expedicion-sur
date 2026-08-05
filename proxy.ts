import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/vendedor') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/user') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const redirects: Array<[boolean, string]> = [
    [pathname === '/agencias', '/'],
    [pathname === '/transportes', '/'],
    [pathname === '/riodejaneiro', '/'],
    [pathname === '/educativos', '/'],
  ];

  const match = redirects.find(([condition]) => condition);
  if (!match) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = match[1];
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!favicon.ico).*)'],
};
