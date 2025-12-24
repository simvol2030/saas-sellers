/**
 * Tags API - Page tagging system
 *
 * Endpoints:
 * GET    /api/admin/tags           - List tags
 * POST   /api/admin/tags           - Create tag
 * GET    /api/admin/tags/:id       - Get tag
 * PUT    /api/admin/tags/:id       - Update tag
 * DELETE /api/admin/tags/:id       - Delete tag
 * PUT    /api/admin/pages/:id/tags - Update page tags (in pages.ts)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const tags = new Hono();

// Apply middlewares
tags.use('*', authMiddleware);
tags.use('*', editorOrAdmin);
tags.use('*', siteMiddleware);
tags.use('*', requireSite);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional().nullable(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/admin/tags - List all tags for current site
 */
tags.get('/', async (c) => {
  const siteId = c.get('siteId');

  try {
    const allTags = await prisma.tag.findMany({
      where: { siteId },
      include: {
        _count: {
          select: { pages: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return c.json({
      tags: allTags.map((tag: typeof allTags[0]) => ({
        ...tag,
        pageCount: tag._count.pages,
      })),
      total: allTags.length,
    });
  } catch (error) {
    console.error('Error listing tags:', error);
    return c.json({ error: 'Failed to list tags' }, 500);
  }
});

/**
 * POST /api/admin/tags - Create tag
 */
tags.post('/', zValidator('json', createTagSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  try {
    // Check slug uniqueness within site
    const existingSlug = await prisma.tag.findUnique({
      where: {
        siteId_slug: {
          siteId,
          slug: data.slug,
        },
      },
    });

    if (existingSlug) {
      return c.json({ error: 'Tag with this slug already exists' }, 400);
    }

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        slug: data.slug,
        color: data.color || null,
        siteId,
      },
    });

    return c.json({ tag }, 201);
  } catch (error) {
    console.error('Error creating tag:', error);
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

/**
 * GET /api/admin/tags/:id - Get tag details
 */
tags.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid tag ID' }, 400);
  }

  try {
    const tag = await prisma.tag.findFirst({
      where: { id, siteId },
      include: {
        pages: {
          include: {
            page: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    return c.json({
      tag: {
        ...tag,
        pages: tag.pages.map((pt: typeof tag.pages[0]) => pt.page),
      },
    });
  } catch (error) {
    console.error('Error getting tag:', error);
    return c.json({ error: 'Failed to get tag' }, 500);
  }
});

/**
 * PUT /api/admin/tags/:id - Update tag
 */
tags.put('/:id', zValidator('json', updateTagSchema), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid tag ID' }, 400);
  }

  try {
    const existingTag = await prisma.tag.findFirst({
      where: { id, siteId },
    });

    if (!existingTag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existingTag.slug) {
      const slugExists = await prisma.tag.findUnique({
        where: {
          siteId_slug: {
            siteId,
            slug: data.slug,
          },
        },
      });

      if (slugExists) {
        return c.json({ error: 'Tag with this slug already exists' }, 400);
      }
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });

    return c.json({ tag });
  } catch (error) {
    console.error('Error updating tag:', error);
    return c.json({ error: 'Failed to update tag' }, 500);
  }
});

/**
 * DELETE /api/admin/tags/:id - Delete tag
 */
tags.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid tag ID' }, 400);
  }

  try {
    const tag = await prisma.tag.findFirst({
      where: { id, siteId },
    });

    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // Delete tag (cascades to page_tags)
    await prisma.tag.delete({
      where: { id },
    });

    return c.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return c.json({ error: 'Failed to delete tag' }, 500);
  }
});

export default tags;
