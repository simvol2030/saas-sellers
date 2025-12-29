/**
 * Promo Codes API
 *
 * Public Endpoints (mounted at /api/promo):
 * POST   /validate              - Validate promo code
 *
 * Admin Endpoints (mounted at /api/admin/promo):
 * GET    /                      - List promo codes
 * POST   /                      - Create promo code
 * GET    /:id                   - Get promo code
 * PUT    /:id                   - Update promo code
 * DELETE /:id                   - Delete promo code
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';

// PUBLIC ROUTER - mounted at /api/promo
const promoPublic = new Hono();

// ADMIN ROUTER - mounted at /api/admin/promo
const promoAdmin = new Hono();

// Apply auth middleware to all admin routes
promoAdmin.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

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
promoPublic.post('/validate', publicSiteMiddleware, zValidator('json', validateSchema), async (c) => {
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

// GET /api/admin/promo - List promo codes
promoAdmin.get('/', async (c) => {
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
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Helper to parse datetime-local format (YYYY-MM-DDTHH:mm) or ISO format
function parseDateTime(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  // If already ISO format with timezone, parse directly
  if (value.includes('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  // datetime-local format (YYYY-MM-DDTHH:mm) - treat as local time
  return new Date(value);
}

// Create schema - accepts both backend field names and frontend field names
const createSchema = z.object({
  code: z.string().min(1).max(50).transform(s => s.toUpperCase()),
  description: z.string().optional().nullable(),
  // Accept both 'type' and 'discountType'
  type: z.enum(['fixed', 'percent', 'percentage']).optional(),
  discountType: z.enum(['fixed', 'percent', 'percentage']).optional(),
  // Accept both 'value' and 'discountValue'
  value: z.number().positive().optional(),
  discountValue: z.number().positive().optional(),
  currencyCode: z.string().length(3).optional().nullable(),
  minOrderAmount: z.number().positive().optional().nullable(),
  // Accept both field name variants
  maxUses: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  maxUsesPerUser: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(), // Frontend sends this
  // Accept any datetime string format
  startsAt: z.string().optional().nullable().transform(s => parseDateTime(s)),
  expiresAt: z.string().optional().nullable().transform(s => parseDateTime(s)),
  isActive: z.boolean().default(true),
}).transform(data => {
  // Normalize field names to backend format
  const type = data.type || data.discountType || 'percent';
  const normalizedType = type === 'percentage' ? 'percent' : type;

  return {
    code: data.code,
    description: data.description,
    type: normalizedType as 'fixed' | 'percent',
    value: data.value || data.discountValue || 0,
    currencyCode: data.currencyCode,
    minOrderAmount: data.minOrderAmount,
    maxUses: data.maxUses || data.usageLimit,
    maxUsesPerUser: data.maxUsesPerUser || data.perUserLimit,
    startsAt: data.startsAt,
    expiresAt: data.expiresAt,
    isActive: data.isActive,
  };
});

// POST /api/admin/promo - Create promo code
promoAdmin.post('/', zValidator('json', createSchema), async (c) => {
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
promoAdmin.get('/:id', async (c) => {
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

// Update schema - accepts partial data with same field name flexibility
const updateSchema = z.object({
  code: z.string().min(1).max(50).transform(s => s.toUpperCase()).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['fixed', 'percent', 'percentage']).optional(),
  discountType: z.enum(['fixed', 'percent', 'percentage']).optional(),
  value: z.number().positive().optional(),
  discountValue: z.number().positive().optional(),
  currencyCode: z.string().length(3).optional().nullable(),
  minOrderAmount: z.number().positive().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  maxUsesPerUser: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(),
  startsAt: z.string().optional().nullable().transform(s => parseDateTime(s)),
  expiresAt: z.string().optional().nullable().transform(s => parseDateTime(s)),
  isActive: z.boolean().optional(),
}).transform(data => {
  // Normalize field names, only including fields that were provided
  const result: Record<string, unknown> = {};

  if (data.code !== undefined) result.code = data.code;
  if (data.description !== undefined) result.description = data.description;
  if (data.isActive !== undefined) result.isActive = data.isActive;
  if (data.currencyCode !== undefined) result.currencyCode = data.currencyCode;
  if (data.minOrderAmount !== undefined) result.minOrderAmount = data.minOrderAmount;
  if (data.startsAt !== undefined) result.startsAt = data.startsAt;
  if (data.expiresAt !== undefined) result.expiresAt = data.expiresAt;

  // Handle type aliasing
  const type = data.type || data.discountType;
  if (type) {
    result.type = type === 'percentage' ? 'percent' : type;
  }

  // Handle value aliasing
  const value = data.value ?? data.discountValue;
  if (value !== undefined) result.value = value;

  // Handle maxUses aliasing
  const maxUses = data.maxUses ?? data.usageLimit;
  if (maxUses !== undefined) result.maxUses = maxUses;

  // Handle maxUsesPerUser aliasing
  const maxUsesPerUser = data.maxUsesPerUser ?? data.perUserLimit;
  if (maxUsesPerUser !== undefined) result.maxUsesPerUser = maxUsesPerUser;

  return result;
});

// PUT /api/admin/promo/:id - Update promo code
promoAdmin.put('/:id', zValidator('json', updateSchema), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json') as Record<string, unknown>;

  const existing = await prisma.promoCode.findFirst({
    where: { id, siteId },
  });

  if (!existing) {
    return c.json({ error: 'Promo code not found' }, 404);
  }

  // Check code uniqueness if changing
  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.promoCode.findFirst({
      where: { siteId, code: data.code as string, id: { not: id } },
    });
    if (duplicate) {
      return c.json({ error: 'Promo code already exists' }, 400);
    }
  }

  // Filter out undefined values for the update
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  const updated = await prisma.promoCode.update({
    where: { id },
    data: updateData,
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
promoAdmin.delete('/:id', async (c) => {
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

// Export both routers
export { promoPublic, promoAdmin };
