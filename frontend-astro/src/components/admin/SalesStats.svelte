<script lang="ts">
/**
 * SalesStats.svelte
 * Dashboard component with sales statistics and charts
 */
import { onMount, onDestroy } from 'svelte';
import { apiFetch } from '../../lib/api';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// State
let isLoading = $state(true);
let error = $state<string | null>(null);
let period = $state('month');

// Overview data
let overview = $state<{
  revenue: { value: number; change: number; previous: number };
  orders: { value: number; change: number; previous: number; paid: number };
  avgOrderValue: number;
  customers: number;
  products: { total: number; lowStock: number };
} | null>(null);

// Chart data
let salesData = $state<Array<{ date: string; revenue: number; orders: number }>>([]);
let topProducts = $state<Array<{ id: number; name: string; revenue: number; quantity: number }>>([]);
let recentOrders = $state<Array<{
  id: number;
  orderNumber: string;
  customer: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
}>>([]);
let statusDistribution = $state<Array<{ status: string; count: number }>>([]);

// Chart instances
let salesChart: Chart | null = null;
let statusChart: Chart | null = null;
let salesChartCanvas: HTMLCanvasElement;
let statusChartCanvas: HTMLCanvasElement;

// Load data
async function loadData() {
  isLoading = true;
  error = null;

  try {
    const [overviewRes, salesRes, productsRes, ordersRes, statusRes] = await Promise.all([
      apiFetch<{ overview: typeof overview }>(`/api/admin/stats/overview?period=${period}`),
      apiFetch<{ data: typeof salesData }>(`/api/admin/stats/sales?period=${period}`),
      apiFetch<{ products: typeof topProducts }>(`/api/admin/stats/products/top?period=${period}&limit=5`),
      apiFetch<{ orders: typeof recentOrders }>(`/api/admin/stats/orders/recent?limit=5`),
      apiFetch<{ orderStatus: typeof statusDistribution }>(`/api/admin/stats/orders/status?period=${period}`),
    ]);

    overview = overviewRes.overview;
    salesData = salesRes.data;
    topProducts = productsRes.products;
    recentOrders = ordersRes.orders;
    statusDistribution = statusRes.orderStatus;

    // Update charts
    updateCharts();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load statistics';
  } finally {
    isLoading = false;
  }
}

function updateCharts() {
  // Destroy existing charts
  if (salesChart) salesChart.destroy();
  if (statusChart) statusChart.destroy();

  // Sales chart
  if (salesChartCanvas && salesData.length > 0) {
    salesChart = new Chart(salesChartCanvas, {
      type: 'line',
      data: {
        labels: salesData.map(d => d.date),
        datasets: [
          {
            label: 'Выручка',
            data: salesData.map(d => d.revenue),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: 'Заказов',
            data: salesData.map(d => d.orders),
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            tension: 0.3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Выручка' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Заказов' },
            grid: { drawOnChartArea: false },
          },
        },
        plugins: {
          legend: { position: 'top' },
        },
      },
    });
  }

  // Status pie chart
  if (statusChartCanvas && statusDistribution.length > 0) {
    const statusColors: Record<string, string> = {
      pending: '#fbbf24',
      confirmed: '#3b82f6',
      processing: '#8b5cf6',
      shipped: '#06b6d4',
      delivered: '#10b981',
      cancelled: '#ef4444',
      refunded: '#f97316',
    };

    const statusLabels: Record<string, string> = {
      pending: 'Ожидает',
      confirmed: 'Подтверждён',
      processing: 'В обработке',
      shipped: 'Отправлен',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
      refunded: 'Возвращён',
    };

    statusChart = new Chart(statusChartCanvas, {
      type: 'doughnut',
      data: {
        labels: statusDistribution.map(s => statusLabels[s.status] || s.status),
        datasets: [{
          data: statusDistribution.map(s => s.count),
          backgroundColor: statusDistribution.map(s => statusColors[s.status] || '#9ca3af'),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
        },
      },
    });
  }
}

function handlePeriodChange() {
  loadData();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'badge-warning',
    confirmed: 'badge-info',
    processing: 'badge-purple',
    shipped: 'badge-cyan',
    delivered: 'badge-success',
    cancelled: 'badge-error',
    paid: 'badge-success',
    refunded: 'badge-warning',
  };
  return classes[status] || '';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Ожидает',
    confirmed: 'Подтверждён',
    processing: 'В обработке',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    cancelled: 'Отменён',
    paid: 'Оплачен',
    refunded: 'Возвращён',
  };
  return labels[status] || status;
}

onMount(() => {
  loadData();
});

onDestroy(() => {
  if (salesChart) salesChart.destroy();
  if (statusChart) statusChart.destroy();
});
</script>

