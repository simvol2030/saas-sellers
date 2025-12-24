<script lang="ts">
  /**
   * Orders List Component
   *
   * Admin view of all orders with search, filter, pagination
   */

  import { onMount } from 'svelte';

  interface Order {
    id: number;
    orderNumber: string;
    email: string;
    customerName?: string | null;
    status: string;
    currencyCode: string;
    total: number;
    itemsCount: number;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    createdAt: string;
  }

  interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  // State
  let orders = $state<Order[]>([]);
  let pagination = $state<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let search = $state('');
  let statusFilter = $state('');
  let searchTimeout: number;

  // Status options
  const statusOptions = [
    { value: '', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидает оплаты' },
    { value: 'paid', label: 'Оплачен' },
    { value: 'processing', label: 'Обрабатывается' },
    { value: 'shipped', label: 'Отправлен' },
    { value: 'delivered', label: 'Доставлен' },
    { value: 'cancelled', label: 'Отменён' },
    { value: 'refunded', label: 'Возврат' },
  ];

  // Status colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' },
    paid: { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
    processing: { bg: 'var(--color-info-light)', text: 'var(--color-info)' },
    shipped: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
    delivered: { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
    cancelled: { bg: 'var(--color-error-light)', text: 'var(--color-error)' },
    refunded: { bg: 'var(--color-text-muted)', text: 'var(--color-text)' },
  };

  // API helper
  async function api(url: string, options?: RequestInit) {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    return res;
  }

  // Load orders
  async function loadOrders() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (search) {
        params.set('search', search);
      }

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const res = await api(`/api/admin/orders?${params}`);

      if (res.ok) {
        const data = await res.json();
        orders = data.orders;
        pagination = data.pagination;
      } else {
        error = 'Не удалось загрузить заказы';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
    } finally {
      loading = false;
    }
  }

  // Handle search
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      pagination.page = 1;
      loadOrders();
    }, 300);
  }

  // Handle filter change
  function handleFilterChange() {
    pagination.page = 1;
    loadOrders();
  }

  // Handle pagination
  function goToPage(page: number) {
    if (page < 1 || page > pagination.totalPages) return;
    pagination.page = page;
    loadOrders();
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Format price
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU').format(price);
  }

  // Get status label
  function getStatusLabel(status: string): string {
    return statusOptions.find((s) => s.value === status)?.label || status;
  }

  // Initialize
  onMount(() => {
    loadOrders();
  });
</script>

<div class="orders-list">
  <!-- Header -->
  <div class="page-header">
    <h1>Заказы</h1>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <input
        type="text"
        placeholder="Поиск по номеру, email..."
        bind:value={search}
        oninput={handleSearch}
      />
    </div>

    <select bind:value={statusFilter} onchange={handleFilterChange}>
      {#each statusOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка заказов...</span>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button onclick={loadOrders} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if orders.length === 0}
    <div class="empty">
      <div class="empty-icon">📦</div>
      <h3>Заказов пока нет</h3>
      <p>Заказы появятся здесь после оформления</p>
    </div>
  {:else}
    <!-- Table -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Номер заказа</th>
            <th>Клиент</th>
            <th>Статус</th>
            <th>Товаров</th>
            <th>Сумма</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order (order.id)}
            <tr>
              <td>
                <a href={`/admin/orders/${order.id}`} class="order-number">
                  {order.orderNumber}
                </a>
              </td>
              <td>
                <div class="customer-info">
                  <span class="customer-name">{order.customerName || '—'}</span>
                  <span class="customer-email">{order.email}</span>
                </div>
              </td>
              <td>
                <span
                  class="status-badge"
                  style:background={statusColors[order.status]?.bg}
                  style:color={statusColors[order.status]?.text}
                >
                  {getStatusLabel(order.status)}
                </span>
              </td>
              <td>{order.itemsCount}</td>
              <td>
                <strong>{formatPrice(order.total)} {order.currencyCode === 'RUB' ? '₽' : order.currencyCode}</strong>
              </td>
              <td>{formatDate(order.createdAt)}</td>
              <td>
                <a href={`/admin/orders/${order.id}`} class="btn btn-sm">Открыть</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if pagination.totalPages > 1}
      <div class="pagination">
        <button
          onclick={() => goToPage(pagination.page - 1)}
          disabled={pagination.page === 1}
          class="page-btn"
        >
          ← Назад
        </button>

        <span class="page-info">
          Страница {pagination.page} из {pagination.totalPages}
        </span>

        <button
          onclick={() => goToPage(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          class="page-btn"
        >
          Вперёд →
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .orders-list {
    padding: var(--spacing-6);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);
  }

  .page-header h1 {
    margin: 0;
    font-size: var(--font-font-size-2xl);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 200px;
  }

  .search-box input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .toolbar select {
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    text-align: left;
    padding: var(--spacing-4);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
  }

  .data-table td {
    padding: var(--spacing-4);
    font-size: var(--font-font-size-sm);
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
  }

  .data-table tbody tr:hover {
    background: var(--color-background-secondary);
  }

  .order-number {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: var(--font-font-weight-medium);
  }

  .order-number:hover {
    text-decoration: underline;
  }

  .customer-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .customer-name {
    font-weight: var(--font-font-weight-medium);
  }

  .customer-email {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .status-badge {
    display: inline-flex;
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    cursor: pointer;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn-sm {
    padding: var(--spacing-1) var(--spacing-3);
    font-size: var(--font-font-size-xs);
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-sm:hover {
    background: var(--color-background);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-4);
    margin-top: var(--spacing-6);
  }

  .page-btn {
    padding: var(--spacing-2) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .page-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  /* Loading, error, empty */
  .loading,
  .error,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-4);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .empty h3 {
    margin: 0 0 var(--spacing-2);
  }

  .empty p {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
