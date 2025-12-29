/**
 * Payments API
 *
 * Public Endpoints (mounted at /api/payments):
 * GET    /methods               - Get available payment methods
 * POST   /create                - Create payment for order
 * GET    /:id/status            - Get payment status
 * POST   /refund                - Request refund (requires auth)
 *
 * Admin Endpoints (mounted at /api/admin/payments):
 * GET    /providers             - List payment providers
 * POST   /providers             - Add/update provider
 * PUT    /providers/:type       - Update provider config
 * DELETE /providers/:type       - Disable provider
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';
import {
  createPaymentProvider,
  getPaymentMethodInfo,
  type PaymentProviderType,
  type PaymentConfig,
} from '../lib/payments/index.js';

// PUBLIC ROUTER - mounted at /api/payments
const paymentsPublic = new Hono();

// ADMIN ROUTER - mounted at /api/admin/payments
const paymentsAdmin = new Hono();

// Apply auth middleware to all admin routes
paymentsAdmin.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

// ==========================================
// PUBLIC ROUTES
// ==========================================

// GET /api/payments/methods - Get available payment methods for site
paymentsPublic.get('/methods', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');

  const providers = await prisma.paymentProvider.findMany({
    where: {
      siteId,
      isActive: true,
    },
    orderBy: { position: 'asc' },
    select: {
      type: true,
      name: true,
      isTest: true,
    },
  });

  // Always include cash option
  type ProviderInfo = typeof providers[number];
  const methods = [
    ...providers.map((p: ProviderInfo) => ({
      type: p.type,
      ...getPaymentMethodInfo(p.type),
      isTest: p.isTest,
    })),
    {
      type: 'cash',
      ...getPaymentMethodInfo('cash'),
      isTest: false,
    },
  ];

  return c.json({ methods });
});

// Create payment schema
const createPaymentSchema = z.object({
  orderId: z.number().int().positive(),
  paymentMethod: z.string(),
  returnUrl: z.string().url(),
});

// POST /api/payments/create - Create payment for order
paymentsPublic.post('/create', publicSiteMiddleware, zValidator('json', createPaymentSchema), async (c) => {
  const siteId = c.get('siteId');
  const { orderId, paymentMethod, returnUrl } = c.req.valid('json');

  // Get order
  const order = await prisma.order.findFirst({
    where: { id: orderId, siteId },
    include: {
      items: true,
    },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  if (order.paymentStatus === 'paid') {
    return c.json({ error: 'Order already paid' }, 400);
  }

  // Cash payment - just update order
  if (paymentMethod === 'cash') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: 'cash',
        paymentStatus: 'pending',
      },
    });

    return c.json({
      success: true,
      paymentMethod: 'cash',
      message: 'Order confirmed. Pay on delivery.',
    });
  }

  // Get payment provider config
  const providerConfig = await prisma.paymentProvider.findFirst({
    where: {
      siteId,
      type: paymentMethod,
      isActive: true,
    },
  });

  if (!providerConfig) {
    return c.json({ error: 'Payment method not available' }, 400);
  }

  // Parse config
  let config: PaymentConfig;
  try {
    config = JSON.parse(providerConfig.config);
    config.isTest = providerConfig.isTest;
  } catch {
    return c.json({ error: 'Invalid payment provider configuration' }, 500);
  }

  // Create provider
  const provider = createPaymentProvider(paymentMethod as PaymentProviderType, config);

  if (!provider) {
    return c.json({ error: 'Payment provider not supported' }, 400);
  }

  // Create payment
  const result = await provider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: order.currencyCode,
    description: `Order ${order.orderNumber}`,
    returnUrl,
    customerEmail: order.email,
    customerPhone: order.phone || undefined,
    metadata: {
      site_id: siteId.toString(),
    },
  });

  if (!result.success) {
    return c.json({ error: result.error || 'Payment creation failed' }, 400);
  }

  // Update order with payment info
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentMethod,
      paymentId: result.paymentId,
      paymentStatus: 'pending',
    },
  });

  return c.json({
    success: true,
    paymentId: result.paymentId,
    confirmationUrl: result.confirmationUrl,
    status: result.status,
  });
});

// GET /api/payments/:id/status - Get payment status
paymentsPublic.get('/:id/status', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const paymentId = c.req.param('id');

  // Find order by payment ID
  const order = await prisma.order.findFirst({
    where: {
      siteId,
      paymentId,
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      paymentMethod: true,
      status: true,
    },
  });

  if (!order) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  // If we have a provider, check live status
  if (order.paymentMethod && order.paymentMethod !== 'cash') {
    const providerConfig = await prisma.paymentProvider.findFirst({
      where: {
        siteId,
        type: order.paymentMethod,
      },
    });

    if (providerConfig) {
      try {
        const config = JSON.parse(providerConfig.config);
        config.isTest = providerConfig.isTest;

        const provider = createPaymentProvider(order.paymentMethod as PaymentProviderType, config);
        if (provider) {
          const liveStatus = await provider.getPaymentStatus(paymentId);
          if (liveStatus) {
            return c.json({
              paymentId,
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentStatus: liveStatus,
              orderStatus: order.status,
            });
          }
        }
      } catch (e) {
        // Fall through to stored status
      }
    }
  }

  return c.json({
    paymentId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
  });
});

// Refund schema
const refundSchema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

// POST /api/payments/refund - Request refund (requires auth)
paymentsPublic.post('/refund', authMiddleware, siteMiddleware, requireSite, zValidator('json', refundSchema), async (c) => {
  const siteId = c.get('siteId');
  const { orderId, amount, reason } = c.req.valid('json');

  const order = await prisma.order.findFirst({
    where: { id: orderId, siteId },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  if (order.paymentStatus !== 'paid') {
    return c.json({ error: 'Order has not been paid' }, 400);
  }

  if (!order.paymentId || !order.paymentMethod) {
    return c.json({ error: 'No payment information' }, 400);
  }

  if (order.paymentMethod === 'cash') {
    // For cash, just update status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'refunded',
        status: 'refunded',
      },
    });

    return c.json({
      success: true,
      message: 'Order marked as refunded',
    });
  }

  // Get provider
  const providerConfig = await prisma.paymentProvider.findFirst({
    where: {
      siteId,
      type: order.paymentMethod,
    },
  });

  if (!providerConfig) {
    return c.json({ error: 'Payment provider not found' }, 400);
  }

  const config = JSON.parse(providerConfig.config);
  config.isTest = providerConfig.isTest;

  const provider = createPaymentProvider(order.paymentMethod as PaymentProviderType, config);

  if (!provider) {
    return c.json({ error: 'Payment provider not supported' }, 400);
  }

  const result = await provider.refund({
    paymentId: order.paymentId,
    amount,
    reason,
  });

  if (!result.success) {
    return c.json({ error: result.error || 'Refund failed' }, 400);
  }

  // Update order
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'refunded',
      status: 'refunded',
    },
  });

  return c.json({
    success: true,
    refundId: result.refundId,
    status: result.status,
  });
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// GET /api/admin/payments/providers - List payment providers
paymentsAdmin.get('/providers', async (c) => {
  const siteId = c.get('siteId');

  const providers = await prisma.paymentProvider.findMany({
    where: { siteId },
    orderBy: { position: 'asc' },
  });

  // Parse config but hide secrets
  type ProviderWithConfig = typeof providers[number];
  const result = providers.map((p: ProviderWithConfig) => {
    let configSafe: Record<string, unknown> = {};
    try {
      const config = JSON.parse(p.config);
      configSafe = {
        shopId: config.shopId ? '***' + config.shopId.slice(-4) : null,
        hasSecretKey: !!config.secretKey,
        hasBotToken: !!config.botToken,
      };
    } catch {
      // ignore
    }

    const methodInfo = getPaymentMethodInfo(p.type);
    return {
      id: p.id,
      type: p.type,
      name: p.name,
      isActive: p.isActive,
      isTest: p.isTest,
      position: p.position,
      config: configSafe,
      icon: methodInfo.icon,
      description: methodInfo.description,
    };
  });

  // Add available but not configured providers
  const configuredTypes = providers.map((p: ProviderWithConfig) => p.type);
  const availableProviders: PaymentProviderType[] = ['yookassa', 'telegram_stars'];

  const notConfigured = availableProviders
    .filter(type => !configuredTypes.includes(type))
    .map(type => {
      const methodInfo = getPaymentMethodInfo(type);
      return {
        type,
        name: methodInfo.name,
        isActive: false,
        isTest: true,
        configured: false,
        icon: methodInfo.icon,
        description: methodInfo.description,
      };
    });

  return c.json({
    providers: result,
    available: notConfigured,
  });
});

// Provider config schema
const providerSchema = z.object({
  type: z.enum(['yookassa', 'telegram_stars']),
  name: z.string().optional(),
  shopId: z.string().optional(),
  secretKey: z.string().optional(),
  botToken: z.string().optional(),
  isActive: z.boolean().optional(),
  isTest: z.boolean().optional(),
  position: z.number().int().optional(),
});

// POST /api/admin/payments/providers - Add/update provider
paymentsAdmin.post('/providers', zValidator('json', providerSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  // Build config
  const config: PaymentConfig = {};
  if (data.shopId) config.shopId = data.shopId;
  if (data.secretKey) config.secretKey = data.secretKey;
  if (data.botToken) config.botToken = data.botToken;

  // Check if exists
  const existing = await prisma.paymentProvider.findFirst({
    where: { siteId, type: data.type },
  });

  if (existing) {
    // Merge config
    let existingConfig: PaymentConfig = {};
    try {
      existingConfig = JSON.parse(existing.config);
    } catch {
      // ignore
    }

    const mergedConfig = { ...existingConfig, ...config };

    const updated = await prisma.paymentProvider.update({
      where: { id: existing.id },
      data: {
        name: data.name || existing.name,
        config: JSON.stringify(mergedConfig),
        isActive: data.isActive ?? existing.isActive,
        isTest: data.isTest ?? existing.isTest,
        position: data.position ?? existing.position,
      },
    });

    return c.json({
      provider: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        isActive: updated.isActive,
        isTest: updated.isTest,
      },
      message: 'Provider updated',
    });
  }

  // Create new
  const provider = await prisma.paymentProvider.create({
    data: {
      siteId,
      type: data.type,
      name: data.name || getPaymentMethodInfo(data.type).name,
      config: JSON.stringify(config),
      isActive: data.isActive ?? false,
      isTest: data.isTest ?? true,
      position: data.position ?? 0,
    },
  });

  return c.json({
    provider: {
      id: provider.id,
      type: provider.type,
      name: provider.name,
      isActive: provider.isActive,
      isTest: provider.isTest,
    },
    message: 'Provider added',
  }, 201);
});

// PUT /api/admin/payments/providers/:type - Update provider
paymentsAdmin.put('/providers/:type', zValidator('json', providerSchema.partial()), async (c) => {
  const siteId = c.get('siteId');
  const type = c.req.param('type');
  const data = c.req.valid('json');

  const existing = await prisma.paymentProvider.findFirst({
    where: { siteId, type },
  });

  if (!existing) {
    return c.json({ error: 'Provider not found' }, 404);
  }

  // Merge config
  let existingConfig: PaymentConfig = {};
  try {
    existingConfig = JSON.parse(existing.config);
  } catch {
    // ignore
  }

  if (data.shopId) existingConfig.shopId = data.shopId;
  if (data.secretKey) existingConfig.secretKey = data.secretKey;
  if (data.botToken) existingConfig.botToken = data.botToken;

  const updated = await prisma.paymentProvider.update({
    where: { id: existing.id },
    data: {
      name: data.name ?? existing.name,
      config: JSON.stringify(existingConfig),
      isActive: data.isActive ?? existing.isActive,
      isTest: data.isTest ?? existing.isTest,
      position: data.position ?? existing.position,
    },
  });

  return c.json({
    provider: {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      isActive: updated.isActive,
      isTest: updated.isTest,
    },
    message: 'Provider updated',
  });
});

// DELETE /api/admin/payments/providers/:type - Disable provider
paymentsAdmin.delete('/providers/:type', async (c) => {
  const siteId = c.get('siteId');
  const type = c.req.param('type');

  const existing = await prisma.paymentProvider.findFirst({
    where: { siteId, type },
  });

  if (!existing) {
    return c.json({ error: 'Provider not found' }, 404);
  }

  // Soft delete - just disable
  await prisma.paymentProvider.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  return c.json({ message: 'Provider disabled' });
});

// Export both routers
export { paymentsPublic, paymentsAdmin };
