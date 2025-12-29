/**
 * Product Categories API - Hierarchical product categories
 *
 * Endpoints:
 * GET    /api/admin/categories             - List categories (tree)
 * GET    /api/admin/categories/:id         - Get category
 * POST   /api/admin/categories             - Create category
 * PUT    /api/admin/categories/:id         - Update category
 * DELETE /api/admin/categories/:id         - Delete category
 * POST   /api/admin/categories/reorder     - Reorder categories
 * GET    /api/categories/public            - Public list (for catalog)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';
import { requireSection } from '../middleware/permissions.js';

const categories = new Hono();

// Schemas
const categorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.number().int().optional().nullable(),
  businessType: z.enum(['cafe', 'clothing', 'food', 'pet', 'household', 'general']).optional().nullable(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  position: z.number().int().optional().default(0),
});

const updateCategorySchema = categorySchema.partial();

// Type for category with _count
interface CategoryWithCount {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: number | null;
  level: number;
  position: number;
  _count: { products: number; children?: number };
}

// Helper to calculate level based on parentId
async function calculateLevel(parentId: number | null | undefined, siteId: number): Promise<number> {
  if (!parentId) return 0;

  const parent = await prisma.productCategory.findFirst({
    where: { id: parentId, siteId },
    select: { level: true },
  });

  if (!parent) return 0;
  if (parent.level >= 2) {
    throw new Error('Maximum category depth is 3 levels');
  }

  return parent.level + 1;
}

// ============================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================

// GET /api/categories/public - Public list (for catalog)
categories.get('/public', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  const allCategories = await prisma.productCategory.findMany({
    where: { siteId },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
    orderBy: [
      { level: 'asc' },
      { position: 'asc' },
      { name: 'asc' },
    ],
  });

  // Build tree with product counts
  interface PublicCat { id: number; name: string; slug: string; description: string | null; image: string | null; productCount: number; children: PublicCat[] }
  const categoryMap = new Map<number, PublicCat>();
  const roots: PublicCat[] = [];

  allCategories.forEach((cat: CategoryWithCount) => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      productCount: cat._count.products,
      children: [],
    });
  });

  allCategories.forEach((cat: CategoryWithCount) => {
    const catWithChildren = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(catWithChildren);
    } else {
      roots.push(catWithChildren);
    }
  });

  // Return both flat list and tree structure
  const flatCategories = allCategories.map((cat: CategoryWithCount) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    image: cat.image,
    productsCount: cat._count.products,
    parentId: cat.parentId,
    level: cat.level,
  }));

  return c.json({
    categories: flatCategories,
    tree: roots,
  });
});

// ============================================
// ADMIN ENDPOINTS (auth required)
// ============================================

// GET /api/admin/categories - List all categories for site
categories.get('/', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, async (c) => {
  const siteId = c.get('siteId');
  const { flat } = c.req.query();

  const allCategories = await prisma.productCategory.findMany({
    where: { siteId },
    include: {
      _count: { select: { products: true, children: true } },
    },
    orderBy: [
      { level: 'asc' },
      { position: 'asc' },
      { name: 'asc' },
    ],
  });

  // Return flat list only
  if (flat === 'true') {
    return c.json(allCategories);
  }

  // Build tree structure
  type CatWithChildren = CategoryWithCount & { children: CatWithChildren[] };
  const categoryMap = new Map<number, CatWithChildren>();
  const roots: CatWithChildren[] = [];

  allCategories.forEach((cat: CategoryWithCount) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  allCategories.forEach((cat: CategoryWithCount) => {
    const catWithChildren = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(catWithChildren);
    } else {
      roots.push(catWithChildren);
    }
  });

  // Return both flat categories and tree (frontend expects { categories, tree })
  return c.json({
    categories: allCategories,
    tree: roots,
  });
});

// GET /api/admin/categories/:id - Get single category
categories.get('/:id', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');

  const category = await prisma.productCategory.findFirst({
    where: { id, siteId },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    return c.json({ error: 'Category not found' }, 404);
  }

  return c.json(category);
});

// POST /api/admin/categories - Create category
categories.post('/', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, requireSection('products'), zValidator('json', categorySchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  // Check slug uniqueness
  const existing = await prisma.productCategory.findFirst({
    where: { siteId, slug: data.slug },
  });

  if (existing) {
    return c.json({ error: 'Category with this slug already exists' }, 400);
  }

  // Calculate level
  let level = 0;
  try {
    level = await calculateLevel(data.parentId, siteId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }

  // Verify parent belongs to same site
  if (data.parentId) {
    const parent = await prisma.productCategory.findFirst({
      where: { id: data.parentId, siteId },
    });
    if (!parent) {
      return c.json({ error: 'Parent category not found' }, 400);
    }
  }

  const category = await prisma.productCategory.create({
    data: {
      ...data,
      siteId,
      level,
    },
    include: {
      parent: { select: { id: true, name: true } },
    },
  });

  return c.json(category, 201);
});

// PUT /api/admin/categories/:id - Update category
categories.put('/:id', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, requireSection('products'), zValidator('json', updateCategorySchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  const existing = await prisma.productCategory.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== existing.slug) {
    const duplicate = await prisma.productCategory.findFirst({
      where: { siteId, slug: data.slug, id: { not: id } },
    });
    if (duplicate) {
      return c.json({ error: 'Category with this slug already exists' }, 400);
    }
  }

  // Calculate level if parentId changes
  let level = existing.level;
  if (data.parentId !== undefined && data.parentId !== existing.parentId) {
    // Prevent setting self as parent
    if (data.parentId === id) {
      return c.json({ error: 'Category cannot be its own parent' }, 400);
    }

    try {
      level = await calculateLevel(data.parentId, siteId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }

  const category = await prisma.productCategory.update({
    where: { id },
    data: {
      ...data,
      level,
    },
    include: {
      parent: { select: { id: true, name: true } },
    },
  });

  return c.json(category);
});

// DELETE /api/admin/categories/:id - Delete category
categories.delete('/:id', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, requireSection('products'), async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');

  const existing = await prisma.productCategory.findFirst({
    where: { id, siteId },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  if (existing._count.products > 0) {
    return c.json({ error: 'Cannot delete category with products' }, 400);
  }

  if (existing._count.children > 0) {
    return c.json({ error: 'Cannot delete category with subcategories' }, 400);
  }

  await prisma.productCategory.delete({
    where: { id },
  });

  return c.json({ success: true });
});

// POST /api/admin/categories/reorder - Reorder categories
categories.post('/reorder', authMiddleware, editorOrAdmin, siteMiddleware, requireSite, requireSection('products'), zValidator('json', z.object({
  items: z.array(z.object({
    id: z.number().int(),
    position: z.number().int(),
    parentId: z.number().int().optional().nullable(),
  })),
})), async (c) => {
  const siteId = c.get('siteId');
  const { items } = c.req.valid('json');

  for (const item of items) {
    let level = 0;
    if (item.parentId) {
      const parent = await prisma.productCategory.findFirst({
        where: { id: item.parentId, siteId },
        select: { level: true },
      });
      if (parent) {
        level = Math.min(parent.level + 1, 2);
      }
    }

    await prisma.productCategory.update({
      where: { id: item.id },
      data: {
        position: item.position,
        parentId: item.parentId,
        level,
      },
    });
  }

  return c.json({ success: true });
});

export default categories;
