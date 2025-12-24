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
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './lib/db.js';

dotenv.config();

const app = new Hono();
const PORT = parseInt(process.env.PORT || '3001');

// Logger middleware
app.use('*', logger());

// Security middleware
app.use('*', secureHeaders());
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Rate limiting
app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // 100 requests per window
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown'
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
app.route('/api/admin/pages', adminPages);
app.route('/api/pages', publicPages);
app.route('/api/media', media);
app.route('/api/admin/settings', settings);
app.route('/api/admin/theme', theme);

// Error handler (must be last)
app.onError(errorHandler);

// Start server
const server = serve({
  fetch: app.fetch,
  port: PORT
});

console.log(`Hono server running on http://localhost:${PORT}`);
console.log(`Health check: http://localhost:${PORT}/health`);

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
