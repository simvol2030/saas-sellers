<script lang="ts">
  /**
   * Catalog Page Component
   *
   * Full catalog with categories sidebar, products grid, search, pagination
   */

  import { onMount } from 'svelte';
  import ProductCard from './ProductCard.svelte';
  import CurrencySelector from './CurrencySelector.svelte';

  interface Props {
    /** Initial category slug (from URL) */
    initialCategory?: string;
  }

  let { initialCategory = '' }: Props = $props();

  interface Category {
    id: number;
    name: string;
    slug: string;
    productsCount: number;
    children?: Category[];
  }

  interface Product {
    id: number;
    name: string;
    slug: string;
    shortDesc?: string | null;
    prices: Record<string, number>;
    comparePrice?: number | null;
    category?: { name: string; slug: string } | null;
    image?: string | null;
  }

  interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  // State
  let categories: Category[] = $state([]);
  let categoryTree: Category[] = $state([]);
  let products: Product[] = $state([]);
  let featuredProducts: Product[] = $state([]);
  let pagination: Pagination = $state({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let search = $state('');
  let selectedCategory = $state<string>('');
  let sortBy = $state<string>('position');
  let searchTimeout: number;

  // Currency
  let currency = $state('RUB');
  let currencySymbol = $state('₽');

  // Sort options
  const sortOptions = [
    { value: 'position', label: 'По умолчанию' },
    { value: 'name', label: 'По названию' },
    { value: 'price_asc', label: 'Сначала дешёвые' },
    { value: 'price_desc', label: 'Сначала дорогие' },
    { value: 'newest', label: 'Новинки' },
  ];

  // Load categories
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories/public');
      if (res.ok) {
        const data = await res.json();
        categories = data.categories || [];
        categoryTree = data.tree || [];
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
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
      });

      if (search) {
        params.set('search', search);
      }

      if (selectedCategory) {
        params.set('categorySlug', selectedCategory);
      }

      // Map sort option to API params
      if (sortBy === 'price_asc') {
        params.set('sortBy', 'price');
        params.set('sortOrder', 'asc');
      } else if (sortBy === 'price_desc') {
        params.set('sortBy', 'price');
        params.set('sortOrder', 'desc');
      } else if (sortBy === 'newest') {
        params.set('sortBy', 'createdAt');
        params.set('sortOrder', 'desc');
      } else if (sortBy === 'name') {
        params.set('sortBy', 'name');
        params.set('sortOrder', 'asc');
      } else {
        params.set('sortBy', 'position');
        params.set('sortOrder', 'asc');
      }

      const res = await fetch(`/api/products/public?${params}`);
      if (res.ok) {
        const data = await res.json();
        products = data.products;
        pagination = data.pagination;
      } else {
        error = 'Не удалось загрузить товары';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
    } finally {
      loading = false;
    }
  }

  // Load featured products
  async function loadFeatured() {
    try {
      const res = await fetch('/api/products/public/featured?limit=4');
      if (res.ok) {
        const data = await res.json();
        featuredProducts = data.products;
      }
    } catch (e) {
      console.error('Failed to load featured:', e);
    }
  }

  // Handle search input
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      pagination.page = 1;
      loadProducts();
    }, 300);
  }

  // Handle category select
  function selectCategory(slug: string) {
    selectedCategory = slug;
    pagination.page = 1;
    loadProducts();
  }

  // Handle sort change
  function handleSortChange() {
    pagination.page = 1;
    loadProducts();
  }

  // Handle pagination
  function goToPage(page: number) {
    if (page < 1 || page > pagination.totalPages) return;
    pagination.page = page;
    loadProducts();
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle currency change
  function handleCurrencyChange(event: CustomEvent) {
    currency = event.detail.code;
    currencySymbol = event.detail.symbol;
  }

  // Build breadcrumb
  function getBreadcrumb(): { name: string; slug: string }[] {
    if (!selectedCategory) return [];

    const result: { name: string; slug: string }[] = [];
    const cat = categories.find((c) => c.slug === selectedCategory);
    if (cat) {
      result.push({ name: cat.name, slug: cat.slug });
    }
    return result;
  }

  // Initialize
  onMount(() => {
    // Set initial category from prop (from URL)
    if (initialCategory) {
      selectedCategory = initialCategory;
    }

    loadCategories();
    loadProducts();

    // Only load featured on main page
    if (!initialCategory) {
      loadFeatured();
    }

    // Listen for currency changes
    window.addEventListener('currencychange', handleCurrencyChange as EventListener);

    return () => {
      window.removeEventListener('currencychange', handleCurrencyChange as EventListener);
    };
  });
</script>

<div class="catalog-page">
  <!-- Header -->
  <div class="catalog-header">
    <div class="catalog-title">
      <h1>Каталог товаров</h1>
      {#if selectedCategory}
        <nav class="breadcrumb">
          <a href="/products" onclick={(e) => { e.preventDefault(); selectCategory(''); }}>
            Все товары
          </a>
          {#each getBreadcrumb() as item}
            <span class="separator">/</span>
            <span class="current">{item.name}</span>
          {/each}
        </nav>
      {/if}
    </div>

    <div class="catalog-actions">
      <CurrencySelector />
    </div>
  </div>

  <div class="catalog-layout">
    <!-- Sidebar -->
    <aside class="catalog-sidebar">
      <!-- Search -->
      <div class="search-box">
        <input
          type="text"
          placeholder="Поиск товаров..."
          bind:value={search}
          oninput={handleSearch}
        />
        <span class="search-icon">🔍</span>
      </div>

      <!-- Categories -->
      <div class="categories-menu">
        <h3>Категории</h3>
        <ul class="category-list">
          <li>
            <button
              class:active={!selectedCategory}
              onclick={() => selectCategory('')}
            >
              Все товары
            </button>
          </li>
          {#each categoryTree as cat (cat.id)}
            <li>
              <button
                class:active={selectedCategory === cat.slug}
                onclick={() => selectCategory(cat.slug)}
              >
                {cat.name}
                {#if cat.productsCount > 0}
                  <span class="count">{cat.productsCount}</span>
                {/if}
              </button>
              {#if cat.children && cat.children.length > 0}
                <ul class="subcategory-list">
                  {#each cat.children as subcat (subcat.id)}
                    <li>
                      <button
                        class:active={selectedCategory === subcat.slug}
                        onclick={() => selectCategory(subcat.slug)}
                      >
                        {subcat.name}
                        {#if subcat.productsCount > 0}
                          <span class="count">{subcat.productsCount}</span>
                        {/if}
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </aside>

    <!-- Main content -->
    <main class="catalog-main">
      <!-- Toolbar -->
      <div class="toolbar">
        <span class="results-count">
          {#if loading}
            Загрузка...
          {:else}
            Найдено: {pagination.total} товаров
          {/if}
        </span>

        <select bind:value={sortBy} onchange={handleSortChange} class="sort-select">
          {#each sortOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <!-- Featured (only on main page without filters) -->
      {#if !selectedCategory && !search && pagination.page === 1 && featuredProducts.length > 0}
        <section class="featured-section">
          <h2>Рекомендуем</h2>
          <div class="featured-grid">
            {#each featuredProducts as product (product.id)}
              <ProductCard {product} {currency} {currencySymbol} />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Products grid -->
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Загрузка товаров...</span>
        </div>
      {:else if error}
        <div class="error">
          <p>{error}</p>
          <button onclick={loadProducts} class="btn btn-secondary">Повторить</button>
        </div>
      {:else if products.length === 0}
        <div class="empty">
          <div class="empty-icon">📦</div>
          <h3>Товары не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
          {#if search || selectedCategory}
            <button onclick={() => { search = ''; selectedCategory = ''; loadProducts(); }} class="btn btn-primary">
              Сбросить фильтры
            </button>
          {/if}
        </div>
      {:else}
        <div class="products-grid">
          {#each products as product (product.id)}
            <ProductCard {product} {currency} {currencySymbol} />
          {/each}
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

            <div class="page-numbers">
              {#each Array(pagination.totalPages) as _, i}
                {#if i + 1 === 1 || i + 1 === pagination.totalPages || (i + 1 >= pagination.page - 2 && i + 1 <= pagination.page + 2)}
                  <button
                    onclick={() => goToPage(i + 1)}
                    class:active={pagination.page === i + 1}
                    class="page-num"
                  >
                    {i + 1}
                  </button>
                {:else if i + 1 === pagination.page - 3 || i + 1 === pagination.page + 3}
                  <span class="ellipsis">...</span>
                {/if}
              {/each}
            </div>

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
    </main>
  </div>
</div>

<style>
  .catalog-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: var(--spacing-6);
  }

  /* Header */
  .catalog-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
    flex-wrap: wrap;
  }

  .catalog-title h1 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-font-size-2xl);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .breadcrumb a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .separator {
    color: var(--color-border);
  }

  /* Layout */
  .catalog-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--spacing-6);
  }

  @media (max-width: 900px) {
    .catalog-layout {
      grid-template-columns: 1fr;
    }

    .catalog-sidebar {
      order: 2;
    }
  }

  /* Sidebar */
  .catalog-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .search-box {
    position: relative;
  }

  .search-box input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    padding-right: var(--spacing-10);
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

  .search-icon {
    position: absolute;
    right: var(--spacing-3);
    top: 50%;
    transform: translateY(-50%);
  }

  .categories-menu {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .categories-menu h3 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .category-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .category-list li {
    margin-bottom: var(--spacing-1);
  }

  .category-list button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .category-list button:hover {
    background: var(--color-background-secondary);
  }

  .category-list button.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: var(--font-font-weight-medium);
  }

  .count {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    background: var(--color-background-secondary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }

  .subcategory-list {
    list-style: none;
    margin: 0;
    padding: 0 0 0 var(--spacing-4);
  }

  /* Main */
  .catalog-main {
    min-width: 0;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  .results-count {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .sort-select {
    padding: var(--spacing-2) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
    cursor: pointer;
  }

  /* Featured */
  .featured-section {
    margin-bottom: var(--spacing-8);
  }

  .featured-section h2 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .featured-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--spacing-4);
  }

  /* Products grid */
  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--spacing-4);
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
    margin: 0 0 var(--spacing-4);
    color: var(--color-text-muted);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
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

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    margin-top: var(--spacing-8);
    flex-wrap: wrap;
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

  .page-numbers {
    display: flex;
    gap: var(--spacing-1);
  }

  .page-num {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .page-num:hover {
    border-color: var(--color-primary);
  }

  .page-num.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .ellipsis {
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-2);
    color: var(--color-text-muted);
  }
</style>
