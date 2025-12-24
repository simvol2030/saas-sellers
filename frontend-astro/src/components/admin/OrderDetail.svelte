<script lang="ts">
  /**
   * Order Detail Component
   *
   * Admin view of single order with status management
   */

  import { onMount } from 'svelte';

  interface Props {
    orderId: number;
  }

  let { orderId }: Props = $props();

  interface OrderItem {
    id: number;
    productId: number;
    variantId?: number | null;
    product: { id: number; name: string; slug: string };
    variant?: { id: number; name: string } | null;
    name: string;
    sku?: string | null;
    price: number;
    quantity: number;
    total: number;
  }

  interface StatusHistoryItem {
    id: number;
    status: string;
    note?: string | null;
    createdBy?: number | null;
    createdAt: string;
  }

  interface Order {
    id: number;
    orderNumber: string;
    userId?: number | null;
    email: string;
    phone?: string | null;
    customerName?: string | null;
    status: string;
    currencyCode: string;
    currencyRate: number;
    subtotal: number;
    discount: number;
    tax: number;
    shippingCost: number;
    total: number;
    shippingMethod?: string | null;
    shippingAddress: {
      city: string;
      address: string;
      postalCode?: string;
      note?: string;
    };
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    paymentId?: string | null;
    items: OrderItem[];
    statusHistory: StatusHistoryItem[];
    emailSent: boolean;
    telegramSent: boolean;
    paidAt?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    cancelledAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }

  // State
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updating = $state(false);

  // Status update form
  let newStatus = $state('');
  let statusNote = $state('');
  let showStatusModal = $state(false);

  // Status options
  const statusOptions = [
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

  // Currency symbols
  const currencySymbols: Record<string, string> = {
    RUB: '₽',
    USD: '$',
    EUR: '€',
    CNY: '¥',
    KZT: '₸',
    PLN: 'zł',
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

  // Load order
  async function loadOrder() {
    loading = true;
    error = null;

    try {
      const res = await api(`/api/admin/orders/${orderId}`);

      if (res.ok) {
        const data = await res.json();
        order = data.order;
        newStatus = order?.status || '';
      } else if (res.status === 404) {
        error = 'Заказ не найден';
      } else {
        error = 'Не удалось загрузить заказ';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
    } finally {
      loading = false;
    }
  }

  // Update status
  async function updateStatus() {
    if (!newStatus || newStatus === order?.status) {
      showStatusModal = false;
      return;
    }

    updating = true;

    try {
      const res = await api(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          note: statusNote || undefined,
        }),
      });

      if (res.ok) {
        await loadOrder();
        showStatusModal = false;
        statusNote = '';
      } else {
        const data = await res.json();
        alert(data.error || 'Не удалось обновить статус');
      }
    } catch (e) {
      alert('Ошибка обновления статуса');
    } finally {
      updating = false;
    }
  }

  // Delete order
  async function deleteOrder() {
    if (!confirm('Удалить заказ? Это действие нельзя отменить.')) {
      return;
    }

    updating = true;

    try {
      const res = await api(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        window.location.href = '/admin/orders';
      } else {
        const data = await res.json();
        alert(data.error || 'Не удалось удалить заказ');
      }
    } catch (e) {
      alert('Ошибка удаления заказа');
    } finally {
      updating = false;
    }
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

  // Get currency symbol
  function getCurrencySymbol(code: string): string {
    return currencySymbols[code] || code;
  }

  // Initialize
  onMount(() => {
    loadOrder();
  });
</script>

<div class="order-detail">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка заказа...</span>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <a href="/admin/orders" class="btn btn-primary">Вернуться к списку</a>
    </div>
  {:else if order}
    <!-- Header -->
    <div class="page-header">
      <div class="header-info">
        <a href="/admin/orders" class="back-link">← Назад к списку</a>
        <h1>Заказ {order.orderNumber}</h1>
        <span class="order-date">от {formatDate(order.createdAt)}</span>
      </div>
      <div class="header-actions">
        <span
          class="status-badge"
          style:background={statusColors[order.status]?.bg}
          style:color={statusColors[order.status]?.text}
        >
          {getStatusLabel(order.status)}
        </span>
        <button class="btn btn-primary" onclick={() => showStatusModal = true}>
          Изменить статус
        </button>
        {#if ['pending', 'cancelled'].includes(order.status)}
          <button class="btn btn-danger" onclick={deleteOrder} disabled={updating}>
            Удалить
          </button>
        {/if}
      </div>
    </div>

    <div class="order-layout">
      <!-- Main info -->
      <div class="order-main">
        <!-- Items -->
        <div class="card">
          <h2>Товары ({order.items.length})</h2>
          <div class="items-list">
            {#each order.items as item (item.id)}
              <div class="order-item">
                <div class="item-info">
                  <a href={`/products/${item.product.slug}`} target="_blank" class="item-name">
                    {item.name}
                  </a>
                  {#if item.sku}
                    <span class="item-sku">Артикул: {item.sku}</span>
                  {/if}
                </div>
                <div class="item-qty">{item.quantity} шт.</div>
                <div class="item-price">{formatPrice(item.price)} {getCurrencySymbol(order.currencyCode)}</div>
                <div class="item-total">{formatPrice(item.total)} {getCurrencySymbol(order.currencyCode)}</div>
              </div>
            {/each}
          </div>

          <!-- Totals -->
          <div class="order-totals">
            <div class="total-row">
              <span>Подытог:</span>
              <span>{formatPrice(order.subtotal)} {getCurrencySymbol(order.currencyCode)}</span>
            </div>
            {#if order.discount > 0}
              <div class="total-row discount">
                <span>Скидка:</span>
                <span>−{formatPrice(order.discount)} {getCurrencySymbol(order.currencyCode)}</span>
              </div>
            {/if}
            <div class="total-row">
              <span>Доставка ({order.shippingMethod || '—'}):</span>
              <span>{formatPrice(order.shippingCost)} {getCurrencySymbol(order.currencyCode)}</span>
            </div>
            <div class="total-row grand">
              <span>Итого:</span>
              <span>{formatPrice(order.total)} {getCurrencySymbol(order.currencyCode)}</span>
            </div>
          </div>
        </div>

        <!-- Status history -->
        <div class="card">
          <h2>История статусов</h2>
          <div class="history-list">
            {#each order.statusHistory as entry (entry.id)}
              <div class="history-item">
                <span
                  class="status-badge small"
                  style:background={statusColors[entry.status]?.bg}
                  style:color={statusColors[entry.status]?.text}
                >
                  {getStatusLabel(entry.status)}
                </span>
                <span class="history-date">{formatDate(entry.createdAt)}</span>
                {#if entry.note}
                  <span class="history-note">{entry.note}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="order-sidebar">
        <!-- Customer -->
        <div class="card">
          <h3>Клиент</h3>
          <div class="info-block">
            <p><strong>{order.customerName || '—'}</strong></p>
            <p>{order.email}</p>
            {#if order.phone}
              <p>{order.phone}</p>
            {/if}
          </div>
        </div>

        <!-- Shipping -->
        <div class="card">
          <h3>Доставка</h3>
          <div class="info-block">
            <p><strong>{order.shippingMethod || '—'}</strong></p>
            <p>{order.shippingAddress.city}{order.shippingAddress.postalCode ? `, ${order.shippingAddress.postalCode}` : ''}</p>
            <p>{order.shippingAddress.address}</p>
            {#if order.shippingAddress.note}
              <p class="muted">{order.shippingAddress.note}</p>
            {/if}
          </div>
        </div>

        <!-- Payment -->
        <div class="card">
          <h3>Оплата</h3>
          <div class="info-block">
            <p><strong>{order.paymentMethod || 'Не указан'}</strong></p>
            <p>Статус: {order.paymentStatus || 'pending'}</p>
            {#if order.paymentId}
              <p class="muted">ID: {order.paymentId}</p>
            {/if}
            {#if order.paidAt}
              <p class="success">Оплачено: {formatDate(order.paidAt)}</p>
            {/if}
          </div>
        </div>

        <!-- Notifications -->
        <div class="card">
          <h3>Уведомления</h3>
          <div class="info-block">
            <p>
              Email:
              <span class:sent={order.emailSent} class:not-sent={!order.emailSent}>
                {order.emailSent ? 'Отправлено' : 'Не отправлено'}
              </span>
            </p>
            <p>
              Telegram:
              <span class:sent={order.telegramSent} class:not-sent={!order.telegramSent}>
                {order.telegramSent ? 'Отправлено' : 'Не отправлено'}
              </span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  {/if}
</div>

<!-- Status Modal -->
{#if showStatusModal}
  <div class="modal-overlay" onclick={() => showStatusModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2>Изменить статус заказа</h2>

      <div class="form-group">
        <label for="newStatus">Новый статус</label>
        <select id="newStatus" bind:value={newStatus}>
          {#each statusOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="statusNote">Комментарий</label>
        <textarea
          id="statusNote"
          bind:value={statusNote}
          placeholder="Необязательный комментарий..."
          rows="3"
        ></textarea>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={() => showStatusModal = false}>
          Отмена
        </button>
        <button class="btn btn-primary" onclick={updateStatus} disabled={updating}>
          {updating ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .order-detail {
    padding: var(--spacing-6);
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Header */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-6);
    flex-wrap: wrap;
    gap: var(--spacing-4);
  }

  .back-link {
    display: block;
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-font-size-sm);
    margin-bottom: var(--spacing-2);
  }

  .back-link:hover {
    color: var(--color-primary);
  }

  .page-header h1 {
    margin: 0;
    font-size: var(--font-font-size-2xl);
  }

  .order-date {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  /* Layout */
  .order-layout {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: var(--spacing-6);
  }

  @media (max-width: 1024px) {
    .order-layout {
      grid-template-columns: 1fr;
    }
  }

  /* Cards */
  .card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    margin-bottom: var(--spacing-4);
  }

  .card h2 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .card h3 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-font-size-md);
  }

  /* Items */
  .items-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .order-item {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: var(--spacing-4);
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
    align-items: center;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-name {
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--font-font-weight-medium);
  }

  .item-name:hover {
    color: var(--color-primary);
  }

  .item-sku {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .item-qty,
  .item-price {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .item-total {
    font-weight: var(--font-font-weight-semibold);
  }

  /* Totals */
  .order-totals {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-2) 0;
  }

  .total-row.discount {
    color: var(--color-success);
  }

  .total-row.grand {
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-bold);
    padding-top: var(--spacing-3);
    margin-top: var(--spacing-2);
    border-top: 1px solid var(--color-border);
  }

  /* History */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .history-date {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .history-note {
    flex: 1 0 100%;
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    font-style: italic;
    margin-left: var(--spacing-2);
  }

  /* Info blocks */
  .info-block p {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-font-size-sm);
  }

  .info-block p:last-child {
    margin-bottom: 0;
  }

  .muted {
    color: var(--color-text-muted);
  }

  .success {
    color: var(--color-success);
  }

  .sent {
    color: var(--color-success);
  }

  .not-sent {
    color: var(--color-text-muted);
  }

  /* Status badge */
  .status-badge {
    display: inline-flex;
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .status-badge.small {
    padding: var(--spacing-1) var(--spacing-3);
    font-size: var(--font-font-size-xs);
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-danger {
    background: var(--color-error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 1000);
  }

  .modal {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    width: 100%;
    max-width: 400px;
    margin: var(--spacing-4);
  }

  .modal h2 {
    margin: 0 0 var(--spacing-6);
    font-size: var(--font-font-size-lg);
  }

  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-md);
  }

  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .modal-actions {
    display: flex;
    gap: var(--spacing-3);
    justify-content: flex-end;
    margin-top: var(--spacing-6);
  }

  /* Loading, error */
  .loading,
  .error {
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
</style>
