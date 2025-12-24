/**
 * Promo Codes API
 *
 * Public:
 * POST   /api/promo/validate         - Validate promo code
 *
 * Admin:
 * GET    /api/admin/promo            - List promo codes
 * POST   /api/admin/promo            - Create promo code
 * GET    /api/admin/promo/:id        - Get promo code
 * PUT    /api/admin/promo/:id        - Update promo code
 * DELETE /api/admin/promo/:id        - Delete promo code
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';

const promoCodes = new Hono();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Validate schema
const validateSchema = z.object({
  code: z.string().min(1).max(50),
  orderAmount: z.number().positive(),
  currencyCode: z.string().length(3).default('RUB'),
});

// POST /api/promo/validate - Validate promo code
promoCodes.post('/validate', publicSiteMiddleware, zValidator('json', validateSchema), async (c) => {
  const siteId = c.get('siteId');
  const { code, orderAmount, currencyCode } = c.req.valid('json');

  const promo = await prisma.promoCode.findFirst({
    where: {
      siteId,
      code: code.toUpperCase(),
      isActive: true,
    },
  });

  if (!promo) {
    return c.json({
      valid: false,
      error: 'Промокод не найден',
    }, 400);
  }

  const now = new Date();

  // Check dates
  if (promo.startsAt && promo.startsAt > now) {
    return c.json({
      valid: false,
      error: 'Промокод еще не активен',
    }, 400);
  }

  if (promo.expiresAt && promo.expiresAt < now) {
    return c.json({
      valid: false,
      error: 'Промокод истек',
    }, 400);
  }

  // Check usage limit
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    return c.json({
      valid: false,
      error: 'Промокод исчерпан',
    }, 400);
  }

  // Check minimum order
  if (promo.minOrderAmount && orderAmount < Number(promo.minOrderAmount)) {
    return c.json({
      valid: false,
      error: `Минимальная сумма заказа: ${promo.minOrderAmount} ${promo.currencyCode || currencyCode}`,
    }, 400);
  }

  // Calculate discount
  let discount = 0;

  if (promo.type === 'percent') {
    discount = orderAmount * (Number(promo.value) / 100);
  } else if (promo.type === 'fixed') {
    // If promo currency differs, would need conversion
    // For now, assume same currency or use value directly
    discount = Number(promo.value);
  }

  // Cap discount at order amount
  if (discount > orderAmount) {
    discount = orderAmount;
  }

  return c.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    value: Number(promo.value),
    discount: Math.round(discount * 100) / 100,
    description: promo.description,
    newTotal: Math.round((orderAmount - discount) * 100) / 100,
  });
});

// ==========================================
// ADMIN ROUTES
// ==========================================

const adminRoutes = new Hono();
adminRoutes.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

// GET /api/admin/promo - List promo codes
adminRoutes.get('/', async (c) => {
  const siteId = c.get('siteId');
  const search = c.req.query('search') || '';
  const status = c.req.query('status'); // active, expired, disabled
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  const now = new Date();

  // Build where clause
  const where: any = { siteId };

  if (search) {
    where.OR = [
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (status === 'active') {
    where.isActive = true;
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ];
  } else if (status === 'expired') {
    where.expiresAt = { lt: now };
  } else if (status === 'disabled') {
    where.isActive = false;
  }

  const [codes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promoCode.count({ where }),
  ]);

  type PromoCodeType = typeof codes[number];
  return c.json({
    promoCodes: codes.map((p: PromoCodeType) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      type: p.type,
      value: Number(p.value),
      currencyCode: p.currencyCode,
      minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
      maxUses: p.maxUses,
      usedCount: p.usedCount,
      startsAt: p.startsAt,
      expiresAt: p.expiresAt,
      isActive: p.isActive,
      isExpired: p.expiresAt ? p.expiresAt < now : false,
      createdAt: p.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// Create schema
const createSchema = z.object({
  code: z.string().min(1).max(50).transform(s => s.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(['fixed', 'percent']),
  value: z.number().positive(),
  currencyCode: z.string().length(3).optional(),
  minOrderAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional().transform(s => s ? new Date(s) : undefined),
  expiresAt: z.string().datetime().optional().transform(s => s ? new Date(s) : undefined),
  isActive: z.boolean().default(true),
});

// POST /api/admin/promo - Create promo code
adminRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  // Check uniqueness
  const existing = await prisma.promoCode.findFirst({
    where: { siteId, code: data.code },
  });

  if (existing) {
    return c.json({ error: 'Promo code already exists' }, 400);
  }

  const promo = await prisma.promoCode.create({
    data: {
      siteId,
      code: data.code,
      description: data.description,
      type: data.type,
      value: data.value,
      currencyCode: data.currencyCode,
      minOrderAmount: data.minOrderAmount,
      maxUses: data.maxUses,
      maxUsesPerUser: data.maxUsesPerUser,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      isActive: data.isActive,
    },
  });

  return c.json({
    promoCode: {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: Number(promo.value),
      isActive: promo.isActive,
    },
    message: 'Promo code created',
  }, 201);
});

// GET /api/admin/promo/:id - Get promo code
adminRoutes.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  const promo = await prisma.promoCode.findFirst({
    where: { id, siteId },
  });

  if (!promo) {
    return c.json({ error: 'Promo code not found' }, 404);
  }

  return c.json({
    promoCode: {
      id: promo.id,
      code: promo.code,
      description: promo.description,
      type: promo.type,
      value: Number(promo.value),
      currencyCode: promo.currencyCode,
      minOrderAmount: promo.minOrderAmount ? Number(promo.minOrderAmount) : null,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      maxUsesPerUser: promo.maxUsesPerUser,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
      isActive: promo.isActive,
      createdAt: promo.createdAt,
      updatedAt: promo.updatedAt,
    },
  });
});

// Update schema
const updateSchema = createSchema.partial();

// PUT /api/admin/promo/:id - Update promo code
adminRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  const existing = await prisma.promoCode.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Promo code not found' }, 404);
  }

  // Check code uniqueness if changing
  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.promoCode.findFirst({
      where: { siteId, code: data.code, id: { not: id } },
    });
    if (duplicate) {
      return c.json({ error: 'Promo code already exists' }, 400);
    }
  }

  const updated = await prisma.promoCode.update({
    where: { id },
    data: {
      code: data.code,
      description: data.description,
      type: data.type,
      value: data.value,
      currencyCode: data.currencyCode,
      minOrderAmount: data.minOrderAmount,
      maxUses: data.maxUses,
      maxUsesPerUser: data.maxUsesPerUser,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      isActive: data.isActive,
    },
  });

  return c.json({
    promoCode: {
      id: updated.id,
      code: updated.code,
      type: updated.type,
      value: Number(updated.value),
      isActive: updated.isActive,
    },
    message: 'Promo code updated',
  });
});

// DELETE /api/admin/promo/:id - Delete promo code
adminRoutes.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  const existing = await prisma.promoCode.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Promo code not found' }, 404);
  }

  await prisma.promoCode.delete({
    where: { id },
  });

  return c.json({ message: 'Promo code deleted' });
});

// Mount admin routes
promoCodes.route('/admin', adminRoutes);

export { promoCodes };
