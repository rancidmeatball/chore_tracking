import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Log ALL requests including API and static files to debug routing
  const pathname = request.nextUrl.pathname
  console.log(`[Middleware] ${request.method} ${pathname}`)
  
  // Always pass through - don't block anything
  return NextResponse.next()
}

export const config = {
  matcher: '/(.*)',
}
