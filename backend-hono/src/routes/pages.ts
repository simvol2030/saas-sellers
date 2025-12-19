/**
 * Pages API Routes
 *
 * CRUD операции для страниц лендингов
 *
 * Endpoints:
 * GET    /api/admin/pages         - List pages (with pagination)
 * POST   /api/admin/pages         - Create page
 * GET    /api/admin/pages/:id     - Get page by ID
 * PUT    /api/admin/pages/:id     - Update page
 * DELETE /api/admin/pages/:id     - Delete page
 * POST   /api/admin/pages/:id/publish   - Publish page
 * POST   /api/admin/pages/:id/unpublish - Unpublish page
 * POST   /api/admin/pages/:id/duplicate - Duplicate page
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { authMiddleware, editorOrAdmin } from '../middleware/auth';

const pages = new Hono();

// Apply auth to all routes
pages.use('*', authMiddleware);
pages.use('*', editorOrAdmin);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const sectionSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  className: z.string().optional(),
  hidden: z.boolean().optional(),
}).passthrough(); // Allow additional fields

const createPageSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(500).nullish(),
  sections: z.array(sectionSchema).default([]),
  headerConfig: z.string().nullish(), // JSON string
  footerConfig: z.string().nullish(), // JSON string
  hideHeader: z.boolean().default(false),
  hideFooter: z.boolean().default(false),
  metaTitle: z.string().max(100).nullish(),
  metaDescription: z.string().max(200).nullish(),
  ogImage: z.string().nullish(),
  canonicalUrl: z.string().nullish(),
  noindex: z.boolean().default(false),
  prerender: z.boolean().default(true),
});

const updatePageSchema = createPageSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['all', 'draft', 'published']).default('all'),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/pages
 * List pages with pagination and filters
 */
pages.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { page, limit, status, search, sortBy, sortOrder } = c.req.valid('query');
  const offset = (page - 1) * limit;

  try {
    // Build where clause
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Get total count
    const total = await prisma.page.count({ where });

    // Get pages
    const pagesList = await prisma.page.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        publishedAt: true,
        prerender: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      pages: pagesList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List pages error:', error);
    return c.json({ error: 'Failed to list pages' }, 500);
  }
});

/**
 * POST /api/admin/pages
 * Create new page
 */
pages.post('/', zValidator('json', createPageSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user');

  try {
    // Check if slug already exists
    const existing = await prisma.page.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return c.json({
        error: 'Page with this slug already exists',
        code: 'SLUG_EXISTS',
      }, 400);
    }

    // Create page
    const page = await prisma.page.create({
      data: {
        ...data,
        sections: JSON.stringify(data.sections),
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page created successfully',
      page: {
        ...page,
        sections: JSON.parse(page.sections),
      },
    }, 201);
  } catch (error) {
    console.error('Create page error:', error);
    return c.json({ error: 'Failed to create page' }, 500);
  }
});

/**
 * GET /api/admin/pages/:id
 * Get page by ID
 */
pages.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    return c.json({
      page: {
        ...page,
        sections: JSON.parse(page.sections),
        headerConfig: page.headerConfig ? JSON.parse(page.headerConfig) : null,
        footerConfig: page.footerConfig ? JSON.parse(page.footerConfig) : null,
      },
    });
  } catch (error) {
    console.error('Get page error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

/**
 * PUT /api/admin/pages/:id
 * Update page
 */
pages.put('/:id', zValidator('json', updatePageSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    // Check if page exists
    const existing = await prisma.page.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.page.findUnique({
        where: { slug: data.slug },
      });

      if (slugExists) {
        return c.json({
          error: 'Page with this slug already exists',
          code: 'SLUG_EXISTS',
        }, 400);
      }
    }

    // Prepare update data
    const updateData: any = { ...data };
    if (data.sections) {
      updateData.sections = JSON.stringify(data.sections);
    }

    // Update page
    const page = await prisma.page.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page updated successfully',
      page: {
        ...page,
        sections: JSON.parse(page.sections),
      },
    });
  } catch (error) {
    console.error('Update page error:', error);
    return c.json({ error: 'Failed to update page' }, 500);
  }
});

/**
 * DELETE /api/admin/pages/:id
 * Delete page
 */
pages.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findUnique({
      where: { id },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    await prisma.page.delete({
      where: { id },
    });

    return c.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Delete page error:', error);
    return c.json({ error: 'Failed to delete page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/publish
 * Publish page
 */
pages.post('/:id/publish', async (c) => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findUnique({
      where: { id },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    if (page.status === 'published') {
      return c.json({ error: 'Page is already published' }, 400);
    }

    const updated = await prisma.page.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    return c.json({
      message: 'Page published successfully',
      page: {
        ...updated,
        sections: JSON.parse(updated.sections),
      },
    });
  } catch (error) {
    console.error('Publish page error:', error);
    return c.json({ error: 'Failed to publish page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/unpublish
 * Unpublish page (set to draft)
 */
pages.post('/:id/unpublish', async (c) => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findUnique({
      where: { id },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    if (page.status === 'draft') {
      return c.json({ error: 'Page is already a draft' }, 400);
    }

    const updated = await prisma.page.update({
      where: { id },
      data: {
        status: 'draft',
      },
    });

    return c.json({
      message: 'Page unpublished successfully',
      page: {
        ...updated,
        sections: JSON.parse(updated.sections),
      },
    });
  } catch (error) {
    console.error('Unpublish page error:', error);
    return c.json({ error: 'Failed to unpublish page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/duplicate
 * Duplicate page
 */
pages.post('/:id/duplicate', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const user = c.get('user');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const original = await prisma.page.findUnique({
      where: { id },
    });

    if (!original) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Generate unique slug
    let newSlug = `${original.slug}-copy`;
    let counter = 1;

    while (await prisma.page.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${original.slug}-copy-${counter}`;
      counter++;
    }

    // Create duplicate
    const duplicate = await prisma.page.create({
      data: {
        slug: newSlug,
        title: `${original.title} (Copy)`,
        description: original.description,
        sections: original.sections,
        headerConfig: original.headerConfig,
        footerConfig: original.footerConfig,
        hideHeader: original.hideHeader,
        hideFooter: original.hideFooter,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        ogImage: original.ogImage,
        canonicalUrl: null, // Don't duplicate canonical URL
        noindex: true, // Set noindex for duplicate
        prerender: original.prerender,
        status: 'draft', // Always start as draft
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page duplicated successfully',
      page: {
        ...duplicate,
        sections: JSON.parse(duplicate.sections),
      },
    }, 201);
  } catch (error) {
    console.error('Duplicate page error:', error);
    return c.json({ error: 'Failed to duplicate page' }, 500);
  }
});

export default pages;
