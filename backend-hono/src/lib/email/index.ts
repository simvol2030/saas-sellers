/**
 * Email Service with Nodemailer
 *
 * Sends transactional emails using SMTP configuration from NotificationSettings
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../db.js';
import { getOrderEmailTemplate, getLowStockEmailTemplate, getPaymentEmailTemplate } from './templates.js';

// Cache transporters per site to avoid recreating
const transporterCache = new Map<number, { transporter: Transporter; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get or create nodemailer transporter for a site
 */
async function getTransporter(siteId: number): Promise<Transporter | null> {
  // Check cache
  const cached = transporterCache.get(siteId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.transporter;
  }

  // Get settings from DB
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    return null;
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  // Cache it
  transporterCache.set(siteId, {
    transporter,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return transporter;
}

/**
 * Get sender email address for a site
 */
async function getSenderEmail(siteId: number): Promise<string | null> {
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
    select: { smtpFrom: true },
  });
  return settings?.smtpFrom || null;
}

/**
 * Send a generic email
 */
export async function sendEmail(
  siteId: number,
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter(siteId);
    if (!transporter) {
      return { success: false, error: 'Email not configured' };
    }

    const from = await getSenderEmail(siteId);
    if (!from) {
      return { success: false, error: 'Sender email not configured' };
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderEmail(siteId: number, orderId: number): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
      site: { select: { name: true } },
    },
  });

  if (!order) {
    console.error(`[EMAIL] Order ${orderId} not found`);
    return false;
  }

  const html = getOrderEmailTemplate(order);
  const subject = `Заказ ${order.orderNumber} получен`;

  const result = await sendEmail(siteId, order.email, subject, html);

  if (result.success) {
    await prisma.order.update({
      where: { id: orderId },
      data: { emailSent: true },
    });
  }

  return result.success;
}

/**
 * Send payment received email
 */
export async function sendPaymentEmail(siteId: number, orderId: number): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      site: { select: { name: true } },
    },
  });

  if (!order) {
    console.error(`[EMAIL] Order ${orderId} not found for payment notification`);
    return false;
  }

  const html = getPaymentEmailTemplate(order);
  const subject = `Оплата получена - Заказ ${order.orderNumber}`;

  const result = await sendEmail(siteId, order.email, subject, html);
  return result.success;
}

/**
 * Send low stock alert to admin
 */
export async function sendLowStockEmail(siteId: number): Promise<boolean> {
  const settings = await prisma.notificationSettings.findUnique({
    where: { siteId },
  });

  if (!settings?.notifyLowStock) {
    return false;
  }

  // Get low stock products
  const allProducts = await prisma.product.findMany({
    where: {
      siteId,
      status: 'active',
      trackStock: true,
    },
    select: {
      name: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
    },
  });

  type ProductType = typeof allProducts[number];
  const lowStockProducts = allProducts.filter(
    (p: ProductType) => p.stock <= p.lowStockThreshold
  );

  if (lowStockProducts.length === 0) {
    return true; // No low stock items
  }

  // Get admin email (use smtpFrom as admin email)
  const adminEmail = settings.smtpFrom;
  if (!adminEmail) {
    console.error('[EMAIL] No admin email configured for low stock alerts');
    return false;
  }

  const html = getLowStockEmailTemplate(lowStockProducts);
  const subject = `Низкий остаток товаров (${lowStockProducts.length})`;

  const result = await sendEmail(siteId, adminEmail, subject, html);
  return result.success;
}

/**
 * Test email configuration
 */
export async function testEmailConnection(siteId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter(siteId);
    if (!transporter) {
      return { success: false, error: 'Email not configured' };
    }

    await transporter.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Clear transporter cache (e.g., when settings change)
 */
export function clearTransporterCache(siteId?: number): void {
  if (siteId) {
    transporterCache.delete(siteId);
  } else {
    transporterCache.clear();
  }
}
