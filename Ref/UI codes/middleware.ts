import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── Inline role config (can't import .ts modules in edge middleware) ──
const SESSION_COOKIE = 'pos_session'

const PUBLIC_PREFIXES = ['/landing', '/auth', '/demo', '/unauthorized']

const ROLE_CONFIG: Record<string, { home: string; prefixes: string[] }> = {
  admin:   { home: '/admin/dashboard',  prefixes: ['/admin', '/pos', '/kitchen'] },
  manager: { home: '/admin/dashboard',  prefixes: ['/admin', '/pos'] },
  cashier: { home: '/pos/floor',        prefixes: ['/pos'] },
  kitchen: { home: '/kitchen/display',  prefixes: ['/kitchen'] },
  waiter:  { home: '/pos/floor',        prefixes: ['/pos'] },
}

function parseSession(cookieValue: string | undefined): { role: string; email: string } | null {
  if (!cookieValue) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue))
    if (parsed.role && parsed.email) return parsed
    return null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Root → Landing ──────────────────────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // ── 2. Parse session ───────────────────────────────────────────
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSession(rawCookie)

  // ── 3. Public routes — allow everyone ──────────────────────────
  const isPublic = PUBLIC_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (isPublic) {
    // If already logged in and hitting /auth/*, redirect to their home
    if (session && pathname.startsWith('/auth')) {
      const config = ROLE_CONFIG[session.role]
      if (config) {
        return NextResponse.redirect(new URL(config.home, request.url))
      }
    }
    return NextResponse.next()
  }

  // ── 4. Not authenticated → login ──────────────────────────────
  if (!session) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 5. Role-Based Access Control ──────────────────────────────
  const config = ROLE_CONFIG[session.role]
  if (!config) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  const isAllowed = config.prefixes.some(prefix => pathname.startsWith(prefix))

  if (!isAllowed) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
}
