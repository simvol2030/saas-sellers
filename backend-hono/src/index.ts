import dotenv from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { rateLimiter } from 'hono-rate-limiter';
import media from './routes/media.js';
import auth from './routes/auth.js';
import adminPages from './routes/pages.js';
import publicPages from './routes/public-pages.js';
import settings from './routes/settings.js';
import theme from './routes/theme.js';
// Phase 1: New routes
import sites from './routes/sites.js';
import tags from './routes/tags.js';
import mediaFolders from './routes/media-folders.js';
import blocks from './routes/blocks.js';
import menus from './routes/menus.js';
import exportImport from './routes/export-import.js';
// Phase 3: User management
import users from './routes/users.js';
// Phase 4: E-commerce
import currencies from './routes/currencies.js';
import categories from './routes/categories.js';
import products from './routes/products.js';
import { cart } from './routes/cart.js';
import { shipping } from './routes/shipping.js';
import { ordersPublic, ordersAdmin } from './routes/orders.js';
// Phase 4: Payments
import { paymentsPublic, paymentsAdmin } from './routes/payments.js';
import { webhooks } from './routes/webhooks.js';
// Phase 5: Additional features
import { promoPublic, promoAdmin } from './routes/promo-codes.js';
import { productImportExport } from './routes/product-import-export.js';
import { notifications } from './routes/notifications.js';
// Phase 6: Stats and optional features
import { stats } from './routes/stats.js';
import { reviews } from './routes/reviews.js';
import { wishlist } from './routes/wishlist.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma, initDatabase } from './lib/db.js';

dotenv.config();

// ===========================================
// CORS Configuration
// ===========================================
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getCorsOrigin(): string | string[] {
  if (!IS_PRODUCTION) {
    return '*'; // Allow all in development
  }

  if (ALLOWED_ORIGINS.length === 0) {
    console.warn('⚠️ ALLOWED_ORIGINS not set in production!');
    return []; // Block all cross-origin in production without config
  }

  return ALLOWED_ORIGINS;
}

const app = new Hono();
const PORT = parseInt(process.env.PORT || '3001');

// Logger middleware
app.use('*', logger());

// Security middleware
app.use('*', secureHeaders());
app.use('*', cors({
  origin: getCorsOrigin(),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Site-ID'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
}));

// ===========================================
// Rate Limiting
// ===========================================

// Strict rate limiting for auth routes (brute-force protection)
app.use('/api/auth/login', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Only 5 login attempts per 15 minutes
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
  message: { error: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' },
}));

app.use('/api/auth/register', rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // Only 3 registration attempts per hour
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
  message: { error: 'Too many registration attempts, please try again later', code: 'RATE_LIMITED' },
}));

app.use('/api/auth/refresh', rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 refresh attempts per minute
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
}));

// General API rate limiting
app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: IS_PRODUCTION ? 500 : 2000, // Stricter in production
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
}));

// Health check
app.get('/health', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const memoryUsage = process.memoryUsage();
    return c.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

// Routes
app.route('/api/auth', auth);
// Phase 3: User management (superadmin only)
app.route('/api/admin/users', users);
// Phase 2: Export/Import - MUST be before /api/admin/pages to avoid route conflict
// (/pages/import and /pages/export-all would match /:id in pages.ts)
app.route('/api/admin', exportImport);
app.route('/api/admin/pages', adminPages);
app.route('/api/pages', publicPages);
app.route('/api/media', media);
app.route('/api/admin/settings', settings);
app.route('/api/admin/theme', theme);
// Phase 1: New routes
app.route('/api/admin/sites', sites);
app.route('/api/admin/tags', tags);
app.route('/api/admin/media/folders', mediaFolders);
app.route('/api/admin/blocks', blocks);
app.route('/api/admin/menus', menus);
app.route('/api/menus', menus); // Public menu access
// Phase 4: E-commerce routes
app.route('/api/admin/currencies', currencies);
app.route('/api/currencies', currencies); // Public currencies (uses /public endpoint)
app.route('/api/admin/categories', categories);
app.route('/api/categories', categories); // Public categories (uses /public endpoint)
app.route('/api/admin/products', productImportExport); // Import/export MUST be before products (/:id catches /export)
app.route('/api/admin/products', products);
app.route('/api/products', products); // Public products (uses /public endpoint)
app.route('/api/cart', cart); // Shopping cart
app.route('/api/admin/shipping', shipping);
app.route('/api/shipping', shipping); // Public shipping methods
app.route('/api/admin/orders', ordersAdmin);
app.route('/api/orders', ordersPublic); // Public order lookup + checkout
// Phase 4: Payments
app.route('/api/payments', paymentsPublic);
app.route('/api/admin/payments', paymentsAdmin); // Admin payment providers
app.route('/api/webhooks', webhooks); // Payment webhooks
// Phase 5: Additional features
app.route('/api/promo', promoPublic); // Public promo validation
app.route('/api/admin/promo', promoAdmin); // Admin promo management

app.route('/api/admin/notifications', notifications); // Notification settings
app.route('/api/admin/stats', stats); // Statistics and analytics
app.route('/api/reviews', reviews); // Public reviews
app.route('/api/admin/reviews', reviews); // Admin review moderation
app.route('/api/wishlist', wishlist); // Wishlist/favorites

// Error handler (must be last)
app.onError(errorHandler);

// ===========================================
// Server Startup
// ===========================================

async function startServer() {
  // Initialize database with SQLite optimizations (WAL mode, etc.)
  await initDatabase();

  // Start HTTP server
  const server = serve({
    fetch: app.fetch,
    port: PORT
  });

  console.log(`🚀 Hono server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);

  return server;
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