<div class="sales-stats">
  <!-- Period selector -->
  <div class="header">
    <h2>Статистика продаж</h2>
    <div class="period-selector">
      <label>
        Период:
        <select bind:value={period} onchange={handlePeriodChange}>
          <option value="today">Сегодня</option>
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="quarter">Квартал</option>
          <option value="year">Год</option>
        </select>
      </label>
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {:else if isLoading}
    <div class="loading">Загрузка статистики...</div>
  {:else}
    <!-- Overview cards -->
    <div class="overview-cards">
      <div class="card">
        <div class="card-label">Выручка</div>
        <div class="card-value">{formatCurrency(overview?.revenue.value || 0)} ₽</div>
        <div class="card-change" class:positive={overview?.revenue.change && overview.revenue.change >= 0} class:negative={overview?.revenue.change && overview.revenue.change < 0}>
          {formatChange(overview?.revenue.change || 0)}
        </div>
      </div>

      <div class="card">
        <div class="card-label">Заказов</div>
        <div class="card-value">{overview?.orders.value || 0}</div>
        <div class="card-change" class:positive={overview?.orders.change && overview.orders.change >= 0} class:negative={overview?.orders.change && overview.orders.change < 0}>
          {formatChange(overview?.orders.change || 0)}
        </div>
        <div class="card-sub">Оплачено: {overview?.orders.paid || 0}</div>
      </div>

      <div class="card">
        <div class="card-label">Средний чек</div>
        <div class="card-value">{formatCurrency(overview?.avgOrderValue || 0)} ₽</div>
      </div>

      <div class="card">
        <div class="card-label">Покупателей</div>
        <div class="card-value">{overview?.customers || 0}</div>
      </div>

      <div class="card">
        <div class="card-label">Товаров</div>
        <div class="card-value">{overview?.products.total || 0}</div>
        {#if overview?.products.lowStock && overview.products.lowStock > 0}
          <div class="card-sub warning">Низкий остаток: {overview.products.lowStock}</div>
        {/if}
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row">
      <div class="chart-container sales-chart">
        <h3>Динамика продаж</h3>
        <div class="chart-wrapper">
          <canvas bind:this={salesChartCanvas}></canvas>
        </div>
      </div>

      <div class="chart-container status-chart">
        <h3>Статусы заказов</h3>
        <div class="chart-wrapper">
          <canvas bind:this={statusChartCanvas}></canvas>
        </div>
      </div>
    </div>

    <!-- Bottom row -->
    <div class="bottom-row">
      <!-- Top products -->
      <div class="panel">
        <h3>Топ товаров</h3>
        {#if topProducts.length === 0}
          <div class="empty">Нет данных за выбранный период</div>
        {:else}
          <table class="simple-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th style="text-align: right;">Продано</th>
                <th style="text-align: right;">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {#each topProducts as product}
                <tr>
                  <td>{product.name}</td>
                  <td style="text-align: right;">{product.quantity}</td>
                  <td style="text-align: right;">{formatCurrency(product.revenue)} ₽</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <!-- Recent orders -->
      <div class="panel">
        <h3>Последние заказы</h3>
        {#if recentOrders.length === 0}
          <div class="empty">Заказов пока нет</div>
        {:else}
          <table class="simple-table">
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Покупатель</th>
                <th style="text-align: right;">Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {#each recentOrders as order}
                <tr>
                  <td>
                    <a href="/admin/orders/{order.id}">{order.orderNumber}</a>
                  </td>
                  <td>{order.customer}</td>
                  <td style="text-align: right;">{formatCurrency(order.total)} {order.currency}</td>
                  <td>
                    <span class="badge {getStatusBadgeClass(order.status)}">
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .sales-stats {
    padding: 1.5rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .period-selector select {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--bg-color, #fff);
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
  }

  .error {
    color: #b91c1c;
    background: #fee2e2;
    border-radius: 8px;
  }

  /* Overview cards */
  .overview-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .card {
    background: white;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
  }

  .card-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-value {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0.25rem 0;
  }

  .card-change {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .card-change.positive {
    color: #16a34a;
  }

  .card-change.negative {
    color: #dc2626;
  }

  .card-sub {
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
    margin-top: 0.25rem;
  }

  .card-sub.warning {
    color: #d97706;
  }

  /* Charts */
  .charts-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 1024px) {
    .charts-row {
      grid-template-columns: 1fr;
    }
  }

  .chart-container {
    background: white;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
  }

  .chart-container h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }

  .chart-wrapper {
    height: 300px;
  }

  /* Bottom row */
  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .bottom-row {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    background: white;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
  }

  .panel h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }

  .empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary, #666);
  }

  /* Tables */
  .simple-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .simple-table th,
  .simple-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .simple-table th {
    font-weight: 600;
    color: var(--text-secondary, #666);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .simple-table a {
    color: var(--primary-color, #3b82f6);
    text-decoration: none;
  }

  .simple-table a:hover {
    text-decoration: underline;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-success {
    background: #dcfce7;
    color: #166534;
  }

  .badge-warning {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-error {
    background: #fee2e2;
    color: #b91c1c;
  }

  .badge-info {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge-purple {
    background: #f3e8ff;
    color: #7c3aed;
  }

  .badge-cyan {
    background: #cffafe;
    color: #0e7490;
  }
</style>
