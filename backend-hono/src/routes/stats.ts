/**
 * Sales Statistics API
 *
 * Endpoints:
 * GET /api/admin/stats/overview     - General overview (totals, counts)
 * GET /api/admin/stats/sales        - Sales by period (for charts)
 * GET /api/admin/stats/products/top - Top selling products
 * GET /api/admin/stats/orders/recent - Recent orders
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const stats = new Hono();
stats.use('*', authMiddleware, siteMiddleware, requireSite, editorOrAdmin);

// Helper: get date range based on period
function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      // Default to 30 days
      start.setDate(start.getDate() - 30);
  }

  return { start, end };
}

// ==========================================
// OVERVIEW
// ==========================================

// GET /overview - General statistics overview
stats.get('/overview', async (c) => {
  const siteId = c.get('siteId');
  const period = c.req.query('period') || 'month';

  const { start, end } = getDateRange(period);

  // Get previous period for comparison
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - periodDays);
  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(-1);

  // Current period stats
  const currentOrders = await prisma.order.findMany({
    where: {
      siteId,
      createdAt: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    select: { total: true, status: true, paymentStatus: true },
  });

  // Previous period stats
  const prevOrders = await prisma.order.findMany({
    where: {
      siteId,
      createdAt: { gte: prevStart, lte: prevEnd },
      status: { not: 'cancelled' },
    },
    select: { total: true },
  });

  // Calculate totals
  type OrderSelect = { total: number | string | { toNumber?: () => number } };
  const toNumber = (val: number | string | { toNumber?: () => number }): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (val?.toNumber) return val.toNumber();
    return 0;
  };

  const currentRevenue = currentOrders.reduce((sum: number, o: OrderSelect) => sum + toNumber(o.total), 0);
  const prevRevenue = prevOrders.reduce((sum: number, o: OrderSelect) => sum + toNumber(o.total), 0);
  const currentOrderCount = currentOrders.length;
  const prevOrderCount = prevOrders.length;

  type CurrentOrderType = typeof currentOrders[number];
  const paidOrders = currentOrders.filter((o: CurrentOrderType) => o.paymentStatus === 'paid').length;
  const avgOrderValue = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;

  // Calculate changes
  const revenueChange = prevRevenue > 0
    ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
    : currentRevenue > 0 ? 100 : 0;

  const ordersChange = prevOrderCount > 0
    ? ((currentOrderCount - prevOrderCount) / prevOrderCount) * 100
    : currentOrderCount > 0 ? 100 : 0;

  // Product stats
  const productsCount = await prisma.product.count({
    where: { siteId, status: 'active' },
  });

  const lowStockProducts = await prisma.product.count({
    where: {
      siteId,
      status: 'active',
      trackStock: true,
      stock: { lte: 5 }, // Using fixed threshold for simplicity
    },
  });

  // Customer stats (unique emails in orders)
  const uniqueCustomers = await prisma.order.groupBy({
    by: ['email'],
    where: { siteId, createdAt: { gte: start, lte: end } },
    _count: true,
  });

  return c.json({
    period,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    overview: {
      revenue: {
        value: Math.round(currentRevenue * 100) / 100,
        change: Math.round(revenueChange * 10) / 10,
        previous: Math.round(prevRevenue * 100) / 100,
      },
      orders: {
        value: currentOrderCount,
        change: Math.round(ordersChange * 10) / 10,
        previous: prevOrderCount,
        paid: paidOrders,
      },
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      customers: uniqueCustomers.length,
      products: {
        total: productsCount,
        lowStock: lowStockProducts,
      },
    },
  });
});

// ==========================================
// SALES CHART DATA
// ==========================================

// GET /sales - Sales by period for charts
stats.get('/sales', async (c) => {
  const siteId = c.get('siteId');
  const period = c.req.query('period') || 'month';
  const groupBy = c.req.query('groupBy') || 'day'; // day, week, month

  const { start, end } = getDateRange(period);

  const orders = await prisma.order.findMany({
    where: {
      siteId,
      createdAt: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    select: {
      total: true,
      createdAt: true,
      paymentStatus: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group orders by date
  type OrderData = { total: number | string | { toNumber?: () => number }; createdAt: Date; paymentStatus: string };
  const toNumber = (val: number | string | { toNumber?: () => number }): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (val?.toNumber) return val.toNumber();
    return 0;
  };

  const grouped = new Map<string, { revenue: number; orders: number; paid: number }>();

  orders.forEach((order: OrderData) => {
    let key: string;
    const date = new Date(order.createdAt);

    if (groupBy === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      // Get ISO week
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((date.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
      key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    } else {
      key = date.toISOString().split('T')[0];
    }

    if (!grouped.has(key)) {
      grouped.set(key, { revenue: 0, orders: 0, paid: 0 });
    }

    const data = grouped.get(key)!;
    data.revenue += toNumber(order.total);
    data.orders += 1;
    if (order.paymentStatus === 'paid') {
      data.paid += 1;
    }
  });

  // Convert to array
  const chartData = Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
      paid: data.paid,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({
    period,
    groupBy,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    data: chartData,
  });
});

// ==========================================
// TOP PRODUCTS
// ==========================================

// GET /products/top - Top selling products
stats.get('/products/top', async (c) => {
  const siteId = c.get('siteId');
  const period = c.req.query('period') || 'month';
  const limit = parseInt(c.req.query('limit') || '10');

  const { start, end } = getDateRange(period);

  // Get order items for the period
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        siteId,
        createdAt: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
    },
    select: {
      productId: true,
      quantity: true,
      total: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
        },
      },
    },
  });

  // Aggregate by product
  type OrderItemData = {
    productId: number;
    quantity: number;
    total: number | string | { toNumber?: () => number };
    product: { id: number; name: string; slug: string; sku: string | null };
  };
  const toNumber = (val: number | string | { toNumber?: () => number }): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (val?.toNumber) return val.toNumber();
    return 0;
  };

  const productStats = new Map<number, {
    id: number;
    name: string;
    slug: string;
    sku: string | null;
    quantity: number;
    revenue: number;
    orders: number;
  }>();

  orderItems.forEach((item: OrderItemData) => {
    if (!item.product) return;

    const key = item.productId;
    if (!productStats.has(key)) {
      productStats.set(key, {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        quantity: 0,
        revenue: 0,
        orders: 0,
      });
    }

    const stats = productStats.get(key)!;
    stats.quantity += item.quantity;
    stats.revenue += toNumber(item.total);
    stats.orders += 1;
  });

  // Sort by revenue and take top N
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map(p => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
    }));

  return c.json({
    period,
    products: topProducts,
  });
});

// ==========================================
// RECENT ORDERS
// ==========================================

// GET /orders/recent - Recent orders
stats.get('/orders/recent', async (c) => {
  const siteId = c.get('siteId');
  const limit = parseInt(c.req.query('limit') || '10');

  const orders = await prisma.order.findMany({
    where: { siteId },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      email: true,
      total: true,
      currencyCode: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  type RecentOrderType = typeof orders[number];
  return c.json({
    orders: orders.map((o: RecentOrderType) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.customerName || o.email,
      total: typeof o.total === 'object' && (o.total as { toNumber?: () => number })?.toNumber
        ? (o.total as { toNumber: () => number }).toNumber()
        : Number(o.total),
      currency: o.currencyCode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      itemsCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});

// ==========================================
// ORDER STATUS DISTRIBUTION
// ==========================================

// GET /orders/status - Order status distribution
stats.get('/orders/status', async (c) => {
  const siteId = c.get('siteId');
  const period = c.req.query('period') || 'month';

  const { start, end } = getDateRange(period);

  const statusGroups = await prisma.order.groupBy({
    by: ['status'],
    where: {
      siteId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
  });

  const paymentGroups = await prisma.order.groupBy({
    by: ['paymentStatus'],
    where: {
      siteId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
  });

  type StatusGroupType = typeof statusGroups[number];
  type PaymentGroupType = typeof paymentGroups[number];

  return c.json({
    period,
    orderStatus: statusGroups.map((g: StatusGroupType) => ({
      status: g.status,
      count: g._count,
    })),
    paymentStatus: paymentGroups.map((g: PaymentGroupType) => ({
      status: g.paymentStatus,
      count: g._count,
    })),
  });
});

export { stats };
