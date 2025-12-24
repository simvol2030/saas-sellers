/**
 * Reviews API
 *
 * Public: Submit and view reviews
 * Admin: Moderate reviews (approve/reject)
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';

// Type for review with product info
interface ReviewWithProduct {
  id: number;
  productId: number;
  authorName: string;
  authorEmail: string;
  rating: number;
  title: string | null;
  content: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: number;
    name: string;
    slug: string;
  };
}

// Type for review stats
interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// Validation schemas
const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  authorName: z.string().min(2).max(100),
  authorEmail: z.string().email(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  content: z.string().min(10).max(5000),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

export const reviews = new Hono();

// ==========================================
// PUBLIC ROUTES
// ==========================================

/**
 * GET /product/:productId - Get approved reviews for a product
 */
reviews.get('/product/:productId', async (c) => {
  const productId = parseInt(c.req.param('productId'));
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const sortBy = c.req.query('sortBy') || 'createdAt';
  const sortOrder = c.req.query('sortOrder') === 'asc' ? 'asc' : 'desc';

  if (isNaN(productId)) {
    return c.json({ error: 'Invalid product ID' }, 400);
  }

  const skip = (page - 1) * limit;

  // Get approved reviews only
  const [reviewsData, total] = await Promise.all([
    prisma.review.findMany({
      where: {
        productId,
        status: 'approved',
      },
      orderBy: sortBy === 'rating'
        ? { rating: sortOrder }
        : { createdAt: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        content: true,
        isVerified: true,
        createdAt: true,
      },
    }),
    prisma.review.count({
      where: {
        productId,
        status: 'approved',
      },
    }),
  ]);

  // Calculate stats
  const allRatings = await prisma.review.findMany({
    where: {
      productId,
      status: 'approved',
    },
    select: {
      rating: true,
    },
  });

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;

  type RatingRecord = { rating: number };
  allRatings.forEach((r: RatingRecord) => {
    const key = r.rating as 1 | 2 | 3 | 4 | 5;
    distribution[key]++;
    totalRating += r.rating;
  });

  const stats: ReviewStats = {
    averageRating: allRatings.length > 0 ? totalRating / allRatings.length : 0,
    totalReviews: allRatings.length,
    distribution,
  };

  return c.json({
    reviews: reviewsData,
    stats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /submit - Submit a new review
 */
reviews.post('/submit', async (c) => {
  try {
    const body = await c.req.json();
    const data = createReviewSchema.parse(body);

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, siteId: true },
    });

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    // Check for duplicate review (same email + product within 24 hours)
    const existingReview = await prisma.review.findFirst({
      where: {
        productId: data.productId,
        authorEmail: data.authorEmail,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingReview) {
      return c.json({
        error: 'You have already submitted a review for this product recently'
      }, 429);
    }

    // Create review (pending status by default)
    const review = await prisma.review.create({
      data: {
        productId: data.productId,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        rating: data.rating,
        title: data.title || null,
        content: data.content,
        status: 'pending',
        isVerified: false,
      },
    });

    return c.json({
      success: true,
      message: 'Review submitted successfully. It will be visible after moderation.',
      review: {
        id: review.id,
        rating: review.rating,
        status: review.status,
      },
    }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error submitting review:', error);
    return c.json({ error: 'Failed to submit review' }, 500);
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

/**
 * GET /admin - Get all reviews with filters (admin)
 */
reviews.get('/admin', authMiddleware, async (c) => {
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const status = c.req.query('status'); // pending, approved, rejected
  const productId = c.req.query('productId');
  const search = c.req.query('search');

  const skip = (page - 1) * limit;

  // Build where clause
  interface WhereClause {
    product: { siteId: number };
    status?: string;
    productId?: number;
    OR?: Array<{ authorName: { contains: string } } | { authorEmail: { contains: string } } | { content: { contains: string } }>;
  }

  const where: WhereClause = {
    product: { siteId },
  };

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.status = status;
  }

  if (productId) {
    where.productId = parseInt(productId);
  }

  if (search) {
    where.OR = [
      { authorName: { contains: search } },
      { authorEmail: { contains: search } },
      { content: { contains: search } },
    ];
  }

  const [reviewsData, total, pendingCount] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
    prisma.review.count({
      where: {
        product: { siteId },
        status: 'pending',
      },
    }),
  ]);

  return c.json({
    reviews: reviewsData as ReviewWithProduct[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    pendingCount,
  });
});

/**
 * PATCH /admin/:id/status - Update review status
 */
reviews.patch('/admin/:id/status', authMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid review ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const { status } = updateStatusSchema.parse(body);

    // Check review exists and belongs to site
    const review = await prisma.review.findFirst({
      where: {
        id,
        product: { siteId },
      },
    });

    if (!review) {
      return c.json({ error: 'Review not found' }, 404);
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { status },
    });

    return c.json({
      success: true,
      review: updated,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error updating review:', error);
    return c.json({ error: 'Failed to update review' }, 500);
  }
});

/**
 * PATCH /admin/:id/verify - Toggle verified status
 */
reviews.patch('/admin/:id/verify', authMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid review ID' }, 400);
  }

  const review = await prisma.review.findFirst({
    where: {
      id,
      product: { siteId },
    },
  });

  if (!review) {
    return c.json({ error: 'Review not found' }, 404);
  }

  const updated = await prisma.review.update({
    where: { id },
    data: { isVerified: !review.isVerified },
  });

  return c.json({
    success: true,
    review: updated,
  });
});

/**
 * DELETE /admin/:id - Delete a review
 */
reviews.delete('/admin/:id', authMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'));
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid review ID' }, 400);
  }

  const review = await prisma.review.findFirst({
    where: {
      id,
      product: { siteId },
    },
  });

  if (!review) {
    return c.json({ error: 'Review not found' }, 404);
  }

  await prisma.review.delete({
    where: { id },
  });

  return c.json({
    success: true,
    message: 'Review deleted',
  });
});

/**
 * POST /admin/bulk - Bulk update reviews
 */
reviews.post('/admin/bulk', authMiddleware, async (c) => {
  const siteId = parseInt(c.req.header('X-Site-ID') || '1');

  try {
    const body = await c.req.json();
    const { ids, action } = body as { ids: number[]; action: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'No reviews selected' }, 400);
    }

    if (!['approve', 'reject', 'delete'].includes(action)) {
      return c.json({ error: 'Invalid action' }, 400);
    }

    // Verify all reviews belong to site
    const reviews = await prisma.review.findMany({
      where: {
        id: { in: ids },
        product: { siteId },
      },
      select: { id: true },
    });

    const validIds = reviews.map((r: { id: number }) => r.id);

    if (validIds.length === 0) {
      return c.json({ error: 'No valid reviews found' }, 404);
    }

    if (action === 'delete') {
      await prisma.review.deleteMany({
        where: { id: { in: validIds } },
      });
    } else {
      const status = action === 'approve' ? 'approved' : 'rejected';
      await prisma.review.updateMany({
        where: { id: { in: validIds } },
        data: { status },
      });
    }

    return c.json({
      success: true,
      message: `${validIds.length} reviews ${action}d`,
      count: validIds.length,
    });

  } catch (error) {
    console.error('Error bulk updating reviews:', error);
    return c.json({ error: 'Failed to update reviews' }, 500);
  }
});
