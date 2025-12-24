<script lang="ts">
  /**
   * Products List Component
   *
   * Interactive table for managing e-commerce products
   * Features: pagination, search, filters, bulk actions, categories
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Category {
    id: number;
    name: string;
    slug: string;
    level: number;
    parentId: number | null;
  }

  interface ProductImage {
    id: number;
    url: string;
    alt: string | null;
    position: number;
  }

  interface Product {
    id: number;
    name: string;
    slug: string;
    sku: string | null;
    description: string | null;
    shortDescription: string | null;
    prices: Record<string, number>;
    compareAtPrices: Record<string, number> | null;
    costPrice: number | null;
    productType: string;
    status: 'draft' | 'active' | 'archived';
    visibility: 'visible' | 'hidden' | 'catalog' | 'search';
    stock: number;
    lowStockThreshold: number;
    manageStock: boolean;
    weight: number | null;
    dimensions: Record<string, unknown> | null;
    seoTitle: string | null;
    seoDescription: string | null;
    featured: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
    category: Category | null;
    images: ProductImage[];
    _count?: {
      variants: number;
    };
  }

  interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  let products: Product[] = $state([]);
  let categories: Category[] = $state([]);
  let pagination: Pagination = $state({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  let search = $state('');
  let statusFilter = $state<'all' | 'draft' | 'active' | 'archived'>('all');
  let categoryFilter = $state<string>('');
  let productTypeFilter = $state<string>('');
  let searchTimeout: number;

  // Product types for filter
  const productTypes = [
    { value: 'general', label: 'Общий' },
    { value: 'clothing', label: 'Одежда' },
    { value: 'food', label: 'Еда' },
    { value: 'cafe', label: 'Кафе' },
    { value: 'pet', label: 'Зоотовары' },
    { value: 'household', label: 'Бытовые товары' },
  ];

  // Default currency for price display
  let defaultCurrency = $state<string>('RUB');

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load categories
  async function loadCategories() {
    try {
      const data = await apiFetch<{ categories: Category[] }>('/api/admin/categories');
      categories = data.categories || [];
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  // Load default currency
  async function loadDefaultCurrency() {
    try {
      const data = await apiFetch<Array<{ code: string; isDefault: boolean }>>('/api/currencies/public');
      const defaultCurr = data.find(c => c.isDefault);
      if (defaultCurr) {
        defaultCurrency = defaultCurr.code;
      }
    } catch (e) {
      console.error('Failed to load currencies:', e);
    }
  }

  // Load products
  async function loadProducts() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      if (search) {
        params.set('search', search);
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (categoryFilter) {
        params.set('categoryId', categoryFilter);
      }

      if (productTypeFilter) {
        params.set('productType', productTypeFilter);
      }

      const data = await apiFetch<{ products: Product[]; pagination: Pagination }>(
        `/api/admin/products?${params}`
      );

      products = data.products;
      pagination = data.pagination;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки товаров';
    } finally {
      loading = false;
    }
  }

  // Debounced search
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      pagination.page = 1;
      loadProducts();
    }, 300);
  }

  // Filter change handlers
  function handleFilterChange() {
    pagination.page = 1;
    loadProducts();
  }

  // Pagination
  function goToPage(page: number) {
    if (page < 1 || page > pagination.totalPages) return;
    pagination.page = page;
    loadProducts();
  }

  // Actions
  async function toggleFeatured(id: number, featured: boolean) {
    try {
      await apiFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ featured: !featured }),
      });
      showNotification('success', featured ? 'Товар снят с избранного' : 'Товар добавлен в избранное');
      loadProducts();
    } catch (e) {
      console.error('Toggle featured error:', e);
      showNotification('error', 'Не удалось обновить товар');
    }
  }

  async function updateStatus(id: number, status: 'draft' | 'active' | 'archived') {
    try {
      await apiFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const statusLabels: Record<string, string> = {
        draft: 'Черновик',
        active: 'Активный',
        archived: 'Архивирован',
      };
      showNotification('success', `Статус изменён на "${statusLabels[status]}"`);
      loadProducts();
    } catch (e) {
      console.error('Update status error:', e);
      showNotification('error', 'Не удалось обновить статус');
    }
  }

  async function deleteProduct(id: number, name: string) {
    if (!confirm(`Удалить товар "${name}"?`)) return;

    try {
      await apiFetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Товар удалён');
      loadProducts();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить товар');
    }
  }

  async function duplicateProduct(id: number) {
    try {
      await apiFetch(`/api/admin/products/${id}/duplicate`, {
        method: 'POST',
      });
      showNotification('success', 'Товар скопирован');
      loadProducts();
    } catch (e) {
      console.error('Duplicate error:', e);
      showNotification('error', 'Не удалось скопировать товар');
    }
  }

  // Format price
  function formatPrice(prices: Record<string, number>): string {
    const price = prices[defaultCurrency];
    if (typeof price === 'number') {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: defaultCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(price);
    }
    // Fallback to first available price
    const firstPrice = Object.entries(prices)[0];
    if (firstPrice) {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: firstPrice[0],
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(firstPrice[1]);
    }
    return '—';
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Get status label and style
  function getStatusInfo(status: string): { label: string; emoji: string; class: string } {
    switch (status) {
      case 'active':
        return { label: 'Активный', emoji: '✅', class: 'status-active' };
      case 'draft':
        return { label: 'Черновик', emoji: '📝', class: 'status-draft' };
      case 'archived':
        return { label: 'Архив', emoji: '📦', class: 'status-archived' };
      default:
        return { label: status, emoji: '❓', class: '' };
    }
  }

  // Initial load
  onMount(() => {
    loadProducts();
    loadCategories();
    loadDefaultCurrency();
  });
</script>

<div class="products-list">
  <!-- Notification -->
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button
        type="button"
        class="notification-close"
        onclick={() => notification = null}
      >
        ×
      </button>
    </div>
  {/if}

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <input
        type="text"
        placeholder="Поиск по названию, SKU..."
        bind:value={search}
        oninput={handleSearch}
        class="search-input"
      />
    </div>

    <div class="filters">
      <select bind:value={statusFilter} onchange={handleFilterChange} class="filter-select">
        <option value="all">Все статусы</option>
        <option value="draft">Черновики</option>
        <option value="active">Активные</option>
        <option value="archived">Архивные</option>
      </select>

      {#if categories.length > 0}
        <select bind:value={categoryFilter} onchange={handleFilterChange} class="filter-select">
          <option value="">Все категории</option>
          {#each categories as cat (cat.id)}
            <option value={String(cat.id)}>
              {'—'.repeat(cat.level)} {cat.name}
            </option>
          {/each}
        </select>
      {/if}

      <select bind:value={productTypeFilter} onchange={handleFilterChange} class="filter-select">
        <option value="">Все типы</option>
        {#each productTypes as pt}
          <option value={pt.value}>{pt.label}</option>
        {/each}
      </select>
    </div>

    <div class="toolbar-actions">
      <a href="/admin/products/import" class="btn btn-secondary">
        📥 Импорт/Экспорт
      </a>
      <a href="/admin/products/new" class="btn btn-primary">
        ➕ Добавить товар
      </a>
    </div>
  </div>

  <!-- Table -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>❌ {error}</p>
      <button onclick={loadProducts} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if products.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🛍️</div>
      <h3>Товары не найдены</h3>
      <p>Создайте первый товар для вашего магазина</p>
      <a href="/admin/products/new" class="btn btn-primary">Добавить товар</a>
    </div>
  {:else}
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th class="th-image">Фото</th>
            <th>Название</th>
            <th>SKU</th>
            <th>Цена</th>
            <th>Остаток</th>
            <th>Категория</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each products as product (product.id)}
            {@const statusInfo = getStatusInfo(product.status)}
            <tr>
              <td class="image-cell">
                {#if product.images && product.images.length > 0}
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt || product.name}
                    class="product-thumb"
                  />
                {:else}
                  <div class="no-image">📷</div>
                {/if}
              </td>
              <td class="title-cell">
                <a href={`/admin/products/${product.id}`} class="product-title">
                  {product.name}
                </a>
                {#if product.featured}
                  <span class="featured-badge" title="Рекомендуемый">⭐</span>
                {/if}
                {#if product._count?.variants && product._count.variants > 0}
                  <span class="variants-count">
                    {product._count.variants} вариантов
                  </span>
                {/if}
              </td>
              <td class="sku-cell">
                {#if product.sku}
                  <code>{product.sku}</code>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="price-cell">
                {formatPrice(product.prices)}
                {#if product.compareAtPrices}
                  {@const comparePrice = formatPrice(product.compareAtPrices)}
                  {#if comparePrice !== '—'}
                    <span class="compare-price">{comparePrice}</span>
                  {/if}
                {/if}
              </td>
              <td class="stock-cell">
                {#if product.manageStock}
                  <span class={product.stock <= product.lowStockThreshold ? 'low-stock' : ''}>
                    {product.stock}
                  </span>
                {:else}
                  <span class="muted">∞</span>
                {/if}
              </td>
              <td class="category-cell">
                {#if product.category}
                  <span class="category-badge">{product.category.name}</span>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td>
                <span class={`status-badge ${statusInfo.class}`}>
                  {statusInfo.emoji} {statusInfo.label}
                </span>
              </td>
              <td class="date-cell">
                {formatDate(product.updatedAt)}
              </td>
              <td class="actions-cell">
                <div class="actions-menu">
                  <a href={`/admin/products/${product.id}`} class="action-btn" title="Редактировать">
                    ✏️
                  </a>
                  <button
                    onclick={() => toggleFeatured(product.id, product.featured)}
                    class="action-btn"
                    title={product.featured ? 'Убрать из избранного' : 'Добавить в избранное'}
                  >
                    {product.featured ? '⭐' : '☆'}
                  </button>
                  <div class="status-dropdown">
                    <button class="action-btn" title="Изменить статус">
                      📋
                    </button>
                    <div class="dropdown-menu">
                      <button onclick={() => updateStatus(product.id, 'draft')}>📝 Черновик</button>
                      <button onclick={() => updateStatus(product.id, 'active')}>✅ Активный</button>
                      <button onclick={() => updateStatus(product.id, 'archived')}>📦 Архив</button>
                    </div>
                  </div>
                  <button
                    onclick={() => duplicateProduct(product.id)}
                    class="action-btn"
                    title="Дублировать"
                  >
                    📋
                  </button>
                  <button
                    onclick={() => deleteProduct(product.id, product.name)}
                    class="action-btn action-delete"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
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
          ({pagination.total} товаров)
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
  .products-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .search-box {
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .filter-select {
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
  }

  .toolbar-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-background-tertiary);
  }

  /* Loading & Error */
  .loading,
  .error-message,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .empty-state h3 {
    margin: 0 0 var(--spacing-2);
    color: var(--color-text);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4);
    color: var(--color-text-muted);
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .products-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-font-size-sm);
  }

  .products-table th,
  .products-table td {
    padding: var(--spacing-3) var(--spacing-4);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .products-table th {
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-muted);
    background: var(--color-background-secondary);
    white-space: nowrap;
  }

  .products-table tr:last-child td {
    border-bottom: none;
  }

  .products-table tr:hover {
    background: var(--color-background-secondary);
  }

  .th-image {
    width: 60px;
  }

  /* Image cell */
  .image-cell {
    width: 60px;
  }

  .product-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .no-image {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
    font-size: 1.5rem;
  }

  /* Title cell */
  .title-cell {
    min-width: 200px;
  }

  .product-title {
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
    text-decoration: none;
  }

  .product-title:hover {
    color: var(--color-primary);
  }

  .featured-badge {
    margin-left: var(--spacing-1);
  }

  .variants-count {
    display: block;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-1);
  }

  /* SKU cell */
  .sku-cell code {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-background-secondary);
    border-radius: var(--radius-sm);
    font-family: var(--font-font-family-mono);
    font-size: var(--font-font-size-xs);
  }

  /* Price cell */
  .price-cell {
    white-space: nowrap;
    font-weight: var(--font-font-weight-medium);
  }

  .compare-price {
    display: block;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    text-decoration: line-through;
  }

  /* Stock cell */
  .stock-cell {
    font-weight: var(--font-font-weight-medium);
  }

  .low-stock {
    color: var(--color-error);
  }

  /* Category cell */
  .category-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    background: var(--color-background-secondary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  /* Status badge */
  .status-badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
    white-space: nowrap;
  }

  .status-active {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .status-draft {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .status-archived {
    background: var(--color-background-secondary);
    color: var(--color-text-muted);
  }

  /* Date cell */
  .date-cell {
    white-space: nowrap;
    color: var(--color-text-muted);
  }

  /* Muted text */
  .muted {
    color: var(--color-text-muted);
  }

  /* Actions */
  .actions-cell {
    white-space: nowrap;
  }

  .actions-menu {
    display: flex;
    gap: var(--spacing-1);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1rem;
    transition: background var(--transition-fast);
    text-decoration: none;
  }

  .action-btn:hover {
    background: var(--color-background-secondary);
  }

  .action-delete:hover {
    background: var(--color-error-light);
  }

  /* Status dropdown */
  .status-dropdown {
    position: relative;
  }

  .dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 10;
    min-width: 140px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }

  .status-dropdown:hover .dropdown-menu {
    display: block;
  }

  .dropdown-menu button {
    display: block;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: var(--font-font-size-sm);
    color: var(--color-text);
  }

  .dropdown-menu button:hover {
    background: var(--color-background-secondary);
  }

  .dropdown-menu button:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .dropdown-menu button:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
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
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  /* Notification */
  .notification {
    position: fixed;
    top: var(--spacing-4);
    right: var(--spacing-4);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-5);
    border-radius: var(--radius-lg);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    box-shadow: var(--shadow-xl);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .notification-success {
    background: var(--color-success);
    color: white;
  }

  .notification-error {
    background: var(--color-error);
    color: white;
  }

  .notification-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 1.5rem;
    line-height: 1;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
