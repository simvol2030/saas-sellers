/**
 * Orders API - Order management and checkout
 *
 * Endpoints:
 * POST   /api/orders/checkout           - Create order from cart
 * GET    /api/orders/my                 - Get user's orders (public)
 * GET    /api/orders/:orderNumber       - Get order by number (public)
 * GET    /api/admin/orders              - List orders (admin)
 * GET    /api/admin/orders/:id          - Get order details (admin)
 * PUT    /api/admin/orders/:id/status   - Update order status (admin)
 * DELETE /api/admin/orders/:id          - Cancel/delete order (admin)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin, type AuthUser } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';
import { getCookie } from 'hono/cookie';

// Transaction client type
type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const orders = new Hono();

// Session cookie name
const SESSION_COOKIE = 'cart_session';

// Order statuses
const ORDER_STATUSES = [
  'pending',        // Ожидает оплаты
  'paid',           // Оплачен
  'processing',     // Обрабатывается
  'shipped',        // Отправлен
  'delivered',      // Доставлен
  'cancelled',      // Отменён
  'refunded',       // Возврат
];

// Generate order number
async function generateOrderNumber(siteId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}`;

  // Get last order number for this year
  const lastOrder = await prisma.order.findFirst({
    where: {
      siteId,
      orderNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
  });

  let sequence = 1;
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    const lastSequence = parseInt(parts[parts.length - 1] || '0');
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(5, '0')}`;
}

// ============================================
// PUBLIC CHECKOUT ENDPOINT
// ============================================

// Checkout schema
const checkoutSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  customerName: z.string().optional(),
  shippingAddress: z.object({
    country: z.string().optional(),
    city: z.string(),
    address: z.string(),
    postalCode: z.string().optional(),
    note: z.string().optional(),
  }),
  shippingMethodId: z.number().int().positive(),
  promoCode: z.string().optional(),
  paymentMethod: z.string().default('manual'),
});

// POST /api/orders/checkout - Create order from cart
orders.post('/checkout', publicSiteMiddleware, zValidator('json', checkoutSchema), async (c) => {
  const siteId = c.get('siteId');
  const sessionId = getCookie(c, SESSION_COOKIE);
  const data = c.req.valid('json');

  if (!sessionId) {
    return c.json({ error: 'Cart session not found' }, 400);
  }

  // Get cart
  const cart = await prisma.cart.findFirst({
    where: { sessionId, siteId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return c.json({ error: 'Cart is empty' }, 400);
  }

  // Get shipping method
  const shippingMethod = await prisma.shippingMethod.findFirst({
    where: {
      id: data.shippingMethodId,
      siteId,
      isActive: true,
    },
  });

  if (!shippingMethod) {
    return c.json({ error: 'Shipping method not found' }, 400);
  }

  // Calculate totals
  let subtotal = 0;
  let discount = 0;

  const orderItems: Array<{
    productId: number;
    variantId: number | null;
    name: string;
    sku: string | null;
    price: number;
    quantity: number;
    total: number;
    options: string;
    modifiers: string;
  }> = [];

  for (const item of cart.items) {
    // Use stored price from CartItem
    const price = Number(item.price);
    const itemTotal = price * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      productId: item.productId,
      variantId: item.variantId,
      name: item.variant ? `${item.product.name} - ${item.variant.name}` : item.product.name,
      sku: item.variant?.sku || item.product.sku,
      price,
      quantity: item.quantity,
      total: itemTotal,
      options: '{}',
      modifiers: '[]',
    });
  }

  // Calculate shipping cost
  let shippingCost = Number(shippingMethod.price);
  if (shippingMethod.freeAbove && subtotal >= Number(shippingMethod.freeAbove)) {
    shippingCost = 0;
  }

  // Apply promo code if provided
  let promoDiscount = 0;
  if (data.promoCode) {
    const promo = await prisma.promoCode.findFirst({
      where: {
        siteId,
        code: data.promoCode.toUpperCase(),
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (promo) {
      if (promo.minOrderAmount && subtotal < Number(promo.minOrderAmount)) {
        return c.json({
          error: `Minimum order amount for this promo code is ${promo.minOrderAmount}`,
        }, 400);
      }

      if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return c.json({ error: 'Promo code usage limit exceeded' }, 400);
      }

      // Calculate discount (type: 'fixed' or 'percent', value: discount amount)
      if (promo.type === 'percent') {
        promoDiscount = subtotal * Number(promo.value) / 100;
      } else {
        // fixed discount
        promoDiscount = Number(promo.value);
      }

      discount += promoDiscount;

      // Increment usage
      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });
    }
  }

  const total = subtotal - discount + shippingCost;

  // Generate order number
  const orderNumber = await generateOrderNumber(siteId);

  // Create order in transaction
  const order = await prisma.$transaction(async (tx: TransactionClient) => {
    // Create order
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        siteId,
        email: data.email,
        phone: data.phone,
        customerName: data.customerName,
        currencyCode: cart.currencyCode,
        currencyRate: 1,
        shippingAddress: JSON.stringify(data.shippingAddress),
        shippingMethod: shippingMethod.name,
        shippingCost,
        subtotal,
        discount,
        total,
        status: 'pending',
        paymentMethod: data.paymentMethod,
        items: {
          create: orderItems,
        },
        statusHistory: {
          create: {
            status: 'pending',
            note: 'Order created',
          },
        },
      },
      include: {
        items: true,
      },
    });

    // Update product stock
    for (const item of cart.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    // Clear cart
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return newOrder;
  });

  return c.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      status: order.status,
      currencyCode: order.currencyCode,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      shippingMethod: order.shippingMethod,
      shippingAddress: JSON.parse(order.shippingAddress),
      items: order.items.map((i: typeof order.items[number]) => ({
        name: i.name,
        sku: i.sku,
        price: Number(i.price),
        quantity: i.quantity,
        total: Number(i.total),
      })),
      createdAt: order.createdAt,
    },
    message: 'Order created successfully',
  }, 201);
});

// GET /api/orders/:orderNumber - Get order by number (public)
orders.get('/:orderNumber', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const orderNumber = c.req.param('orderNumber');

  const order = await prisma.order.findFirst({
    where: { orderNumber, siteId },
    include: {
      items: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  return c.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      customerName: order.customerName,
      status: order.status,
      currencyCode: order.currencyCode,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      shippingMethod: order.shippingMethod,
      shippingAddress: JSON.parse(order.shippingAddress),
      items: order.items.map((i: typeof order.items[number]) => ({
        name: i.name,
        sku: i.sku,
        price: Number(i.price),
        quantity: i.quantity,
        total: Number(i.total),
      })),
      statusHistory: order.statusHistory.map((h: typeof order.statusHistory[number]) => ({
        status: h.status,
        note: h.note,
        createdAt: h.createdAt,
      })),
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
    },
  });
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

const adminRoutes = new Hono();
adminRoutes.use('*', authMiddleware, editorOrAdmin, siteMiddleware, requireSite);

// GET /api/admin/orders - List orders
adminRoutes.get('/', async (c) => {
  const siteId = c.get('siteId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const status = c.req.query('status');
  const search = c.req.query('search');

  const where: any = { siteId };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { email: { contains: search } },
      { customerName: { contains: search } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  type OrderWithItems = typeof orders[number];
  const result = orders.map((o: OrderWithItems) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    email: o.email,
    customerName: o.customerName,
    status: o.status,
    currencyCode: o.currencyCode,
    total: Number(o.total),
    itemsCount: o.items.reduce((acc: number, i: typeof o.items[number]) => acc + i.quantity, 0),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt,
  }));

  return c.json({
    orders: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/admin/orders/:id - Get order details
adminRoutes.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  const order = await prisma.order.findFirst({
    where: { id, siteId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  return c.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      email: order.email,
      phone: order.phone,
      customerName: order.customerName,
      status: order.status,
      currencyCode: order.currencyCode,
      currencyRate: Number(order.currencyRate),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      shippingMethod: order.shippingMethod,
      shippingAddress: JSON.parse(order.shippingAddress),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentId: order.paymentId,
      items: order.items.map((i: typeof order.items[number]) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        product: i.product,
        variant: i.variant,
        name: i.name,
        sku: i.sku,
        price: Number(i.price),
        quantity: i.quantity,
        total: Number(i.total),
        options: JSON.parse(i.options),
        modifiers: JSON.parse(i.modifiers),
      })),
      statusHistory: order.statusHistory.map((h: typeof order.statusHistory[number]) => ({
        id: h.id,
        status: h.status,
        note: h.note,
        createdBy: h.createdBy,
        createdAt: h.createdAt,
      })),
      emailSent: order.emailSent,
      telegramSent: order.telegramSent,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

// Update status schema
const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  note: z.string().optional(),
});

// PUT /api/admin/orders/:id/status - Update order status
adminRoutes.put('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
  const siteId = c.get('siteId');
  const user = c.get('user') as AuthUser;
  const userId = user?.id;
  const id = parseInt(c.req.param('id'));
  const { status, note } = c.req.valid('json');

  const order = await prisma.order.findFirst({
    where: { id, siteId },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  // Update order status
  const updates: any = { status };

  if (status === 'paid' && !order.paidAt) {
    updates.paidAt = new Date();
    updates.paymentStatus = 'paid';
  } else if (status === 'shipped' && !order.shippedAt) {
    updates.shippedAt = new Date();
  } else if (status === 'delivered' && !order.deliveredAt) {
    updates.deliveredAt = new Date();
  } else if (status === 'cancelled' && !order.cancelledAt) {
    updates.cancelledAt = new Date();
  }

  const updatedOrder = await prisma.$transaction(async (tx: TransactionClient) => {
    // Update order
    const updated = await tx.order.update({
      where: { id },
      data: updates,
    });

    // Add status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status,
        note,
        createdBy: userId,
      },
    });

    // If cancelled, restore stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
      });

      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    return updated;
  });

  return c.json({
    order: {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      paidAt: updatedOrder.paidAt,
      shippedAt: updatedOrder.shippedAt,
      deliveredAt: updatedOrder.deliveredAt,
      cancelledAt: updatedOrder.cancelledAt,
    },
    message: 'Order status updated',
  });
});

// DELETE /api/admin/orders/:id - Delete order (soft delete via cancel)
adminRoutes.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  const order = await prisma.order.findFirst({
    where: { id, siteId },
  });

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  // Only allow deletion of pending orders
  if (!['pending', 'cancelled'].includes(order.status)) {
    return c.json({
      error: 'Can only delete pending or cancelled orders',
    }, 400);
  }

  // Restore stock if pending
  if (order.status === 'pending') {
    const items = await prisma.orderItem.findMany({
      where: { orderId: id },
    });

    for (const item of items) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  }

  // Delete order (cascade deletes items and history)
  await prisma.order.delete({
    where: { id },
  });

  return c.json({ message: 'Order deleted' });
});

// Mount admin routes
orders.route('/admin', adminRoutes);

export { orders };
