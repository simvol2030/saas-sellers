/**
 * Public Pages API Routes
 *
 * Публичный доступ к опубликованным страницам (без аутентификации)
 * Использует publicSiteMiddleware для определения сайта по домену/субдомену
 *
 * Endpoints:
 * GET /api/pages         - List published pages for current site
 * GET /api/pages/:slug   - Get published page by slug
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { publicSiteMiddleware } from '../middleware/site.js';

const publicPages = new Hono();

// Apply public site middleware to determine site from domain/subdomain
publicPages.use('*', publicSiteMiddleware);

/**
 * GET /api/pages
 * List all published pages for current site
 */
publicPages.get('/', async (c) => {
  const siteId = c.get('siteId');

  // If no site context, return empty array (graceful fallback)
  if (!siteId) {
    return c.json({ pages: [], error: 'Site not found' });
  }

  try {
    const pages = await prisma.page.findMany({
      where: {
        siteId,
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
        path: true,
        level: true,
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
 * Get single published page by slug (within current site)
 */
publicPages.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const siteId = c.get('siteId');

  if (!siteId) {
    return c.json({ error: 'Site not found' }, 404);
  }

  try {
    // Use findFirst with siteId since slug is unique per site
    const page = await prisma.page.findFirst({
      where: {
        siteId,
        slug,
        status: 'published',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!page) {
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
        path: page.path,
        level: page.level,
        author: page.author,
        tags: page.tags.map((pt: typeof page.tags[0]) => pt.tag),
      },
    });
  } catch (error) {
    console.error('Get public page error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

/**
 * GET /api/pages/path/*
 * Get page by full path (e.g., /parent/child/grandchild)
 */
publicPages.get('/path/*', async (c) => {
  const fullPath = '/' + (c.req.param('*') || '');
  const siteId = c.get('siteId');

  if (!siteId) {
    return c.json({ error: 'Site not found' }, 404);
  }

  try {
    const page = await prisma.page.findFirst({
      where: {
        siteId,
        path: fullPath,
        status: 'published',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

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
        path: page.path,
        level: page.level,
        author: page.author,
        tags: page.tags.map((pt: typeof page.tags[0]) => pt.tag),
      },
    });
  } catch (error) {
    console.error('Get public page by path error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

export default publicPages;
