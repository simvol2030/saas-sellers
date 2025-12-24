/**
 * Payment Webhooks Handler
 *
 * Endpoints:
 * POST /api/webhooks/yookassa/:siteId     - YooKassa payment notifications
 * POST /api/webhooks/telegram/:siteId     - Telegram Stars payment updates
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import {
  createPaymentProvider,
  type PaymentProviderType,
  type PaymentWebhookData,
} from '../lib/payments/index.js';
import { TelegramStarsProvider } from '../lib/payments/telegram-stars.js';

// Transaction client type
type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const webhooks = new Hono();

// Helper: Update order after successful payment
async function handleSuccessfulPayment(data: PaymentWebhookData) {
  const order = await prisma.order.findFirst({
    where: { id: data.orderId },
    include: { items: true },
  });

  if (!order) {
    console.error(`Webhook: Order ${data.orderId} not found`);
    return false;
  }

  // Update order status
  await prisma.$transaction(async (tx: TransactionClient) => {
    // Update order
    await tx.order.update({
      where: { id: data.orderId },
      data: {
        paymentStatus: 'paid',
        status: 'paid',
        paymentId: data.paymentId,
        paidAt: data.paidAt || new Date(),
      },
    });

    // Add status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: data.orderId,
        status: 'paid',
        note: `Payment received via ${data.metadata?.payment_method || 'online'}`,
      },
    });
  });

  console.log(`Webhook: Order ${order.orderNumber} marked as paid`);

  // TODO: Send notifications (email, telegram)
  // This would trigger the notification service

  return true;
}

// Helper: Handle payment cancellation
async function handlePaymentCanceled(data: PaymentWebhookData) {
  const order = await prisma.order.findFirst({
    where: { id: data.orderId },
  });

  if (!order) {
    console.error(`Webhook: Order ${data.orderId} not found`);
    return false;
  }

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.order.update({
      where: { id: data.orderId },
      data: {
        paymentStatus: 'failed',
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: data.orderId,
        status: order.status,
        note: 'Payment was canceled',
      },
    });
  });

  console.log(`Webhook: Order ${order.orderNumber} payment canceled`);
  return true;
}

// POST /api/webhooks/yookassa/:siteId - YooKassa webhook
webhooks.post('/yookassa/:siteId', async (c) => {
  const siteId = parseInt(c.req.param('siteId'));

  if (!siteId) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  // Get raw body
  const body = await c.req.text();

  // Get provider config
  const providerConfig = await prisma.paymentProvider.findFirst({
    where: {
      siteId,
      type: 'yookassa',
      isActive: true,
    },
  });

  if (!providerConfig) {
    console.error(`Webhook: YooKassa provider not found for site ${siteId}`);
    return c.json({ error: 'Provider not configured' }, 400);
  }

  // Create provider
  const config = JSON.parse(providerConfig.config);
  config.isTest = providerConfig.isTest;

  const provider = createPaymentProvider('yookassa', config);
  if (!provider) {
    return c.json({ error: 'Provider error' }, 500);
  }

  // Verify webhook (IP-based for YooKassa)
  // In production, add IP whitelist check here
  const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
  console.log(`YooKassa webhook from IP: ${clientIP}`);

  // Parse webhook
  const data = provider.parseWebhook(body);

  if (!data) {
    console.error('Webhook: Failed to parse YooKassa webhook');
    return c.json({ error: 'Invalid webhook data' }, 400);
  }

  console.log(`YooKassa webhook: order=${data.orderId}, status=${data.status}, paymentId=${data.paymentId}`);

  // Handle based on status
  try {
    if (data.status === 'succeeded') {
      await handleSuccessfulPayment(data);
    } else if (data.status === 'canceled') {
      await handlePaymentCanceled(data);
    }
    // Other statuses (pending, waiting_for_capture) - just acknowledge

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// POST /api/webhooks/telegram/:siteId - Telegram webhook
webhooks.post('/telegram/:siteId', async (c) => {
  const siteId = parseInt(c.req.param('siteId'));
  const secretToken = c.req.header('x-telegram-bot-api-secret-token');

  if (!siteId) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  // Get raw body
  const body = await c.req.text();

  // Get provider config
  const providerConfig = await prisma.paymentProvider.findFirst({
    where: {
      siteId,
      type: 'telegram_stars',
      isActive: true,
    },
  });

  if (!providerConfig) {
    console.error(`Webhook: Telegram provider not found for site ${siteId}`);
    return c.json({ error: 'Provider not configured' }, 400);
  }

  // Create provider
  const config = JSON.parse(providerConfig.config);
  config.isTest = providerConfig.isTest;

  const provider = new TelegramStarsProvider(config);

  // Parse update
  let update;
  try {
    update = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Handle pre-checkout query (must respond within 10 seconds)
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    console.log(`Telegram pre-checkout query: ${query.id}`);

    // Validate the order still exists and can be paid
    try {
      const payload = JSON.parse(query.invoice_payload);
      const orderId = parseInt(payload.order_id);

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          siteId,
          paymentStatus: { not: 'paid' },
        },
      });

      if (order) {
        await provider.answerPreCheckoutQuery(query.id, true);
      } else {
        await provider.answerPreCheckoutQuery(query.id, false, 'Order not found or already paid');
      }
    } catch (e) {
      await provider.answerPreCheckoutQuery(query.id, false, 'Invalid order');
    }

    return c.json({ success: true });
  }

  // Handle successful payment
  const data = provider.parseWebhook(body);

  if (data && data.status === 'succeeded') {
    console.log(`Telegram payment: order=${data.orderId}, paymentId=${data.paymentId}`);
    await handleSuccessfulPayment(data);
  }

  return c.json({ success: true });
});

// Health check for webhooks
webhooks.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/webhooks/yookassa/:siteId',
      '/api/webhooks/telegram/:siteId',
    ],
  });
});

export { webhooks };
