/**
 * Cart API - Shopping cart management
 *
 * Endpoints:
 * GET    /api/cart              - Get current cart
 * POST   /api/cart/items        - Add item to cart
 * PUT    /api/cart/items/:id    - Update cart item quantity
 * DELETE /api/cart/items/:id    - Remove item from cart
 * DELETE /api/cart              - Clear cart
 * PUT    /api/cart/currency     - Change cart currency
 * POST   /api/cart/validate     - Validate cart before checkout
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { publicSiteMiddleware } from '../middleware/site.js';
import { getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'crypto';

const cart = new Hono();

// Session cookie name
const SESSION_COOKIE = 'cart_session';

// Get or create session ID
async function getOrCreateSession(c: any): Promise<string> {
  let sessionId = getCookie(c, SESSION_COOKIE);

  if (!sessionId) {
    sessionId = randomUUID();
    setCookie(c, SESSION_COOKIE, sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return sessionId;
}

// Get or create cart for session
async function getOrCreateCart(sessionId: string, siteId: number, currencyCode?: string) {
  let cartRecord = await prisma.cart.findUnique({
    where: { sessionId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  if (!cartRecord) {
    // Cart expires in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    cartRecord = await prisma.cart.create({
      data: {
        sessionId,
        siteId,
        currencyCode: currencyCode || 'RUB',
        expiresAt,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
      },
    });
  }

  return cartRecord;
}

// Calculate cart totals
function calculateTotals(
  items: Array<{
    quantity: number;
    price: any; // Prisma Decimal
    product: { prices: string; comparePrice: any | null };
    variant: { prices: string } | null;
  }>,
  currencyCode: string
) {
  let subtotal = 0;
  let totalDiscount = 0;
  let itemCount = 0;

  for (const item of items) {
    // Use the stored price from CartItem
    const price = Number(item.price);
    const comparePrice = item.product.comparePrice ? Number(item.product.comparePrice) : null;

    subtotal += price * item.quantity;
    itemCount += item.quantity;

    if (comparePrice && comparePrice > price) {
      totalDiscount += (comparePrice - price) * item.quantity;
    }
  }

  return { subtotal, totalDiscount, itemCount, total: subtotal };
}

// Format cart response
function formatCartResponse(
  cartRecord: any,
  currencyCode: string
) {
  const items = cartRecord.items.map((item: any) => {
    // Use the stored price from CartItem
    const price = Number(item.price);
    const productPrices = JSON.parse(item.product.prices);

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price,
      total: price * item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        prices: productPrices,
        comparePrice: item.product.comparePrice ? Number(item.product.comparePrice) : null,
        image: item.product.images[0]?.url || null,
        stock: item.product.stock,
        trackStock: item.product.trackStock,
      },
      variant: item.variant
        ? {
            id: item.variant.id,
            name: item.variant.name,
            sku: item.variant.sku,
            prices: JSON.parse(item.variant.prices),
            stock: item.variant.stock,
          }
        : null,
    };
  });

  const totals = calculateTotals(cartRecord.items, currencyCode);

  return {
    id: cartRecord.id,
    sessionId: cartRecord.sessionId,
    currencyCode: cartRecord.currencyCode,
    items,
    ...totals,
  };
}

// GET /api/cart - Get current cart
cart.get('/', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);
  const currencyCode = c.req.query('currency') || 'RUB';

  const cartRecord = await getOrCreateCart(sessionId, siteId, currencyCode);

  return c.json({
    cart: formatCartResponse(cartRecord, currencyCode),
  });
});

// Add item schema
const addItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().positive().default(1),
});

// POST /api/cart/items - Add item to cart
cart.post('/items', publicSiteMiddleware, zValidator('json', addItemSchema), async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);
  const { productId, variantId, quantity } = c.req.valid('json');

  // Get or create cart
  const cartRecord = await getOrCreateCart(sessionId, siteId);

  // Find product
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      siteId,
      status: 'published',
    },
  });

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Check variant if specified
  let variant = null;
  if (variantId) {
    variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        isActive: true,
      },
    });

    if (!variant) {
      return c.json({ error: 'Variant not found' }, 404);
    }
  }

  // Check stock (only if tracking is enabled)
  const availableStock = variant?.stock ?? product.stock;
  if (product.trackStock && availableStock <= 0) {
    return c.json({ error: 'Product out of stock' }, 400);
  }

  // Check if item already in cart
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cartRecord.id,
      productId,
      variantId: variantId || null,
    },
  });

  // Calculate price from variant or product
  const variantPrices = variant ? JSON.parse(variant.prices) : null;
  const productPrices = JSON.parse(product.prices);
  const price = variantPrices?.[cartRecord.currencyCode] ||
                productPrices[cartRecord.currencyCode] ||
                Number(variant?.price ?? product.price);

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;

    // Check stock limit (only if tracking is enabled)
    if (product.trackStock && newQuantity > availableStock) {
      return c.json({ error: 'Not enough stock', available: availableStock }, 400);
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    // Add new item - check stock limit (only if tracking is enabled)
    if (product.trackStock && quantity > availableStock) {
      return c.json({ error: 'Not enough stock', available: availableStock }, 400);
    }

    await prisma.cartItem.create({
      data: {
        cartId: cartRecord.id,
        productId,
        variantId: variantId || null,
        quantity,
        price, // Store the current price
      },
    });
  }

  // Return updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartRecord.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return c.json({
    cart: formatCartResponse(updatedCart, cartRecord.currencyCode),
    message: 'Item added to cart',
  });
});

// Update item schema
const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

// PUT /api/cart/items/:id - Update cart item quantity
cart.put('/items/:id', publicSiteMiddleware, zValidator('json', updateItemSchema), async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);
  const itemId = parseInt(c.req.param('id'));
  const { quantity } = c.req.valid('json');

  // Find cart
  const cartRecord = await prisma.cart.findFirst({
    where: { sessionId, siteId },
  });

  if (!cartRecord) {
    return c.json({ error: 'Cart not found' }, 404);
  }

  // Find item
  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cartRecord.id,
    },
    include: {
      product: true,
      variant: true,
    },
  });

  if (!item) {
    return c.json({ error: 'Cart item not found' }, 404);
  }

  // Check stock (only if tracking is enabled)
  const availableStock = item.variant?.stock ?? item.product.stock;
  if (item.product.trackStock && quantity > availableStock) {
    return c.json({ error: 'Not enough stock', available: availableStock }, 400);
  }

  // Update quantity
  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  // Return updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartRecord.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return c.json({
    cart: formatCartResponse(updatedCart, cartRecord.currencyCode),
    message: 'Cart item updated',
  });
});

// DELETE /api/cart/items/:id - Remove item from cart
cart.delete('/items/:id', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);
  const itemId = parseInt(c.req.param('id'));

  // Find cart
  const cartRecord = await prisma.cart.findFirst({
    where: { sessionId, siteId },
  });

  if (!cartRecord) {
    return c.json({ error: 'Cart not found' }, 404);
  }

  // Find and delete item
  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cartRecord.id,
    },
  });

  if (!item) {
    return c.json({ error: 'Cart item not found' }, 404);
  }

  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  // Return updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartRecord.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return c.json({
    cart: formatCartResponse(updatedCart, cartRecord.currencyCode),
    message: 'Item removed from cart',
  });
});

// DELETE /api/cart - Clear cart
cart.delete('/', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);

  // Find cart
  const cartRecord = await prisma.cart.findFirst({
    where: { sessionId, siteId },
  });

  if (!cartRecord) {
    return c.json({ error: 'Cart not found' }, 404);
  }

  // Delete all items
  await prisma.cartItem.deleteMany({
    where: { cartId: cartRecord.id },
  });

  // Return empty cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartRecord.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return c.json({
    cart: formatCartResponse(updatedCart, cartRecord.currencyCode),
    message: 'Cart cleared',
  });
});

// Currency change schema
const currencySchema = z.object({
  currencyCode: z.string().length(3),
});

// PUT /api/cart/currency - Change cart currency
cart.put('/currency', publicSiteMiddleware, zValidator('json', currencySchema), async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);
  const { currencyCode } = c.req.valid('json');

  // Validate currency exists (Currency is a global table, no siteId)
  const currency = await prisma.currency.findFirst({
    where: {
      code: currencyCode,
      isActive: true,
    },
  });

  if (!currency) {
    return c.json({ error: 'Currency not found or inactive' }, 400);
  }

  // Find or create cart
  const cartRecord = await getOrCreateCart(sessionId, siteId, currencyCode);

  // Update cart currency
  await prisma.cart.update({
    where: { id: cartRecord.id },
    data: { currencyCode },
  });

  // Refresh cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cartRecord.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
                take: 1,
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return c.json({
    cart: formatCartResponse(updatedCart, currencyCode),
    message: 'Currency updated',
  });
});

// POST /api/cart/validate - Validate cart before checkout
cart.post('/validate', publicSiteMiddleware, async (c) => {
  const siteId = c.get('siteId');
  const sessionId = await getOrCreateSession(c);

  // Find cart
  const cartRecord = await prisma.cart.findFirst({
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

  if (!cartRecord || cartRecord.items.length === 0) {
    return c.json({
      valid: false,
      errors: ['Cart is empty'],
    }, 400);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate each item
  for (const item of cartRecord.items) {
    // Check product is published
    if (item.product.status !== 'published') {
      errors.push(`Product "${item.product.name}" is no longer available`);
      continue;
    }

    // Check stock (only if tracking is enabled)
    const availableStock = item.variant?.stock ?? item.product.stock;
    if (item.product.trackStock && item.quantity > availableStock) {
      if (availableStock === 0) {
        errors.push(`Product "${item.product.name}" is out of stock`);
      } else {
        errors.push(`Only ${availableStock} units of "${item.product.name}" available`);
      }
    }

    // Check price changes
    const currentPrices = JSON.parse(item.variant?.prices || item.product.prices);
    const currencyCode = cartRecord.currencyCode;
    const currentPrice = currentPrices[currencyCode] || Number(item.variant?.price ?? item.product.price);
    const savedPrice = Number(item.price);

    if (currentPrice !== savedPrice) {
      warnings.push(`Price of "${item.product.name}" has changed`);
    }
  }

  if (errors.length > 0) {
    return c.json({
      valid: false,
      errors,
      warnings,
    }, 400);
  }

  return c.json({
    valid: true,
    warnings,
    cart: formatCartResponse(cartRecord, cartRecord.currencyCode),
  });
});

export { cart };
