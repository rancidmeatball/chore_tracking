import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Log ALL requests including API and static files to debug routing
  const pathname = request.nextUrl.pathname
  const url = request.nextUrl.toString()
  console.log(`[Middleware] ${request.method} ${pathname} (full URL: ${url})`)
  
  // Always pass through - don't block anything
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match ALL paths to see all requests
     * This will help us debug why routes aren't being found
     */
    '/(.*)',
  ],
}
