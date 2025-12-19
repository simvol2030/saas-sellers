import { defineMiddleware } from 'astro:middleware';

// Reserved paths that should not be checked as dynamic pages
const RESERVED_PATHS = [
  '/admin',
  '/blog',
  '/about',
  '/p/',
  '/api',
  '/_',
  '/404',
  '/favicon',
  '/robots',
  '/sitemap',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;
  const pathname = url.pathname;

  // Skip reserved paths and static files
  if (
    RESERVED_PATHS.some(path => pathname.startsWith(path)) ||
    pathname.includes('.') ||
    pathname === '/'
  ) {
    return next();
  }

  // Extract slug from pathname (remove leading slash)
  const slug = pathname.slice(1);

  // Check if this is a dynamic page by trying to fetch it from backend
  try {
    // Use direct backend URL (localhost on same server)
    const API_BASE = 'http://localhost:3001';
    const response = await fetch(`${API_BASE}/api/pages/${slug}`);

    if (response.ok) {
      // Page exists! Rewrite to /p/[slug]
      return context.rewrite(`/p/${slug}`);
    }
  } catch (error) {
    console.error('Error checking page:', error);
  }

  // Not a dynamic page, continue with normal routing (will show 404)
  return next();
});
