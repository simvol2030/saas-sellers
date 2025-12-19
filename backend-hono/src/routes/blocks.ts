/**
 * Reusable Blocks API - Section templates for pages
 *
 * Endpoints:
 * GET    /api/admin/blocks             - List blocks
 * POST   /api/admin/blocks             - Create block
 * GET    /api/admin/blocks/:id         - Get block
 * PUT    /api/admin/blocks/:id         - Update block
 * DELETE /api/admin/blocks/:id         - Delete block
 * GET    /api/admin/blocks/:id/usages  - Where is block used
 * POST   /api/admin/pages/:id/blocks   - Insert block into page
 * DELETE /api/admin/pages/:id/blocks/:usageId - Remove block from page
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const blocks = new Hono();

// Apply middlewares
blocks.use('*', authMiddleware);
blocks.use('*', editorOrAdmin);
blocks.use('*', siteMiddleware);
blocks.use('*', requireSite);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const sectionSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.any()),
});

const createBlockSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(500).optional().nullable(),
  sections: z.array(sectionSchema).min(1, 'At least one section is required'),
  category: z.string().max(50).optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
});

const updateBlockSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
  sections: z.array(sectionSchema).optional(),
  category: z.string().max(50).optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
});

const insertBlockSchema = z.object({
  blockId: z.number(),
  position: z.number().min(0, 'Position must be non-negative'),
});

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/admin/blocks - List all blocks for current site
 */
blocks.get('/', async (c) => {
  const siteId = c.get('siteId');
  const category = c.req.query('category');

  try {
    const whereClause: any = { siteId };
    if (category) {
      whereClause.category = category;
    }

    const allBlocks = await prisma.reusableBlock.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { usages: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Get unique categories
    const categories = await prisma.reusableBlock.findMany({
      where: { siteId },
      select: { category: true },
      distinct: ['category'],
    });

    return c.json({
      blocks: allBlocks.map((block: typeof allBlocks[0]) => ({
        ...block,
        sections: JSON.parse(block.sections),
        usageCount: block._count.usages,
      })),
      categories: categories.map((cat: typeof categories[0]) => cat.category).filter(Boolean),
      total: allBlocks.length,
    });
  } catch (error) {
    console.error('Error listing blocks:', error);
    return c.json({ error: 'Failed to list blocks' }, 500);
  }
});

/**
 * POST /api/admin/blocks - Create block
 */
blocks.post('/', zValidator('json', createBlockSchema), async (c) => {
  const siteId = c.get('siteId');
  const user = c.get('user');
  const data = c.req.valid('json');

  try {
    // Check slug uniqueness within site
    const existingSlug = await prisma.reusableBlock.findUnique({
      where: {
        siteId_slug: {
          siteId,
          slug: data.slug,
        },
      },
    });

    if (existingSlug) {
      return c.json({ error: 'Block with this slug already exists' }, 400);
    }

    const block = await prisma.reusableBlock.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        sections: JSON.stringify(data.sections),
        category: data.category || null,
        thumbnail: data.thumbnail || null,
        siteId,
        authorId: user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return c.json(
      {
        block: {
          ...block,
          sections: JSON.parse(block.sections),
        },
      },
      201
    );
  } catch (error) {
    console.error('Error creating block:', error);
    return c.json({ error: 'Failed to create block' }, 500);
  }
});

/**
 * GET /api/admin/blocks/:id - Get block details
 */
blocks.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid block ID' }, 400);
  }

  try {
    const block = await prisma.reusableBlock.findFirst({
      where: { id, siteId },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        usages: {
          include: {
            page: {
              select: { id: true, title: true, slug: true, status: true },
            },
          },
        },
      },
    });

    if (!block) {
      return c.json({ error: 'Block not found' }, 404);
    }

    return c.json({
      block: {
        ...block,
        sections: JSON.parse(block.sections),
      },
    });
  } catch (error) {
    console.error('Error getting block:', error);
    return c.json({ error: 'Failed to get block' }, 500);
  }
});

/**
 * PUT /api/admin/blocks/:id - Update block
 * IMPORTANT: Changes apply to ALL pages where this block is used!
 */
blocks.put('/:id', zValidator('json', updateBlockSchema), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid block ID' }, 400);
  }

  try {
    const existingBlock = await prisma.reusableBlock.findFirst({
      where: { id, siteId },
      include: {
        _count: { select: { usages: true } },
      },
    });

    if (!existingBlock) {
      return c.json({ error: 'Block not found' }, 404);
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existingBlock.slug) {
      const slugExists = await prisma.reusableBlock.findUnique({
        where: {
          siteId_slug: {
            siteId,
            slug: data.slug,
          },
        },
      });

      if (slugExists) {
        return c.json({ error: 'Block with this slug already exists' }, 400);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sections !== undefined) updateData.sections = JSON.stringify(data.sections);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail;

    const block = await prisma.reusableBlock.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        _count: { select: { usages: true } },
      },
    });

    return c.json({
      block: {
        ...block,
        sections: JSON.parse(block.sections),
        usageCount: block._count.usages,
      },
      message:
        block._count.usages > 0
          ? `Block updated. Changes applied to ${block._count.usages} page(s).`
          : 'Block updated.',
    });
  } catch (error) {
    console.error('Error updating block:', error);
    return c.json({ error: 'Failed to update block' }, 500);
  }
});

