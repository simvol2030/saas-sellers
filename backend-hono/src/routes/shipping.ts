/**
 * Shipping Methods API
 *
 * Endpoints:
 * GET    /api/shipping/methods           - Public: Get active shipping methods
 * GET    /api/admin/shipping             - List all shipping methods
 * GET    /api/admin/shipping/:id         - Get shipping method
 * POST   /api/admin/shipping             - Create shipping method
 * PUT    /api/admin/shipping/:id         - Update shipping method
 * DELETE /api/admin/shipping/:id         - Delete shipping method
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';

const shipping = new Hono();

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// GET /api/shipping/methods - Public: Get active shipping methods
shipping.get('/methods', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const currencyCode = c.req.query('currency') || 'RUB';

  const methods = await prisma.shippingMethod.findMany({
    where: {
      siteId,
      isActive: true,
    },
    orderBy: { position: 'asc' },
  });

  // Calculate actual price based on cart total if needed
  const cartTotal = parseFloat(c.req.query('cartTotal') || '0');

  type ShippingMethod = typeof methods[number];
  const result = methods.map((m: ShippingMethod) => {
    let effectivePrice = Number(m.price);

    // Free shipping above threshold
    if (m.freeAbove && cartTotal >= Number(m.freeAbove)) {
      effectivePrice = 0;
    }

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      type: m.type,
      price: effectivePrice,
      originalPrice: Number(m.price),
      currencyCode: m.currencyCode,
      freeAbove: m.freeAbove ? Number(m.freeAbove) : null,
      minDays: m.minDays,
      maxDays: m.maxDays,
      isFree: effectivePrice === 0,
    };
  });

  return c.json({ methods: result });
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Apply middleware for admin routes
const adminRoutes = new Hono();
adminRoutes.use('*', authMiddleware, editorOrAdmin, siteMiddleware, requireSite);

// GET /api/admin/shipping - List all shipping methods
adminRoutes.get('/', async (c) => {
  const siteId = c.get('siteId');

  const methods = await prisma.shippingMethod.findMany({
    where: { siteId },
    orderBy: { position: 'asc' },
  });

  type AdminShippingMethod = typeof methods[number];
  const result = methods.map((m: AdminShippingMethod) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    type: m.type,
    price: Number(m.price),
    currencyCode: m.currencyCode,
    freeAbove: m.freeAbove ? Number(m.freeAbove) : null,
    pricePerKg: m.pricePerKg ? Number(m.pricePerKg) : null,
    minDays: m.minDays,
    maxDays: m.maxDays,
    isActive: m.isActive,
    position: m.position,
  }));

  return c.json({ methods: result });
});

// GET /api/admin/shipping/:id - Get shipping method
adminRoutes.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  const method = await prisma.shippingMethod.findFirst({
    where: { id, siteId },
  });

  if (!method) {
    return c.json({ error: 'Shipping method not found' }, 404);
  }

  return c.json({
    method: {
      id: method.id,
      name: method.name,
      description: method.description,
      type: method.type,
      price: Number(method.price),
      currencyCode: method.currencyCode,
      freeAbove: method.freeAbove ? Number(method.freeAbove) : null,
      pricePerKg: method.pricePerKg ? Number(method.pricePerKg) : null,
      minDays: method.minDays,
      maxDays: method.maxDays,
      isActive: method.isActive,
      position: method.position,
    },
  });
});

// Create schema
const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['fixed', 'weight', 'free_above']).default('fixed'),
  price: z.number().min(0).default(0),
  currencyCode: z.string().length(3).default('RUB'),
  freeAbove: z.number().min(0).optional().nullable(),
  pricePerKg: z.number().min(0).optional().nullable(),
  minDays: z.number().int().min(0).optional().nullable(),
  maxDays: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

// POST /api/admin/shipping - Create shipping method
adminRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  const method = await prisma.shippingMethod.create({
    data: {
      ...data,
      siteId,
    },
  });

  return c.json({
    method: {
      id: method.id,
      name: method.name,
      description: method.description,
      type: method.type,
      price: Number(method.price),
      currencyCode: method.currencyCode,
      freeAbove: method.freeAbove ? Number(method.freeAbove) : null,
      pricePerKg: method.pricePerKg ? Number(method.pricePerKg) : null,
      minDays: method.minDays,
      maxDays: method.maxDays,
      isActive: method.isActive,
      position: method.position,
    },
    message: 'Shipping method created',
  }, 201);
});

// PUT /api/admin/shipping/:id - Update shipping method
adminRoutes.put('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  // Check exists
  const existing = await prisma.shippingMethod.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Shipping method not found' }, 404);
  }

  const method = await prisma.shippingMethod.update({
    where: { id },
    data,
  });

  return c.json({
    method: {
      id: method.id,
      name: method.name,
      description: method.description,
      type: method.type,
      price: Number(method.price),
      currencyCode: method.currencyCode,
      freeAbove: method.freeAbove ? Number(method.freeAbove) : null,
      pricePerKg: method.pricePerKg ? Number(method.pricePerKg) : null,
      minDays: method.minDays,
      maxDays: method.maxDays,
      isActive: method.isActive,
      position: method.position,
    },
    message: 'Shipping method updated',
  });
});

// DELETE /api/admin/shipping/:id - Delete shipping method
adminRoutes.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  // Check exists
  const existing = await prisma.shippingMethod.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Shipping method not found' }, 404);
  }

  await prisma.shippingMethod.delete({
    where: { id },
  });

  return c.json({ message: 'Shipping method deleted' });
});

// Mount admin routes
shipping.route('/admin', adminRoutes);

export { shipping };
