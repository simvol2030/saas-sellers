import dotenv from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { rateLimiter } from 'hono-rate-limiter';
import users from './routes/users';
import posts from './routes/posts';
import categories from './routes/categories';
import tags from './routes/tags';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/db';

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
  limit: 100, // 100 requests per window
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
app.route('/api/users', users);
app.route('/api/posts', posts);
app.route('/api/categories', categories);
app.route('/api/tags', tags);

// Error handling
app.onError(errorHandler);

// Graceful shutdown
const cleanup = async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log(`Hono server running on http://localhost:${info.port}`);
  console.log(`Health check: http://localhost:${info.port}/health`);
});
