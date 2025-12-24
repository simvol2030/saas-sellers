/**
 * Notifications API
 *
 * Endpoints:
 * GET  /api/admin/notifications/settings  - Get notification settings
 * PUT  /api/admin/notifications/settings  - Update notification settings
 * POST /api/admin/notifications/test      - Send test notification
 * GET  /api/admin/notifications/low-stock - Get low stock products
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';
import { sendEmail, testEmailConnection, clearTransporterCache, sendOrderEmail, sendLowStockEmail, sendPaymentEmail } from '../lib/email/index.js';

const notifications = new Hono();
notifications.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

// ==========================================
// NOTIFICATION SETTINGS
// ==========================================

// GET /settings - Get notification settings
notifications.get('/settings', async (c) => {
  const siteId = c.get('siteId');

  let settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings) {
    // Create default settings
    settings = await prisma.notificationSettings.create({
      data: {
        siteId,
        notifyNewOrder: true,
        notifyPaymentReceived: true,
        notifyLowStock: true,
      },
    });
  }

  return c.json({
    settings: {
      // Email settings (hide password)
      email: {
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        smtpFrom: settings.smtpFrom,
        hasPassword: !!settings.smtpPass,
      },
      // Telegram settings (hide token)
      telegram: {
        chatId: settings.telegramChatId,
        hasToken: !!settings.telegramBotToken,
      },
      // Notification preferences
      notifyNewOrder: settings.notifyNewOrder,
      notifyPaymentReceived: settings.notifyPaymentReceived,
      notifyLowStock: settings.notifyLowStock,
    },
  });
});

// Update schema
const settingsSchema = z.object({
  // Email
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),
  // Telegram
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  // Preferences
  notifyNewOrder: z.boolean().optional(),
  notifyPaymentReceived: z.boolean().optional(),
  notifyLowStock: z.boolean().optional(),
});

// PUT /settings - Update notification settings
notifications.put('/settings', zValidator('json', settingsSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  await prisma.notificationSettings.upsert({
    where: { siteId },
    update: {
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpPass: data.smtpPass,
      smtpFrom: data.smtpFrom,
      telegramBotToken: data.telegramBotToken,
      telegramChatId: data.telegramChatId,
      notifyNewOrder: data.notifyNewOrder,
      notifyPaymentReceived: data.notifyPaymentReceived,
      notifyLowStock: data.notifyLowStock,
    },
    create: {
      siteId,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpPass: data.smtpPass,
      smtpFrom: data.smtpFrom,
      telegramBotToken: data.telegramBotToken,
      telegramChatId: data.telegramChatId,
      notifyNewOrder: data.notifyNewOrder ?? true,
      notifyPaymentReceived: data.notifyPaymentReceived ?? true,
      notifyLowStock: data.notifyLowStock ?? true,
    },
  });

  // Clear transporter cache when SMTP settings change
  clearTransporterCache(siteId);

  return c.json({ message: 'Settings updated' });
});

// Test schema
const testSchema = z.object({
  type: z.enum(['email', 'telegram']),
  recipient: z.string().optional(), // Email address or chat ID
});

// POST /test - Send test notification
notifications.post('/test', zValidator('json', testSchema), async (c) => {
  const siteId = c.get('siteId');
  const { type, recipient } = c.req.valid('json');

  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings) {
    return c.json({ error: 'Notification settings not configured' }, 400);
  }

  if (type === 'email') {
    if (!settings.smtpHost || !settings.smtpUser) {
      return c.json({ error: 'Email settings not configured' }, 400);
    }

    const to = recipient || settings.smtpFrom;
    if (!to) {
      return c.json({ error: 'No email recipient' }, 400);
    }

    try {
      // First test the connection
      const connectionTest = await testEmailConnection(siteId);
      if (!connectionTest.success) {
        return c.json({
          success: false,
          error: `Connection failed: ${connectionTest.error}`,
        }, 400);
      }

      // Send test email using nodemailer
      const subject = 'Test notification from SaaS Platform';
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">Test Email</h2>
          <p>This is a test notification from your SaaS Platform.</p>
          <p>If you received this message, your email settings are configured correctly!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            From: ${settings.smtpFrom}
          </p>
        </div>
      `;

      const result = await sendEmail(siteId, to, subject, html);

      if (result.success) {
        return c.json({
          success: true,
          message: `Test email sent to ${to}`,
        });
      } else {
        return c.json({
          success: false,
          error: result.error || 'Email send failed',
        }, 500);
      }
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
      }, 500);
    }
  }

  if (type === 'telegram') {
    if (!settings.telegramBotToken) {
      return c.json({ error: 'Telegram bot token not configured' }, 400);
    }

    const chatId = recipient || settings.telegramChatId;
    if (!chatId) {
      return c.json({ error: 'No Telegram chat ID' }, 400);
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ Test notification from SaaS Platform\n\nIf you received this message, Telegram notifications are configured correctly.',
            parse_mode: 'HTML',
          }),
        }
      );

      const result = await response.json() as { ok: boolean; description?: string };

      if (!result.ok) {
        return c.json({
          success: false,
          error: result.description || 'Telegram send failed',
        }, 400);
      }

      return c.json({
        success: true,
        message: `Test message sent to chat ${chatId}`,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Telegram send failed',
      }, 500);
    }
  }

  return c.json({ error: 'Invalid notification type' }, 400);
});

// ==========================================
// LOW STOCK ALERTS
// ==========================================

// GET /low-stock - Get products with low stock
notifications.get('/low-stock', async (c) => {
  const siteId = c.get('siteId');
  const customThreshold = parseInt(c.req.query('threshold') || '0');

  // Get all active products with stock tracking
  const allProducts = await prisma.product.findMany({
    where: {
      siteId,
      status: 'active',
      trackStock: true,
    },
    include: {
      category: { select: { name: true } },
      images: { take: 1, orderBy: { position: 'asc' } },
      variants: {
        where: { isActive: true },
      },
    },
    orderBy: { stock: 'asc' },
  });

  // Filter products where stock <= lowStockThreshold (or custom threshold)
  type ProductWithRelations = typeof allProducts[number];
  const products = allProducts.filter((p: ProductWithRelations) => {
    const threshold = customThreshold > 0 ? customThreshold : p.lowStockThreshold;
    return p.stock <= threshold;
  });

  // Also check variant stock
  const variantsLow = await prisma.productVariant.findMany({
    where: {
      product: { siteId, status: 'active', trackStock: true },
      isActive: true,
      stock: { lte: customThreshold > 0 ? customThreshold : 5 },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          lowStockThreshold: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { stock: 'asc' },
  });

  // Combine results
  type VariantWithProduct = typeof variantsLow[number];
  const lowStockItems = [
    ...products.map((p: ProductWithRelations) => ({
      type: 'product' as const,
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      stock: p.stock,
      threshold: p.lowStockThreshold,
      category: p.category?.name,
      image: p.images[0]?.url,
      isOutOfStock: p.stock === 0,
    })),
    ...variantsLow
      .filter((v: VariantWithProduct) => !products.some((p: ProductWithRelations) => p.id === v.productId))
      .map((v: VariantWithProduct) => ({
        type: 'variant' as const,
        id: v.id,
        productId: v.productId,
        name: `${v.product.name} - ${v.name}`,
        slug: v.product.slug,
        sku: v.sku,
        stock: v.stock,
        threshold: v.product.lowStockThreshold,
        category: v.product.category?.name,
        isOutOfStock: v.stock === 0,
      })),
  ].sort((a, b) => a.stock - b.stock);

  // Summary
  const summary = {
    outOfStock: lowStockItems.filter(i => i.isOutOfStock).length,
    lowStock: lowStockItems.filter(i => !i.isOutOfStock).length,
    total: lowStockItems.length,
  };

  return c.json({
    summary,
    items: lowStockItems,
  });
});

// ==========================================
// NOTIFICATION SERVICE (for internal use)
// ==========================================

export async function sendOrderNotification(siteId: number, orderId: number) {
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings || !settings.notifyNewOrder) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) return;

  const message = `
🛒 <b>Новый заказ ${order.orderNumber}</b>

👤 ${order.customerName || order.email}
📧 ${order.email}
${order.phone ? `📱 ${order.phone}` : ''}

💰 Сумма: ${order.total} ${order.currencyCode}
📦 Товаров: ${order.items.length}

Статус: ${order.status}
`.trim();

  // Send Telegram notification to admin
  if (settings.telegramBotToken && settings.telegramChatId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );

      await prisma.order.update({
        where: { id: orderId },
        data: { telegramSent: true },
      });
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }

  // Send email notification to customer
  if (settings.smtpHost && settings.smtpFrom) {
    try {
      await sendOrderEmail(siteId, orderId);
    } catch (error) {
      console.error('Failed to send order email:', error);
    }
  }
}

export async function sendPaymentNotification(siteId: number, orderId: number) {
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings || !settings.notifyPaymentReceived) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) return;

  const message = `
💳 <b>Оплата получена</b>

Заказ: ${order.orderNumber}
Сумма: ${order.total} ${order.currencyCode}
Метод: ${order.paymentMethod}
`.trim();

  if (settings.telegramBotToken && settings.telegramChatId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }

  // Send email notification to customer
  if (settings.smtpHost && settings.smtpFrom) {
    try {
      await sendPaymentEmail(siteId, orderId);
    } catch (error) {
      console.error('Failed to send payment email:', error);
    }
  }
}

export async function sendLowStockAlert(siteId: number) {
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings || !settings.notifyLowStock) return;

  // Find low stock products (stock <= lowStockThreshold)
  const allProducts = await prisma.product.findMany({
    where: {
      siteId,
      status: 'active',
      trackStock: true,
    },
    select: { name: true, sku: true, stock: true, lowStockThreshold: true },
  });

  type LowStockProduct = typeof allProducts[number];
  const lowStock = allProducts
    .filter((p: LowStockProduct) => p.stock <= p.lowStockThreshold)
    .slice(0, 10);

  if (lowStock.length === 0) return;

  const items = lowStock.map((p: LowStockProduct) =>
    `• ${p.name} ${p.sku ? `(${p.sku})` : ''}: ${p.stock} шт.`
  ).join('\n');

  const message = `
⚠️ <b>Низкий остаток товаров</b>

${items}

${lowStock.length >= 10 ? '...и другие' : ''}
`.trim();

  if (settings.telegramBotToken && settings.telegramChatId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }

  // Send email notification to admin
  if (settings.smtpHost && settings.smtpFrom) {
    try {
      await sendLowStockEmail(siteId);
    } catch (error) {
      console.error('Failed to send low stock email:', error);
    }
  }
}

export { notifications };
