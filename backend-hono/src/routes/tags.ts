import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';

const tags = new Hono();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createTagSchema = z.object({
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateTagSchema = createTagSchema.partial();

// ==========================================
// ROUTES
// ==========================================

// GET /api/tags - Get all tags
tags.get('/', async (c) => {
  try {
    const allTags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform to include post count
    const tagsWithCount = allTags.map((tag: typeof allTags[0]) => ({
      ...tag,
      postCount: tag._count.posts,
      _count: undefined,
    }));

    return c.json(tagsWithCount);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// GET /api/tags/:slug - Get tag by slug
tags.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const tag = await prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    return c.json({
      ...tag,
      postCount: tag._count.posts,
      _count: undefined,
    });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return c.json({ error: 'Failed to fetch tag' }, 500);
  }
});

// POST /api/tags - Create a new tag
tags.post('/', zValidator('json', createTagSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const tag = await prisma.tag.create({
      data,
    });

    return c.json(tag, 201);
  } catch (error: any) {
    console.error('Error creating tag:', error);
    if (error.code === 'P2002') {
      return c.json({ error: 'Tag with this slug already exists' }, 400);
    }
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

// PUT /api/tags/:slug - Update a tag
tags.put('/:slug', zValidator('json', updateTagSchema), async (c) => {
  try {
    const slug = c.req.param('slug');
    const data = c.req.valid('json');

    const existingTag = await prisma.tag.findUnique({
      where: { slug },
    });

    if (!existingTag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    const tag = await prisma.tag.update({
      where: { slug },
      data,
    });

    return c.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return c.json({ error: 'Failed to update tag' }, 500);
  }
});

// DELETE /api/tags/:slug - Delete a tag
tags.delete('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const tag = await prisma.tag.findUnique({
      where: { slug },
    });

    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    await prisma.tag.delete({
      where: { slug },
    });

    return c.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return c.json({ error: 'Failed to delete tag' }, 500);
  }
});

export default tags;