/**
 * DELETE /api/admin/blocks/:id - Delete block
 */
blocks.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid block ID' }, 400);
  }

  try {
    const block = await prisma.reusableBlock.findFirst({
      where: { id, siteId },
      include: {
        _count: { select: { usages: true } },
      },
    });

    if (!block) {
      return c.json({ error: 'Block not found' }, 404);
    }

    // Warn if block is in use
    if (block._count.usages > 0) {
      const forceDelete = c.req.query('force') === 'true';
      if (!forceDelete) {
        return c.json(
          {
            error: 'Block is in use',
            message: `This block is used in ${block._count.usages} page(s). Add ?force=true to delete anyway.`,
            usageCount: block._count.usages,
          },
          400
        );
      }
    }

    // Delete block (cascades to block_usages)
    await prisma.reusableBlock.delete({
      where: { id },
    });

    return c.json({ message: 'Block deleted successfully' });
  } catch (error) {
    console.error('Error deleting block:', error);
    return c.json({ error: 'Failed to delete block' }, 500);
  }
});

/**
 * GET /api/admin/blocks/:id/usages - List pages where block is used
 */
blocks.get('/:id/usages', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid block ID' }, 400);
  }

  try {
    const block = await prisma.reusableBlock.findFirst({
      where: { id, siteId },
    });

    if (!block) {
      return c.json({ error: 'Block not found' }, 404);
    }

    const usages = await prisma.blockUsage.findMany({
      where: { blockId: id },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      block: {
        id: block.id,
        name: block.name,
        slug: block.slug,
      },
      usages: usages.map((u: typeof usages[0]) => ({
        ...u,
        page: u.page,
      })),
      total: usages.length,
    });
  } catch (error) {
    console.error('Error getting block usages:', error);
    return c.json({ error: 'Failed to get block usages' }, 500);
  }
});

/**
 * POST /api/admin/pages/:pageId/blocks - Insert block into page
 */
blocks.post('/page/:pageId', zValidator('json', insertBlockSchema), async (c) => {
  const siteId = c.get('siteId');
  const pageId = parseInt(c.req.param('pageId'));
  const { blockId, position } = c.req.valid('json');

  if (isNaN(pageId)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    // Verify page exists and belongs to site
    const page = await prisma.page.findFirst({
      where: { id: pageId, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Verify block exists and belongs to site
    const block = await prisma.reusableBlock.findFirst({
      where: { id: blockId, siteId },
    });

    if (!block) {
      return c.json({ error: 'Block not found' }, 404);
    }

    // Check if position is already taken
    const existingUsage = await prisma.blockUsage.findUnique({
      where: {
        pageId_position: {
          pageId,
          position,
        },
      },
    });

    if (existingUsage) {
      return c.json({ error: 'Position already has a block' }, 400);
    }

    const usage = await prisma.blockUsage.create({
      data: {
        blockId,
        pageId,
        position,
      },
      include: {
        block: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return c.json(
      {
        usage,
        message: `Block "${block.name}" inserted at position ${position}`,
      },
      201
    );
  } catch (error) {
    console.error('Error inserting block:', error);
    return c.json({ error: 'Failed to insert block' }, 500);
  }
});

/**
 * DELETE /api/admin/pages/:pageId/blocks/:usageId - Remove block from page
 */
blocks.delete('/page/:pageId/:usageId', async (c) => {
  const siteId = c.get('siteId');
  const pageId = parseInt(c.req.param('pageId'));
  const usageId = parseInt(c.req.param('usageId'));

  if (isNaN(pageId) || isNaN(usageId)) {
    return c.json({ error: 'Invalid IDs' }, 400);
  }

  try {
    // Verify page exists and belongs to site
    const page = await prisma.page.findFirst({
      where: { id: pageId, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    const usage = await prisma.blockUsage.findFirst({
      where: { id: usageId, pageId },
    });

    if (!usage) {
      return c.json({ error: 'Block usage not found' }, 404);
    }

    await prisma.blockUsage.delete({
      where: { id: usageId },
    });

    return c.json({ message: 'Block removed from page' });
  } catch (error) {
    console.error('Error removing block:', error);
    return c.json({ error: 'Failed to remove block' }, 500);
  }
});

export default blocks;
