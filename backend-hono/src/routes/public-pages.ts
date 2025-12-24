/**
 * Public Pages API Routes
 *
 * Публичный доступ к опубликованным страницам (без аутентификации)
 *
 * Endpoints:
 * GET /api/pages         - List published pages
 * GET /api/pages/:slug   - Get published page by slug
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';

const publicPages = new Hono();

/**
 * GET /api/pages
 * List all published pages
 */
publicPages.get('/', async (c) => {
  try {
    const pages = await prisma.page.findMany({
      where: {
        status: 'published',
      },
      orderBy: {
        publishedAt: 'desc',
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        publishedAt: true,
      },
    });

    return c.json({ pages });
  } catch (error) {
    console.error('List public pages error:', error);
    return c.json({ error: 'Failed to list pages' }, 500);
  }
});

/**
 * GET /api/pages/:slug
 * Get single published page by slug
 */
publicPages.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  try {
    const page = await prisma.page.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Only return published pages
    if (page.status !== 'published') {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Parse JSON fields
    return c.json({
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        sections: JSON.parse(page.sections),
        headerConfig: page.headerConfig ? JSON.parse(page.headerConfig) : null,
        footerConfig: page.footerConfig ? JSON.parse(page.footerConfig) : null,
        hideHeader: page.hideHeader,
        hideFooter: page.hideFooter,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        ogImage: page.ogImage,
        canonicalUrl: page.canonicalUrl,
        noindex: page.noindex,
        publishedAt: page.publishedAt,
        author: page.author,
      },
    });
  } catch (error) {
    console.error('Get public page error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

export default publicPages;
