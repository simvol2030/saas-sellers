<script lang="ts">
  /**
   * Product Detail Component
   *
   * Full product page with gallery, variants, add to cart
   */

  import { onMount } from 'svelte';
  import CurrencySelector from './CurrencySelector.svelte';

  interface Props {
    slug: string;
  }

  let { slug }: Props = $props();

  interface ProductImage {
    id: number;
    url: string;
    alt?: string | null;
    position: number;
  }

  interface ProductVariant {
    id: number;
    name: string;
    sku?: string | null;
    prices: Record<string, number>;
    stock?: number;
    inStock?: boolean;  // API returns this boolean flag
    attributes?: Record<string, string>;
  }

  interface Product {
    id: number;
    name: string;
    slug: string;
    sku?: string | null;
    shortDesc?: string | null;
    description?: string | null;
    prices: Record<string, number>;
    comparePrice?: number | null;
    stock: number;
    stockStatus: string;
    category?: { id: number; name: string; slug: string } | null;
    images: ProductImage[];
    variants: ProductVariant[];
    metaTitle?: string | null;
    metaDesc?: string | null;
  }

  // State
  let product: Product | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Gallery
  let selectedImage = $state<number>(0);

  // Variant
  let selectedVariant = $state<ProductVariant | null>(null);

  // Quantity
  let quantity = $state(1);

  // Currency
  let currency = $state('RUB');
  let currencySymbol = $state('₽');

  // Computed price - fallback to product.prices if variant.prices is empty
  let currentPrice = $derived.by(() => {
    if (selectedVariant) {
      const variantPrices = selectedVariant.prices || {};
      if (Object.keys(variantPrices).length > 0) {
        return variantPrices[currency] || Object.values(variantPrices)[0] || 0;
      }
      // Fallback to product prices if variant prices is empty
    }
    if (product) {
      return product.prices[currency] || Object.values(product.prices)[0] || 0;
    }
    return 0;
  });

  let comparePrice = $derived(product?.comparePrice || null);

  let discount = $derived.by(() => {
    if (comparePrice && currentPrice < comparePrice) {
      return Math.round((1 - currentPrice / comparePrice) * 100);
    }
    return 0;
  });

  let inStock = $derived.by(() => {
    if (selectedVariant) {
      // Prefer inStock boolean flag from API, fallback to stock number check
      if (typeof selectedVariant.inStock === 'boolean') {
        return selectedVariant.inStock;
      }
      return (selectedVariant.stock ?? 0) > 0;
    }
    if (product) {
      return product.stock > 0 || product.stockStatus === 'in_stock';
    }
    return false;
  });

  // Format price
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU').format(price);
  }

  // Load product
  async function loadProduct() {
    loading = true;
    error = null;

    try {
      const res = await fetch(`/api/products/public/${slug}`);
      if (res.ok) {
        const data = await res.json();
        product = data.product;
        // Default variant
        if (product?.variants && product.variants.length > 0) {
          selectedVariant = product.variants[0];
        }
      } else if (res.status === 404) {
        error = 'Товар не найден';
      } else {
        error = 'Не удалось загрузить товар';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
    } finally {
      loading = false;
    }
  }

  // Select variant
  function selectVariant(variant: ProductVariant) {
    selectedVariant = variant;
  }

  // Change quantity
  function changeQuantity(delta: number) {
    const newQty = quantity + delta;
    const maxStock = selectedVariant?.stock ?? product?.stock ?? 99;
    quantity = Math.max(1, Math.min(newQty, maxStock));
  }

  // Add to cart
  async function addToCart() {
    if (!product || !inStock) return;

    try {
      const cartItem = {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      };

      // Dispatch event for cart store
      window.dispatchEvent(
        new CustomEvent('cart:add', { detail: cartItem })
      );

      // Show feedback
      alert(`${product.name} добавлен в корзину!`);
    } catch (e) {
      console.error('Failed to add to cart:', e);
    }
  }

  // Handle currency change
  function handleCurrencyChange(event: CustomEvent) {
    currency = event.detail.code;
    currencySymbol = event.detail.symbol;
  }

  // Initialize
  onMount(() => {
    loadProduct();

    window.addEventListener('currencychange', handleCurrencyChange as EventListener);

    return () => {
      window.removeEventListener('currencychange', handleCurrencyChange as EventListener);
    };
  });
</script>

<div class="product-detail">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка товара...</span>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <a href="/products" class="btn btn-primary">Вернуться в каталог</a>
    </div>
  {:else if product}
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <a href="/products">Каталог</a>
      {#if product.category}
        <span class="separator">/</span>
        <a href={`/products/category/${product.category.slug}`}>{product.category.name}</a>
      {/if}
      <span class="separator">/</span>
      <span class="current">{product.name}</span>
    </nav>

    <div class="product-layout">
      <!-- Gallery -->
      <div class="product-gallery">
        <div class="main-image">
          {#if product.images.length > 0}
            <img
              src={product.images[selectedImage]?.url || product.images[0]?.url}
              alt={product.images[selectedImage]?.alt || product.name}
            />
          {:else}
            <div class="no-image">
              <span>Нет изображения</span>
            </div>
          {/if}

          {#if discount > 0}
            <span class="discount-badge">-{discount}%</span>
          {/if}
        </div>

        {#if product.images.length > 1}
          <div class="thumbnails">
            {#each product.images as img, i (img.id)}
              <button
                class:active={selectedImage === i}
                onclick={() => selectedImage = i}
              >
                <img src={img.url} alt={img.alt || `${product.name} ${i + 1}`} />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Info -->
      <div class="product-info">
        <div class="product-header">
          <h1>{product.name}</h1>
          {#if product.sku}
            <span class="sku">Артикул: {product.sku}</span>
          {/if}
        </div>

        <!-- Price -->
        <div class="price-block">
          <span class="current-price">{formatPrice(currentPrice)} {currencySymbol}</span>
          {#if comparePrice && comparePrice > currentPrice}
            <span class="old-price">{formatPrice(comparePrice)} {currencySymbol}</span>
          {/if}
          <CurrencySelector />
        </div>

        <!-- Stock -->
        <div class="stock-status" class:in-stock={inStock} class:out-of-stock={!inStock}>
          {#if inStock}
            <span class="icon">✓</span> В наличии
          {:else}
            <span class="icon">✗</span> Нет в наличии
          {/if}
        </div>

        <!-- Short description -->
        {#if product.shortDesc}
          <p class="short-desc">{product.shortDesc}</p>
        {/if}

        <!-- Variants -->
        {#if product.variants.length > 1}
          <div class="variants">
            <h3>Варианты:</h3>
            <div class="variant-buttons">
              {#each product.variants as variant (variant.id)}
                {@const isOutOfStock = variant.inStock === false || (typeof variant.inStock === 'undefined' && (variant.stock ?? 0) === 0)}
                <button
                  class:active={selectedVariant?.id === variant.id}
                  class:disabled={isOutOfStock}
                  onclick={() => selectVariant(variant)}
                  disabled={isOutOfStock}
                >
                  {variant.name}
                  {#if isOutOfStock}
                    <span class="out">(нет)</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Quantity -->
        <div class="quantity-block">
          <span class="label">Количество:</span>
          <div class="quantity-controls">
            <button onclick={() => changeQuantity(-1)} disabled={quantity <= 1}>−</button>
            <span class="qty">{quantity}</span>
            <button onclick={() => changeQuantity(1)}>+</button>
          </div>
        </div>

        <!-- Add to cart -->
        <div class="actions">
          <button
            class="btn btn-primary btn-large add-to-cart"
            onclick={addToCart}
            disabled={!inStock}
          >
            {#if inStock}
              Добавить в корзину
            {:else}
              Нет в наличии
            {/if}
          </button>
        </div>

        <!-- Description -->
        {#if product.description}
          <div class="description">
            <h3>Описание</h3>
            <div class="content">{@html product.description}</div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .product-detail {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-6);
  }

  /* Breadcrumb */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-6);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    flex-wrap: wrap;
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
  .product-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-8);
  }

  @media (max-width: 900px) {
    .product-layout {
      grid-template-columns: 1fr;
    }
  }

  /* Gallery */
  .product-gallery {
    position: sticky;
    top: var(--spacing-4);
    align-self: start;
  }

  .main-image {
    position: relative;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .main-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-lg);
  }

  .discount-badge {
    position: absolute;
    top: var(--spacing-3);
    left: var(--spacing-3);
    background: var(--color-error);
    color: white;
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-bold);
  }

  .thumbnails {
    display: flex;
    gap: var(--spacing-2);
    margin-top: var(--spacing-3);
    overflow-x: auto;
  }

  .thumbnails button {
    width: 80px;
    height: 80px;
    padding: 0;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition: border-color var(--transition-fast);
  }

  .thumbnails button:hover {
    border-color: var(--color-primary);
  }

  .thumbnails button.active {
    border-color: var(--color-primary);
    border-width: 3px;
  }

  .thumbnails button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Product info */
  .product-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .product-header h1 {
    margin: 0;
    font-size: var(--font-font-size-2xl);
    line-height: 1.2;
  }

  .sku {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  /* Price */
  .price-block {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .current-price {
    font-size: var(--font-font-size-2xl);
    font-weight: var(--font-font-weight-bold);
    color: var(--color-text);
  }

  .old-price {
    font-size: var(--font-font-size-lg);
    color: var(--color-text-muted);
    text-decoration: line-through;
  }

  /* Stock */
  .stock-status {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    width: fit-content;
  }

  .stock-status.in-stock {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .stock-status.out-of-stock {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .short-desc {
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  /* Variants */
  .variants h3 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .variant-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .variant-buttons button {
    padding: var(--spacing-2) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .variant-buttons button:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .variant-buttons button.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .variant-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .variant-buttons .out {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  /* Quantity */
  .quantity-block {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .quantity-block .label {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .quantity-controls button {
    width: 40px;
    height: 40px;
    border: none;
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-lg);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .quantity-controls button:hover:not(:disabled) {
    background: var(--color-background-secondary);
  }

  .quantity-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quantity-controls .qty {
    width: 50px;
    text-align: center;
    font-weight: var(--font-font-weight-medium);
  }

  /* Actions */
  .actions {
    margin-top: var(--spacing-4);
  }

  .add-to-cart {
    width: 100%;
    padding: var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .add-to-cart:disabled {
    background: var(--color-text-muted);
    cursor: not-allowed;
  }

  /* Description */
  .description {
    margin-top: var(--spacing-6);
    padding-top: var(--spacing-6);
    border-top: 1px solid var(--color-border);
  }

  .description h3 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .description .content {
    line-height: 1.7;
    color: var(--color-text);
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
    min-height: 400px;
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

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-large {
    padding: var(--spacing-4) var(--spacing-6);
    font-size: var(--font-font-size-lg);
  }
</style>
