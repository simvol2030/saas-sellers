/**
 * Product Import/Export API
 *
 * Endpoints:
 * GET  /api/admin/products/export      - Export products to JSON/CSV
 * POST /api/admin/products/import      - Import products from JSON/CSV
 * GET  /api/admin/products/export/template - Get import template
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

// Transaction client type
type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const productImportExport = new Hono();
productImportExport.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

// Safe JSON parse helper
function safeJsonParse<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

// ==========================================
// EXPORT
// ==========================================

// GET /export - Export products
productImportExport.get('/export', async (c) => {
  const siteId = c.get('siteId');
  const format = c.req.query('format') || 'json'; // json, csv
  const categoryId = c.req.query('category');
  const status = c.req.query('status');

  // Build filter
  const where: any = { siteId };
  if (categoryId) where.categoryId = parseInt(categoryId);
  if (status) where.status = status;

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: 'asc' } },
      variants: true,
      attributes: true,
      modifiers: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  type ProductWithRelations = typeof products[number];
  type ImageType = typeof products[number]['images'][number];

  if (format === 'csv') {
    // CSV export
    const headers = [
      'id', 'name', 'slug', 'description', 'shortDesc',
      'price', 'comparePrice', 'costPrice', 'prices',
      'sku', 'barcode', 'stock', 'trackStock', 'lowStockThreshold',
      'status', 'featured', 'productType',
      'weight', 'dimensions',
      'categoryId', 'categoryName',
      'images', 'metaTitle', 'metaDescription',
    ];

    const rows = products.map((p: ProductWithRelations) => [
      p.id,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.slug,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${(p.shortDesc || '').replace(/"/g, '""')}"`,
      Number(p.price),
      p.comparePrice ? Number(p.comparePrice) : '',
      p.costPrice ? Number(p.costPrice) : '',
      `"${p.prices}"`,
      p.sku || '',
      p.barcode || '',
      p.stock,
      p.trackStock,
      p.lowStockThreshold,
      p.status,
      p.featured,
      p.productType,
      p.weight ? Number(p.weight) : '',
      `"${p.dimensions || ''}"`,
      p.categoryId || '',
      p.category?.name || '',
      `"${p.images.map((i: ImageType) => i.url).join(';')}"`,
      `"${(p.metaTitle || '').replace(/"/g, '""')}"`,
      `"${(p.metaDescription || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r: (string | number | boolean)[]) => r.join(','))].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // Type aliases for nested objects
  type VariantType = ProductWithRelations['variants'][number];
  type AttributeType = ProductWithRelations['attributes'][number];
  type ModifierType = ProductWithRelations['modifiers'][number];

  // JSON export
  const exportData = {
    exportedAt: new Date().toISOString(),
    siteId,
    count: products.length,
    products: products.map((p: ProductWithRelations) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      shortDesc: p.shortDesc,
      price: Number(p.price),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      prices: safeJsonParse(p.prices, {}),
      sku: p.sku,
      barcode: p.barcode,
      stock: p.stock,
      trackStock: p.trackStock,
      lowStockThreshold: p.lowStockThreshold,
      status: p.status,
      featured: p.featured,
      productType: p.productType,
      weight: p.weight ? Number(p.weight) : null,
      dimensions: safeJsonParse(p.dimensions, null),
      category: p.category ? {
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
      } : null,
      images: p.images.map((i: ImageType) => ({
        url: i.url,
        alt: i.alt,
        position: i.position,
        isMain: i.isMain,
      })),
      variants: p.variants.map((v: VariantType) => ({
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price ? Number(v.price) : null,
        comparePrice: v.comparePrice ? Number(v.comparePrice) : null,
        prices: safeJsonParse(v.prices, {}),
        stock: v.stock,
        imageUrl: v.imageUrl,
        options: safeJsonParse(v.options, {}),
        position: v.position,
        isActive: v.isActive,
      })),
      attributes: p.attributes.map((a: AttributeType) => ({
        name: a.name,
        value: a.value,
        group: a.group,
      })),
      modifiers: p.modifiers.map((m: ModifierType) => ({
        name: m.name,
        type: m.type,
        required: m.required,
        options: safeJsonParse(m.options, []),
        position: m.position,
      })),
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
    })),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
});

// GET /export/template - Get import template
productImportExport.get('/export/template', async (c) => {
  const format = c.req.query('format') || 'json';

  if (format === 'csv') {
    const headers = [
      'name', 'slug', 'description', 'shortDesc',
      'price', 'comparePrice', 'costPrice',
      'sku', 'barcode', 'stock', 'trackStock', 'lowStockThreshold',
      'status', 'featured', 'productType',
      'weight', 'categorySlug', 'images', 'metaTitle', 'metaDescription',
    ];

    const example = [
      '"Example Product"', 'example-product', '"Product description"', '"Short desc"',
      '1000', '1200', '500',
      'SKU001', '4600000000001', '100', 'true', '10',
      'active', 'false', 'general',
      '0.5', 'electronics', '"/uploads/image1.jpg;/uploads/image2.jpg"', '"SEO Title"', '"SEO Description"',
    ];

    const csv = [
      '# Product Import Template',
      '# Required fields: name, price',
      '# status: draft, active, archived',
      '# productType: general, clothing, food, cafe, pet, household',
      '',
      headers.join(','),
      example.join(','),
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="product-import-template.csv"',
      },
    });
  }

  // JSON template
  const template = {
    products: [
      {
        name: 'Example Product',
        slug: 'example-product',
        description: 'Full product description',
        shortDesc: 'Short description',
        price: 1000,
        comparePrice: 1200,
        costPrice: 500,
        prices: { RUB: 1000, USD: 10 },
        sku: 'SKU001',
        barcode: '4600000000001',
        stock: 100,
        trackStock: true,
        lowStockThreshold: 10,
        status: 'active',
        featured: false,
        productType: 'general',
        weight: 0.5,
        dimensions: { length: 10, width: 10, height: 5 },
        categorySlug: 'electronics',
        images: [
          { url: '/uploads/image1.jpg', alt: 'Main image', isMain: true },
          { url: '/uploads/image2.jpg', alt: 'Additional' },
        ],
        variants: [
          {
            name: 'Red / Large',
            sku: 'SKU001-RL',
            price: 1100,
            stock: 50,
            options: { color: 'red', size: 'L' },
          },
        ],
        attributes: [
          { name: 'Color', value: 'Red' },
          { name: 'Material', value: 'Cotton' },
        ],
        metaTitle: 'SEO Title',
        metaDescription: 'SEO Description',
      },
    ],
  };

  return c.json(template);
});

// ==========================================
// IMPORT
// ==========================================

// Import schema
const importProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  price: z.number().min(0),
  comparePrice: z.number().optional(),
  costPrice: z.number().optional(),
  prices: z.record(z.string(), z.number()).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.number().int().default(0),
  trackStock: z.boolean().default(true),
  lowStockThreshold: z.number().int().default(5),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  productType: z.string().default('general'),
  weight: z.number().optional(),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  categorySlug: z.string().optional(),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    isMain: z.boolean().optional(),
  })).optional(),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: z.number().optional(),
    comparePrice: z.number().optional(),
    prices: z.record(z.string(), z.number()).optional(),
    stock: z.number().int().default(0),
    imageUrl: z.string().optional(),
    options: z.record(z.string(), z.string()).optional(),
    position: z.number().int().optional(),
    isActive: z.boolean().default(true),
  })).optional(),
  attributes: z.array(z.object({
    name: z.string(),
    value: z.string(),
    group: z.string().optional(),
  })).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

const importSchema = z.object({
  products: z.array(importProductSchema),
  mode: z.enum(['create', 'upsert']).default('upsert'), // create = skip existing, upsert = update existing
});

// POST /import - Import products
productImportExport.post('/import', zValidator('json', importSchema), async (c) => {
  const siteId = c.get('siteId');
  const { products, mode } = c.req.valid('json');

  const results = {
    total: products.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as Array<{ index: number; name: string; error: string }>,
  };

  // Get categories for lookup
  const categories = await prisma.productCategory.findMany({
    where: { siteId },
    select: { id: true, slug: true },
  });
  type CategoryType = typeof categories[number];
  const categoryMap = new Map(categories.map((c: CategoryType) => [c.slug, c.id]));

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      // Generate slug if not provided
      const slug = product.slug || product.name
        .toLowerCase()
        .replace(/[^a-zа-яё0-9]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if exists
      const existing = await prisma.product.findFirst({
        where: { siteId, slug },
      });

      if (existing && mode === 'create') {
        results.skipped++;
        continue;
      }

      // Resolve category
      let categoryId = null;
      if (product.categorySlug) {
        categoryId = categoryMap.get(product.categorySlug) || null;
      }

      // Prepare data
      const productData = {
        siteId,
        name: product.name,
        slug,
        description: product.description,
        shortDesc: product.shortDesc,
        price: product.price,
        comparePrice: product.comparePrice,
        costPrice: product.costPrice,
        prices: JSON.stringify(product.prices || {}),
        sku: product.sku,
        barcode: product.barcode,
        stock: product.stock,
        trackStock: product.trackStock,
        lowStockThreshold: product.lowStockThreshold,
        status: product.status,
        featured: product.featured,
        productType: product.productType,
        weight: product.weight,
        dimensions: product.dimensions ? JSON.stringify(product.dimensions) : null,
        categoryId,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
      };

      if (existing) {
        // Update
        await prisma.$transaction(async (tx: TransactionClient) => {
          await tx.product.update({
            where: { id: existing.id },
            data: productData,
          });

          // Update images
          if (product.images) {
            await tx.productImage.deleteMany({ where: { productId: existing.id } });
            await tx.productImage.createMany({
              data: product.images.map((img, idx) => ({
                productId: existing.id,
                url: img.url,
                alt: img.alt,
                position: idx,
                isMain: img.isMain || idx === 0,
              })),
            });
          }

          // Update variants
          if (product.variants) {
            await tx.productVariant.deleteMany({ where: { productId: existing.id } });
            await tx.productVariant.createMany({
              data: product.variants.map((v, idx) => ({
                productId: existing.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                price: v.price,
                comparePrice: v.comparePrice,
                prices: JSON.stringify(v.prices || {}),
                stock: v.stock,
                imageUrl: v.imageUrl,
                options: JSON.stringify(v.options || {}),
                position: v.position ?? idx,
                isActive: v.isActive,
              })),
            });
          }

          // Update attributes
          if (product.attributes) {
            await tx.productAttribute.deleteMany({ where: { productId: existing.id } });
            await tx.productAttribute.createMany({
              data: product.attributes.map(a => ({
                productId: existing.id,
                name: a.name,
                value: a.value,
                group: a.group,
              })),
            });
          }
        });

        results.updated++;
      } else {
        // Create
        const created = await prisma.product.create({
          data: productData,
        });

        // Add images
        if (product.images?.length) {
          await prisma.productImage.createMany({
            data: product.images.map((img, idx) => ({
              productId: created.id,
              url: img.url,
              alt: img.alt,
              position: idx,
              isMain: img.isMain || idx === 0,
            })),
          });
        }

        // Add variants
        if (product.variants?.length) {
          await prisma.productVariant.createMany({
            data: product.variants.map((v, idx) => ({
              productId: created.id,
              name: v.name,
              sku: v.sku,
              barcode: v.barcode,
              price: v.price,
              comparePrice: v.comparePrice,
              prices: JSON.stringify(v.prices || {}),
              stock: v.stock,
              imageUrl: v.imageUrl,
              options: JSON.stringify(v.options || {}),
              position: v.position ?? idx,
              isActive: v.isActive,
            })),
          });
        }

        // Add attributes
        if (product.attributes?.length) {
          await prisma.productAttribute.createMany({
            data: product.attributes.map(a => ({
              productId: created.id,
              name: a.name,
              value: a.value,
              group: a.group,
            })),
          });
        }

        results.created++;
      }
    } catch (error) {
      results.errors.push({
        index: i,
        name: product.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    success: results.errors.length === 0,
    results,
    message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`,
  });
});

export { productImportExport };
