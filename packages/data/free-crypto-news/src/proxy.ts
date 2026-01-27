/**
 * Internationalization Proxy
 * 
 * Handles locale detection and routing for next-intl.
 * Automatically detects user's preferred language from Accept-Language header
 * and redirects to the appropriate locale-prefixed route.
 * 
 * @note Next.js 16 uses "proxy.ts" instead of "middleware.ts"
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/navigation';
import type { NextRequest } from 'next/server';

/**
 * The next-intl middleware handles:
 * - Locale detection from Accept-Language header
 * - Redirect to locale-prefixed routes
 * - Locale cookie management
 */
const intlMiddleware = createMiddleware(routing);

/**
 * Proxy function for Next.js 16+
 * Replaces the deprecated middleware convention
 */
export function proxy(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except:
  // - API routes (/api/*)
  // - Next.js internals (_next/*)
  // - Vercel internals (_vercel/*)
  // - Static files (*.ico, *.png, *.svg, *.xml, *.json, *.txt, *.js, *.css, *.woff, *.woff2)
  // - Feed routes (/feed.xml)
  matcher: [
    '/',
    '/((?!api|_next|_vercel|feed\\.xml|.*\\.(?:ico|png|jpg|jpeg|gif|svg|xml|json|txt|js|css|woff|woff2|webp|avif)).*)',
  ],
};
