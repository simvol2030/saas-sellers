import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, superadminOnly } from '../middleware/auth.js';

const currencies = new Hono();

// Schemas
const currencySchema = z.object({
  code: z.string().min(2).max(10).toUpperCase(),
  symbol: z.string().min(1).max(5),
  name: z.string().min(1).max(100),
  rate: z.number().positive().optional().default(1),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  position: z.number().int().optional().default(0),
});

const updateCurrencySchema = currencySchema.partial();

// GET /api/admin/currencies - List all currencies
currencies.get('/', authMiddleware, async (c) => {
  const currencies = await prisma.currency.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { position: 'asc' },
      { code: 'asc' },
    ],
  });
  return c.json(currencies);
});

// GET /api/currencies - Public list (active only)
currencies.get('/public', async (c) => {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: 'desc' },
      { position: 'asc' },
    ],
    select: {
      id: true,
      code: true,
      symbol: true,
      name: true,
      rate: true,
      isDefault: true,
    },
  });
  return c.json(currencies);
});

// POST /api/admin/currencies - Create currency (superadmin only)
currencies.post('/', authMiddleware, superadminOnly, zValidator('json', currencySchema), async (c) => {
  const data = c.req.valid('json');

  // Check if code already exists
  const existing = await prisma.currency.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    return c.json({ error: 'Currency with this code already exists' }, 400);
  }

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.currency.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const currency = await prisma.currency.create({
    data,
  });

  return c.json(currency, 201);
});

// PUT /api/admin/currencies/:id - Update currency
currencies.put('/:id', authMiddleware, superadminOnly, zValidator('json', updateCurrencySchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  const existing = await prisma.currency.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: 'Currency not found' }, 404);
  }

  // If updating code, check for duplicates
  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.currency.findUnique({
      where: { code: data.code },
    });
    if (duplicate) {
      return c.json({ error: 'Currency with this code already exists' }, 400);
    }
  }

  // If setting as default, unset other defaults
  if (data.isDefault && !existing.isDefault) {
    await prisma.currency.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const currency = await prisma.currency.update({
    where: { id },
    data,
  });

  return c.json(currency);
});

// DELETE /api/admin/currencies/:id - Delete currency
currencies.delete('/:id', authMiddleware, superadminOnly, async (c) => {
  const id = parseInt(c.req.param('id'));

  const existing = await prisma.currency.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: 'Currency not found' }, 404);
  }

  if (existing.isDefault) {
    return c.json({ error: 'Cannot delete default currency' }, 400);
  }

  await prisma.currency.delete({
    where: { id },
  });

  return c.json({ success: true });
});

// POST /api/admin/currencies/:id/rates - Update exchange rate
currencies.post('/:id/rates', authMiddleware, superadminOnly, zValidator('json', z.object({
  rate: z.number().positive(),
})), async (c) => {
  const id = parseInt(c.req.param('id'));
  const { rate } = c.req.valid('json');

  const currency = await prisma.currency.update({
    where: { id },
    data: { rate },
  });

  return c.json(currency);
});

// POST /api/admin/currencies/seed - Seed default currencies
currencies.post('/seed', authMiddleware, superadminOnly, async (c) => {
  const defaultCurrencies = [
    { code: 'RUB', symbol: '₽', name: 'Российский рубль', rate: 1, isDefault: true, position: 0 },
    { code: 'USD', symbol: '$', name: 'Доллар США', rate: 0.011, isDefault: false, position: 1 },
    { code: 'EUR', symbol: '€', name: 'Евро', rate: 0.0095, isDefault: false, position: 2 },
    { code: 'CNY', symbol: '¥', name: 'Китайский юань', rate: 0.078, isDefault: false, position: 3 },
    { code: 'KZT', symbol: '₸', name: 'Казахстанский тенге', rate: 5.5, isDefault: false, position: 4 },
    { code: 'PLN', symbol: 'zł', name: 'Польский злотый', rate: 0.044, isDefault: false, position: 5 },
  ];

  const created = [];
  const skipped = [];

  for (const curr of defaultCurrencies) {
    const existing = await prisma.currency.findUnique({
      where: { code: curr.code },
    });

    if (existing) {
      skipped.push(curr.code);
    } else {
      const currency = await prisma.currency.create({ data: curr });
      created.push(currency.code);
    }
  }

  return c.json({
    message: 'Currencies seeded',
    created,
    skipped,
  });
});

export default currencies;
