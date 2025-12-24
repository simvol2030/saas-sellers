/**
 * Products API - E-commerce product management
 *
 * Endpoints:
 * GET    /api/admin/products             - List products with filters
 * GET    /api/admin/products/:id         - Get product
 * POST   /api/admin/products             - Create product
 * PUT    /api/admin/products/:id         - Update product
 * DELETE /api/admin/products/:id         - Delete product
 * POST   /api/admin/products/:id/duplicate - Duplicate product
 * POST   /api/admin/products/bulk-status - Bulk status update
 * POST   /api/admin/products/bulk-delete - Bulk delete
 * GET    /api/products/public            - Public product list
 * GET    /api/products/public/:slug      - Public product by slug
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';
import { requireSection } from '../middleware/permissions.js';

const products = new Hono();

// Types
interface ProductVariant {
  id?: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  comparePrice?: number | null;
  prices: Record<string, number>;
  stock: number;
  imageUrl?: string | null;
  options: Record<string, unknown>;
  position: number;
  isActive: boolean;
}

interface ProductAttribute {
  id?: number;
  name: string;
  value: string;
  group?: string | null;
}

interface ProductModifier {
  id?: number;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: Array<{ name: string; price: number }>;
  position: number;
}

interface ProductImage {
  id?: number;
  url: string;
  alt?: string | null;
  position: number;
  isMain: boolean;
}

// Schemas
const variantSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  comparePrice: z.number().optional().nullable(),
  prices: z.record(z.string(), z.number()).optional().default({}),
  stock: z.number().int().optional().default(0),
  imageUrl: z.string().optional().nullable(),
  options: z.record(z.string(), z.unknown()).optional().default({}),
  position: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const attributeSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  value: z.string().min(1),
  group: z.string().optional().nullable(),
});

const modifierSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  type: z.enum(['single', 'multiple']).default('single'),
  required: z.boolean().default(false),
  options: z.array(z.object({
    name: z.string(),
    price: z.number().default(0),
  })).default([]),
  position: z.number().int().default(0),
});

const imageSchema = z.object({
  id: z.number().int().optional(),
  url: z.string().min(1),
  alt: z.string().optional().nullable(),
  position: z.number().int().default(0),
  isMain: z.boolean().default(false),
});

const productSchema = z.object({
  name: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  shortDesc: z.string().optional().nullable(),
  price: z.number().default(0),
  comparePrice: z.number().optional().nullable(),
  costPrice: z.number().optional().nullable(),
  prices: z.record(z.string(), z.number()).optional().default({}),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  stock: z.number().int().default(0),
  trackStock: z.boolean().default(true),
  lowStockThreshold: z.number().int().default(5),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  weight: z.number().optional().nullable(),
  dimensions: z.record(z.string(), z.number()).optional().nullable(),
  productType: z.enum(['general', 'clothing', 'food', 'cafe', 'pet', 'household']).default('general'),
  categoryId: z.number().int().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  variants: z.array(variantSchema).optional().default([]),
  attributes: z.array(attributeSchema).optional().default([]),
  modifiers: z.array(modifierSchema).optional().default([]),
  images: z.array(imageSchema).optional().default([]),
});

const updateProductSchema = productSchema.partial();

// Apply common middlewares for admin routes
products.use('*', authMiddleware);
products.use('*', editorOrAdmin);
products.use('*', siteMiddleware);

// GET /api/admin/products - List products with filters
products.get('/', requireSite, async (c) => {
  const siteId = c.get('siteId');
  const {
    page = '1',
    limit = '20',
    status,
    categoryId,
    search,
    productType,
    featured,
  } = c.req.query();

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: Record<string, unknown> = { siteId };

  if (status) where.status = status;
  if (categoryId) where.categoryId = parseInt(categoryId);
  if (productType) where.productType = productType;
  if (featured === 'true') where.featured = true;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isMain: true }, take: 1 },
        _count: { select: { variants: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return c.json({
    items,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / take),
  });
});

// GET /api/products/public - Public product list
products.get('/public', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const {
    page = '1',
    limit = '20',
    categorySlug,
    search,
    sort = 'newest',
    featured,
  } = c.req.query();

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: Record<string, unknown> = {
    siteId,
    status: 'published',
  };

  if (categorySlug) {
    const category = await prisma.productCategory.findFirst({
      where: { siteId, slug: categorySlug },
    });
    if (category) {
      where.categoryId = category.id;
    }
  }

  if (featured === 'true') where.featured = true;

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { shortDesc: { contains: search } },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: 'desc' };
  switch (sort) {
    case 'price_asc': orderBy = { price: 'asc' }; break;
    case 'price_desc': orderBy = { price: 'desc' }; break;
    case 'name_asc': orderBy = { name: 'asc' }; break;
    case 'name_desc': orderBy = { name: 'desc' }; break;
    case 'newest': orderBy = { createdAt: 'desc' }; break;
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDesc: true,
        price: true,
        comparePrice: true,
        prices: true,
        stock: true,
        trackStock: true,
        featured: true,
        category: { select: { id: true, name: true, slug: true } },
        images: {
          where: { isMain: true },
          take: 1,
          select: { url: true, alt: true },
        },
        _count: { select: { variants: true } },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return c.json({
    items,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / take),
  });
});

// GET /api/admin/products/:id - Get single product
products.get('/:id', requireSite, async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');

  const product = await prisma.product.findFirst({
    where: { id, siteId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: 'asc' } },
      variants: { orderBy: { position: 'asc' } },
      attributes: true,
      modifiers: { orderBy: { position: 'asc' } },
    },
  });

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Parse JSON fields
  type VariantResult = typeof product.variants[number];
  type ModifierResult = typeof product.modifiers[number];

  const result = {
    ...product,
    prices: JSON.parse(product.prices),
    dimensions: product.dimensions ? JSON.parse(product.dimensions) : null,
    variants: product.variants.map((v: VariantResult) => ({
      ...v,
      prices: JSON.parse(v.prices),
      options: JSON.parse(v.options),
    })),
    modifiers: product.modifiers.map((m: ModifierResult) => ({
      ...m,
      options: JSON.parse(m.options),
    })),
  };

  return c.json(result);
});

// GET /api/products/public/:slug - Public product by slug
products.get('/public/:slug', publicSiteMiddleware, async (c) => {
  const slug = c.req.param('slug');
  const siteId = c.get('siteId');

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  const product = await prisma.product.findFirst({
    where: { slug, siteId, status: 'published' },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: 'asc' } },
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
      },
      attributes: true,
      modifiers: { orderBy: { position: 'asc' } },
    },
  });

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Parse JSON fields
  type VariantResult2 = typeof product.variants[number];
  type ModifierResult2 = typeof product.modifiers[number];

  const result = {
    ...product,
    prices: JSON.parse(product.prices),
    variants: product.variants.map((v: VariantResult2) => ({
      ...v,
      prices: JSON.parse(v.prices),
      options: JSON.parse(v.options),
    })),
    modifiers: product.modifiers.map((m: ModifierResult2) => ({
      ...m,
      options: JSON.parse(m.options),
    })),
  };

  return c.json(result);
});

// POST /api/admin/products - Create product
products.post('/', requireSite, requireSection('products'), zValidator('json', productSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  // Check slug uniqueness
  const existing = await prisma.product.findFirst({
    where: { siteId, slug: data.slug },
  });

  if (existing) {
    return c.json({ error: 'Product with this slug already exists' }, 400);
  }

  // Verify category if provided
  if (data.categoryId) {
    const category = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, siteId },
    });
    if (!category) {
      return c.json({ error: 'Category not found' }, 400);
    }
  }

  const { variants, attributes, modifiers, images, ...productData } = data;

  const product = await prisma.product.create({
    data: {
      ...productData,
      siteId,
      prices: JSON.stringify(productData.prices || {}),
      dimensions: productData.dimensions ? JSON.stringify(productData.dimensions) : null,
      images: {
        create: images.map((img: ProductImage, idx: number) => ({
          ...img,
          position: img.position ?? idx,
        })),
      },
      variants: {
        create: variants.map((v: ProductVariant, idx: number) => ({
          ...v,
          prices: JSON.stringify(v.prices || {}),
          options: JSON.stringify(v.options || {}),
          position: v.position ?? idx,
        })),
      },
      attributes: {
        create: attributes,
      },
      modifiers: {
        create: modifiers.map((m: ProductModifier, idx: number) => ({
          ...m,
          options: JSON.stringify(m.options || []),
          position: m.position ?? idx,
        })),
      },
    },
    include: {
      category: { select: { id: true, name: true } },
      images: true,
      variants: true,
      attributes: true,
      modifiers: true,
    },
  });

  return c.json(product, 201);
});

// PUT /api/admin/products/:id - Update product
products.put('/:id', requireSite, requireSection('products'), zValidator('json', updateProductSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  const existing = await prisma.product.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== existing.slug) {
    const duplicate = await prisma.product.findFirst({
      where: { siteId, slug: data.slug, id: { not: id } },
    });
    if (duplicate) {
      return c.json({ error: 'Product with this slug already exists' }, 400);
    }
  }

  const { variants, attributes, modifiers, images, ...productData } = data;

  // Update product base
  const updateData: Record<string, unknown> = { ...productData };
  if (productData.prices) updateData.prices = JSON.stringify(productData.prices);
  if (productData.dimensions) updateData.dimensions = JSON.stringify(productData.dimensions);

  await prisma.product.update({
    where: { id },
    data: updateData,
  });

  // Update images if provided
  if (images) {
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.productImage.createMany({
      data: images.map((img: ProductImage, idx: number) => ({
        ...img,
        productId: id,
        position: img.position ?? idx,
      })),
    });
  }

  // Update variants if provided
  if (variants) {
    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.productVariant.createMany({
      data: variants.map((v: ProductVariant, idx: number) => ({
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        comparePrice: v.comparePrice,
        prices: JSON.stringify(v.prices || {}),
        stock: v.stock || 0,
        imageUrl: v.imageUrl,
        options: JSON.stringify(v.options || {}),
        position: v.position ?? idx,
        isActive: v.isActive ?? true,
        productId: id,
      })),
    });
  }

  // Update attributes if provided
  if (attributes) {
    await prisma.productAttribute.deleteMany({ where: { productId: id } });
    await prisma.productAttribute.createMany({
      data: attributes.map((a: ProductAttribute) => ({ ...a, productId: id })),
    });
  }

  // Update modifiers if provided
  if (modifiers) {
    await prisma.productModifier.deleteMany({ where: { productId: id } });
    await prisma.productModifier.createMany({
      data: modifiers.map((m: ProductModifier, idx: number) => ({
        name: m.name,
        type: m.type || 'single',
        required: m.required || false,
        options: JSON.stringify(m.options || []),
        position: m.position ?? idx,
        productId: id,
      })),
    });
  }

  // Fetch updated product
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      images: { orderBy: { position: 'asc' } },
      variants: { orderBy: { position: 'asc' } },
      attributes: true,
      modifiers: { orderBy: { position: 'asc' } },
    },
  });

  return c.json(product);
});

// DELETE /api/admin/products/:id - Delete product
products.delete('/:id', requireSite, requireSection('products'), async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');

  const existing = await prisma.product.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Product not found' }, 404);
  }

  await prisma.product.delete({
    where: { id },
  });

  return c.json({ success: true });
});

// POST /api/admin/products/:id/duplicate - Duplicate product
products.post('/:id/duplicate', requireSite, requireSection('products'), async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = c.get('siteId');

  const original = await prisma.product.findFirst({
    where: { id, siteId },
    include: {
      images: true,
      variants: true,
      attributes: true,
      modifiers: true,
    },
  });

  if (!original) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Generate unique slug
  let newSlug = `${original.slug}-copy`;
  let counter = 1;
  while (await prisma.product.findFirst({ where: { siteId, slug: newSlug } })) {
    newSlug = `${original.slug}-copy-${counter++}`;
  }

  // Type aliases for the original data
  type OriginalImage = typeof original.images[number];
  type OriginalVariant = typeof original.variants[number];
  type OriginalAttribute = typeof original.attributes[number];
  type OriginalModifier = typeof original.modifiers[number];

  // Extract only the data fields we need
  const duplicate = await prisma.product.create({
    data: {
      name: `${original.name} (копия)`,
      slug: newSlug,
      description: original.description,
      shortDesc: original.shortDesc,
      price: original.price,
      comparePrice: original.comparePrice,
      costPrice: original.costPrice,
      prices: original.prices,
      sku: original.sku,
      barcode: original.barcode,
      stock: original.stock,
      trackStock: original.trackStock,
      lowStockThreshold: original.lowStockThreshold,
      status: 'draft',
      featured: original.featured,
      weight: original.weight,
      dimensions: original.dimensions,
      productType: original.productType,
      categoryId: original.categoryId,
      siteId: original.siteId,
      metaTitle: original.metaTitle,
      metaDescription: original.metaDescription,
      images: {
        create: original.images.map((img: OriginalImage) => ({
          url: img.url, alt: img.alt, position: img.position, isMain: img.isMain,
        })),
      },
      variants: {
        create: original.variants.map((v: OriginalVariant) => ({
          name: v.name, sku: v.sku, barcode: v.barcode, price: v.price,
          comparePrice: v.comparePrice, prices: v.prices, stock: v.stock,
          imageUrl: v.imageUrl, options: v.options, position: v.position, isActive: v.isActive,
        })),
      },
      attributes: {
        create: original.attributes.map((a: OriginalAttribute) => ({
          name: a.name, value: a.value, group: a.group,
        })),
      },
      modifiers: {
        create: original.modifiers.map((m: OriginalModifier) => ({
          name: m.name, type: m.type, required: m.required, options: m.options, position: m.position,
        })),
      },
    },
  });

  return c.json(duplicate, 201);
});

// POST /api/admin/products/bulk-status - Bulk status update
products.post('/bulk-status', requireSite, requireSection('products'), zValidator('json', z.object({
  ids: z.array(z.number().int()),
  status: z.enum(['draft', 'published', 'archived']),
})), async (c) => {
  const siteId = c.get('siteId');
  const { ids, status } = c.req.valid('json');

  const result = await prisma.product.updateMany({
    where: { id: { in: ids }, siteId },
    data: { status },
  });

  return c.json({ updated: result.count });
});

// POST /api/admin/products/bulk-delete - Bulk delete
products.post('/bulk-delete', requireSite, requireSection('products'), zValidator('json', z.object({
  ids: z.array(z.number().int()),
})), async (c) => {
  const siteId = c.get('siteId');
  const { ids } = c.req.valid('json');

  const result = await prisma.product.deleteMany({
    where: { id: { in: ids }, siteId },
  });

  return c.json({ deleted: result.count });
});

// =============================================
// Additional Public Endpoints
// =============================================

// GET /api/products/public/featured - Featured products
products.get('/public/featured', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 20);

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  const products = await prisma.product.findMany({
    where: {
      siteId,
      status: 'published',
      featured: true,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: 'asc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  type FeaturedProduct = typeof products[number];
  const result = products.map((p: FeaturedProduct) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDesc: p.shortDesc,
    prices: JSON.parse(p.prices),
    comparePrice: p.comparePrice,
    category: p.category,
    image: p.images[0]?.url || null,
  }));

  return c.json({ products: result });
});

// GET /api/products/public/search - Search products
products.get('/public/search', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const q = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  if (q.length < 2) {
    return c.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      siteId,
      status: 'published',
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { sku: { contains: q } },
      ],
    },
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
    },
    take: limit,
  });

  type SearchProduct = typeof products[number];
  const result = products.map((p: SearchProduct) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    prices: JSON.parse(p.prices),
    image: p.images[0]?.url || null,
  }));

  return c.json({ products: result });
});

// GET /api/products/public/category/:slug - Products by category slug
products.get('/public/category/:slug', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const categorySlug = c.req.param('slug');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

  if (!siteId) {
    return c.json({ error: 'Site ID required' }, 400);
  }

  // Find category
  const category = await prisma.productCategory.findFirst({
    where: { siteId, slug: categorySlug },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        select: { id: true, name: true, slug: true, image: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!category) {
    return c.json({ error: 'Category not found' }, 404);
  }

  // Get all child category IDs (for including products from subcategories)
  const categoryIds = [category.id];
  async function getChildIds(parentId: number) {
    const children = await prisma.productCategory.findMany({
      where: { parentId },
      select: { id: true },
    });
    for (const child of children) {
      categoryIds.push(child.id);
      await getChildIds(child.id);
    }
  }
  await getChildIds(category.id);

  // Count and fetch products
  const total = await prisma.product.count({
    where: {
      siteId,
      status: 'published',
      categoryId: { in: categoryIds },
    },
  });

  const products = await prisma.product.findMany({
    where: {
      siteId,
      status: 'published',
      categoryId: { in: categoryIds },
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: 'asc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  type CategoryProduct = typeof products[number];
  const result = products.map((p: CategoryProduct) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDesc: p.shortDesc,
    prices: JSON.parse(p.prices),
    comparePrice: p.comparePrice,
    category: p.category,
    image: p.images[0]?.url || null,
  }));

  return c.json({
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      metaTitle: category.metaTitle,
      metaDescription: category.metaDescription,
      parent: category.parent,
      children: category.children,
    },
    products: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export default products;
