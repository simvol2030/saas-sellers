<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface WishlistProduct {
    id: number;
    name: string;
    slug: string;
    price: number;
    comparePrice: number | null;
    status: string;
    image: string | null;
    inStock: boolean;
  }

  interface WishlistResponse {
    count: number;
    products: WishlistProduct[];
    productIds: number[];
  }

  // State
  let products: WishlistProduct[] = [];
  let loading = true;
  let error = '';
  let removingId: number | null = null;

  // Load wishlist
  async function loadWishlist() {
    loading = true;
    error = '';

    try {
      const response = await apiFetch<WishlistResponse>('/api/wishlist');
      products = response.products;
    } catch (err) {
      error = 'Не удалось загрузить избранное';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Remove item
  async function removeItem(productId: number) {
    if (removingId) return;
    removingId = productId;

    try {
      await apiFetch(`/api/wishlist/remove/${productId}`, {
        method: 'DELETE',
      });

      products = products.filter(p => p.id !== productId);

      // Dispatch event
      document.dispatchEvent(new CustomEvent('wishlist-change', {
        detail: { productId, inWishlist: false, count: products.length },
        bubbles: true,
      }));

    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
    } finally {
      removingId = null;
    }
  }

  // Clear all
  async function clearAll() {
    if (!confirm('Очистить список избранного?')) return;

    try {
      await apiFetch('/api/wishlist/clear', {
        method: 'DELETE',
      });

      products = [];

      document.dispatchEvent(new CustomEvent('wishlist-change', {
        detail: { count: 0 },
        bubbles: true,
      }));

    } catch (err) {
      console.error('Failed to clear wishlist:', err);
    }
  }

  // Format price
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(price);
  }

  // Calculate discount percent
  function getDiscount(price: number, comparePrice: number | null): number | null {
    if (!comparePrice || comparePrice <= price) return null;
    return Math.round((1 - price / comparePrice) * 100);
  }

  onMount(() => {
    loadWishlist();

    // Listen for wishlist changes
    const handler = () => loadWishlist();
    document.addEventListener('wishlist-change', handler);
    return () => document.removeEventListener('wishlist-change', handler);
  });
</script>

<div class="wishlist-page">
  <div class="wishlist-header">
    <h1>Избранное</h1>
    {#if products.length > 0}
      <button class="btn-clear" on:click={clearAll}>
        Очистить всё
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Загрузка...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button class="btn btn-primary" on:click={loadWishlist}>
        Попробовать снова
      </button>
    </div>
  {:else if products.length === 0}
    <div class="empty">
      <div class="empty-icon">💔</div>
      <h2>Список избранного пуст</h2>
      <p>Добавляйте понравившиеся товары, нажимая на ❤️</p>
      <a href="/catalog" class="btn btn-primary">Перейти в каталог</a>
    </div>
  {:else}
    <div class="wishlist-grid">
      {#each products as product}
        <div class="wishlist-card" class:removing={removingId === product.id}>
          <button
            class="remove-btn"
            on:click={() => removeItem(product.id)}
            disabled={removingId === product.id}
            aria-label="Удалить из избранного"
          >
            ×
          </button>

          <a href="/product/{product.slug}" class="product-link">
            <div class="product-image">
              {#if product.image}
                <img src={product.image} alt={product.name} loading="lazy" />
              {:else}
                <div class="no-image">📷</div>
              {/if}

              {#if !product.inStock}
                <div class="out-of-stock-badge">Нет в наличии</div>
              {/if}

              {#if getDiscount(product.price, product.comparePrice)}
                <div class="discount-badge">-{getDiscount(product.price, product.comparePrice)}%</div>
              {/if}
            </div>

            <div class="product-info">
              <h3 class="product-name">{product.name}</h3>
              <div class="product-price">
                <span class="current-price">{formatPrice(product.price)}</span>
                {#if product.comparePrice && product.comparePrice > product.price}
                  <span class="old-price">{formatPrice(product.comparePrice)}</span>
                {/if}
              </div>
            </div>
          </a>

          <div class="product-actions">
            {#if product.inStock}
              <button class="btn btn-primary btn-add-cart">
                В корзину
              </button>
            {:else}
              <button class="btn btn-disabled" disabled>
                Нет в наличии
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div class="wishlist-summary">
      <p>В избранном: <strong>{products.length}</strong> {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}</p>
    </div>
  {/if}
</div>

<style>
  .wishlist-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .wishlist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .wishlist-header h1 {
    margin: 0;
  }

  .btn-clear {
    padding: 0.5rem 1rem;
    background: #f8d7da;
    color: #721c24;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-clear:hover {
    background: #f5c6cb;
  }

  .loading {
    text-align: center;
    padding: 4rem 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #eee;
    border-top-color: var(--color-primary, #007bff);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error, .empty {
    text-align: center;
    padding: 4rem 0;
  }

  .error p {
    color: #dc3545;
    margin-bottom: 1rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty h2 {
    margin-bottom: 0.5rem;
  }

  .empty p {
    color: #666;
    margin-bottom: 1.5rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    font-size: 1rem;
  }

  .btn-primary {
    background: var(--color-primary, #007bff);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark, #0056b3);
  }

  .btn-disabled {
    background: #eee;
    color: #999;
    cursor: not-allowed;
  }

  /* Grid */
  .wishlist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .wishlist-card {
    position: relative;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
  }

  .wishlist-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  .wishlist-card.removing {
    opacity: 0.5;
    pointer-events: none;
  }

  .remove-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(0,0,0,0.5);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .remove-btn:hover {
    background: rgba(220, 53, 69, 0.9);
  }

  .product-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .product-image {
    position: relative;
    aspect-ratio: 1;
    background: #f5f5f5;
    overflow: hidden;
  }

  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .wishlist-card:hover .product-image img {
    transform: scale(1.05);
  }

  .no-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: #ccc;
  }

  .out-of-stock-badge {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .discount-badge {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    background: #e74c3c;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .product-info {
    padding: 1rem;
  }

  .product-name {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .product-price {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .current-price {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-primary, #007bff);
  }

  .old-price {
    font-size: 0.9rem;
    color: #999;
    text-decoration: line-through;
  }

  .product-actions {
    padding: 0 1rem 1rem;
  }

  .btn-add-cart {
    width: 100%;
    padding: 0.75rem;
  }

  .wishlist-summary {
    margin-top: 2rem;
    text-align: center;
    color: #666;
  }

  @media (max-width: 600px) {
    .wishlist-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
      text-align: center;
    }

    .wishlist-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .product-info {
      padding: 0.75rem;
    }

    .product-name {
      font-size: 0.9rem;
    }

    .current-price {
      font-size: 1rem;
    }
  }
</style>
