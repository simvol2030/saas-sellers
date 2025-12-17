import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';

const categories = new Hono();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createCategorySchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  parentId: z.number().int().positive().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

// ==========================================
// ROUTES
// ==========================================

// GET /api/categories - Get all categories
categories.get('/', async (c) => {
  try {
    const allCategories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: {
                status: 'published',
              },
            },
          },
        },
        children: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Transform to include post count
    const categoriesWithCount = allCategories.map((cat: typeof allCategories[0]) => ({
      ...cat,
      postCount: cat._count.posts,
      _count: undefined,
    }));

    return c.json(categoriesWithCount);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

// GET /api/categories/:slug - Get category by slug
categories.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            posts: {
              where: {
                status: 'published',
              },
            },
          },
        },
        children: true,
        parent: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }

    return c.json({
      ...category,
      postCount: category._count.posts,
      _count: undefined,
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return c.json({ error: 'Failed to fetch category' }, 500);
  }
});

// POST /api/categories - Create a new category
categories.post('/', zValidator('json', createCategorySchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const category = await prisma.category.create({
      data,
    });

    return c.json(category, 201);
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return c.json({ error: 'Category with this slug already exists' }, 400);
    }
    return c.json({ error: 'Failed to create category' }, 500);
  }
});

// PUT /api/categories/:slug - Update a category
categories.put('/:slug', zValidator('json', updateCategorySchema), async (c) => {
  try {
    const slug = c.req.param('slug');
    const data = c.req.valid('json');

    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (!existingCategory) {
      return c.json({ error: 'Category not found' }, 404);
    }

    const category = await prisma.category.update({
      where: { slug },
      data,
    });

    return c.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return c.json({ error: 'Failed to update category' }, 500);
  }
});

// DELETE /api/categories/:slug - Delete a category
categories.delete('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const category = await prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }

    await prisma.category.delete({
      where: { slug },
    });

    return c.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return c.json({ error: 'Failed to delete category' }, 500);
  }
});

export default categories;
