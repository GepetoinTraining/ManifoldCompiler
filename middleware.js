import { NextResponse } from 'next/server'

export function middleware(request) {
  const hostname = request.headers.get('host') || ''

  if (hostname.startsWith('pedro.manifold-compiler')) {
    const { pathname } = request.nextUrl

    // Root → serve /os/index.html
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/os/index.html', request.url))
    }

    // gallery → serve /os/gallery.html
    if (pathname === '/gallery') {
      return NextResponse.rewrite(new URL('/os/gallery.html', request.url))
    }

    // All other requests (css, js, etc) → serve from /os/
    if (!pathname.startsWith('/os/')) {
      return NextResponse.rewrite(new URL(`/os${pathname}`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
}
