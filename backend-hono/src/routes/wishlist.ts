/**
 * Wishlist API
 *
 * Manage user wishlists (favorites) for products
 * Uses sessionId from cookies for guest users
 */
import { Hono, Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { prisma } from '../lib/db.js';

// Type for wishlist with items
interface WishlistWithItems {
  id: number;
  sessionId: string;
  userId: number | null;
  siteId: number;
  items: Array<{
    id: number;
    productId: number;
    addedAt: Date;
    product: {
      id: number;
      name: string;
      slug: string;
      price: unknown;
      comparePrice: unknown | null;
      status: string;
      images: Array<{
        url: string;
        alt: string | null;
        isMain: boolean;
      }>;
    };
  }>;
}

// Type for product in response
interface ProductInWishlist {
  id: number;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  status: string;
  image: string | null;
  inStock: boolean;
}

// Helper to convert Prisma Decimal to number
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'toNumber' in (value as object)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return parseFloat(String(value)) || 0;
}

// Generate session ID
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'wl_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const wishlist = new Hono();

/**
 * Get or create wishlist session
 */
async function getOrCreateWishlist(
  c: Context,
  siteId: number
): Promise<WishlistWithItems> {
  let sessionId = getCookie(c, 'wishlist_session');

  if (!sessionId) {
    sessionId = generateSessionId();
    setCookie(c, 'wishlist_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: '/',
    });
  }

  // Try to find existing wishlist
  let wishlistRecord = await prisma.wishlist.findUnique({
    where: { sessionId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              comparePrice: true,
              status: true,
              images: {
                where: { isMain: true },
                take: 1,
                select: {
                  url: true,
                  alt: true,
                  isMain: true,
                },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  });

  // Create if not exists
  if (!wishlistRecord) {
    wishlistRecord = await prisma.wishlist.create({
      data: {
        sessionId,
        siteId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                comparePrice: true,
                status: true,
                images: {
                  where: { isMain: true },
                  take: 1,
                  select: {
                    url: true,
                    alt: true,
                    isMain: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  return wishlistRecord as WishlistWithItems;
}

/**
 * GET / - Get current wishlist
 */
wishlist.get('/', async (c) => {
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  const wishlistData = await getOrCreateWishlist(c, siteId);

  // Transform to response format
  const products: ProductInWishlist[] = wishlistData.items.map(item => ({
    id: item.product.id,
    name: item.product.name,
    slug: item.product.slug,
    price: toNumber(item.product.price),
    comparePrice: item.product.comparePrice ? toNumber(item.product.comparePrice) : null,
    status: item.product.status,
    image: item.product.images[0]?.url || null,
    inStock: item.product.status === 'published',
  }));

  return c.json({
    count: products.length,
    products,
    productIds: products.map(p => p.id),
  });
});

/**
 * GET /check/:productId - Check if product is in wishlist
 */
wishlist.get('/check/:productId', async (c) => {
  const productId = parseInt(c.req.param('productId'));
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  if (isNaN(productId)) {
    return c.json({ inWishlist: false });
  }

  const sessionId = getCookie(c, 'wishlist_session');
  if (!sessionId) {
    return c.json({ inWishlist: false });
  }

  const item = await prisma.wishlistItem.findFirst({
    where: {
      wishlist: { sessionId, siteId },
      productId,
    },
  });

  return c.json({ inWishlist: !!item });
});

/**
 * POST /add - Add product to wishlist
 */
wishlist.post('/add', async (c) => {
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  try {
    const body = await c.req.json();
    const productId = body.productId as number;

    if (!productId || typeof productId !== 'number') {
      return c.json({ error: 'Product ID required' }, 400);
    }

    // Verify product exists and is from same site
    const product = await prisma.product.findFirst({
      where: { id: productId, siteId },
    });

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const wishlistData = await getOrCreateWishlist(c, siteId);

    // Check if already in wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlistData.id,
          productId,
        },
      },
    });

    if (existing) {
      return c.json({
        success: true,
        message: 'Product already in wishlist',
        count: wishlistData.items.length,
      });
    }

    // Add to wishlist
    await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlistData.id,
        productId,
      },
    });

    return c.json({
      success: true,
      message: 'Product added to wishlist',
      count: wishlistData.items.length + 1,
    });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return c.json({ error: 'Failed to add to wishlist' }, 500);
  }
});

/**
 * DELETE /remove/:productId - Remove product from wishlist
 */
wishlist.delete('/remove/:productId', async (c) => {
  const productId = parseInt(c.req.param('productId'));
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  if (isNaN(productId)) {
    return c.json({ error: 'Invalid product ID' }, 400);
  }

  const sessionId = getCookie(c, 'wishlist_session');
  if (!sessionId) {
    return c.json({ error: 'Wishlist not found' }, 404);
  }

  const wishlistRecord = await prisma.wishlist.findUnique({
    where: { sessionId },
    select: { id: true, siteId: true },
  });

  if (!wishlistRecord || wishlistRecord.siteId !== siteId) {
    return c.json({ error: 'Wishlist not found' }, 404);
  }

  // Delete item
  await prisma.wishlistItem.deleteMany({
    where: {
      wishlistId: wishlistRecord.id,
      productId,
    },
  });

  // Get updated count
  const count = await prisma.wishlistItem.count({
    where: { wishlistId: wishlistRecord.id },
  });

  return c.json({
    success: true,
    message: 'Product removed from wishlist',
    count,
  });
});

/**
 * POST /toggle - Toggle product in wishlist (add if not exists, remove if exists)
 */
wishlist.post('/toggle', async (c) => {
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  try {
    const body = await c.req.json();
    const productId = body.productId as number;

    if (!productId || typeof productId !== 'number') {
      return c.json({ error: 'Product ID required' }, 400);
    }

    // Verify product exists
    const product = await prisma.product.findFirst({
      where: { id: productId, siteId },
    });

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const wishlistData = await getOrCreateWishlist(c, siteId);

    // Check if in wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlistData.id,
          productId,
        },
      },
    });

    if (existing) {
      // Remove
      await prisma.wishlistItem.delete({
        where: { id: existing.id },
      });

      return c.json({
        success: true,
        action: 'removed',
        inWishlist: false,
        count: wishlistData.items.length - 1,
      });
    } else {
      // Add
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlistData.id,
          productId,
        },
      });

      return c.json({
        success: true,
        action: 'added',
        inWishlist: true,
        count: wishlistData.items.length + 1,
      });
    }

  } catch (error) {
    console.error('Error toggling wishlist:', error);
    return c.json({ error: 'Failed to update wishlist' }, 500);
  }
});

/**
 * DELETE /clear - Clear entire wishlist
 */
wishlist.delete('/clear', async (c) => {
  const sessionId = getCookie(c, 'wishlist_session');

  if (!sessionId) {
    return c.json({ success: true, message: 'Wishlist already empty' });
  }

  const wishlistRecord = await prisma.wishlist.findUnique({
    where: { sessionId },
    select: { id: true },
  });

  if (wishlistRecord) {
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlistRecord.id },
    });
  }

  return c.json({
    success: true,
    message: 'Wishlist cleared',
    count: 0,
  });
});

/**
 * GET /count - Get wishlist item count
 */
wishlist.get('/count', async (c) => {
  const sessionId = getCookie(c, 'wishlist_session');

  if (!sessionId) {
    return c.json({ count: 0 });
  }

  const count = await prisma.wishlistItem.count({
    where: {
      wishlist: { sessionId },
    },
  });

  return c.json({ count });
});
