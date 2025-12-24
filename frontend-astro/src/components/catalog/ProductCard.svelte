<script lang="ts">
  /**
   * Product Card Component
   *
   * Displays product preview in catalog grid
   */

  interface Props {
    product: {
      id: number;
      name: string;
      slug: string;
      shortDesc?: string | null;
      prices: Record<string, number>;
      comparePrice?: number | null;
      category?: { name: string; slug: string } | null;
      image?: string | null;
    };
    currency?: string;
    currencySymbol?: string;
  }

  let { product, currency = 'RUB', currencySymbol = '₽' }: Props = $props();

  // Get price in selected currency
  function getPrice(): string {
    const price = product.prices?.[currency];
    if (typeof price !== 'number') {
      // Fallback to first available price
      const firstPrice = Object.entries(product.prices || {})[0];
      if (firstPrice) {
        return formatPrice(firstPrice[1]);
      }
      return '—';
    }
    return formatPrice(price);
  }

  // Format price
  function formatPrice(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + ' ' + currencySymbol;
  }

  // Check for discount
  function hasDiscount(): boolean {
    if (!product.comparePrice) return false;
    const currentPrice = product.prices?.[currency] || 0;
    return product.comparePrice > currentPrice;
  }

  // Calculate discount percentage
  function getDiscountPercent(): number {
    if (!product.comparePrice) return 0;
    const currentPrice = product.prices?.[currency] || 0;
    if (currentPrice <= 0) return 0;
    return Math.round((1 - currentPrice / Number(product.comparePrice)) * 100);
  }
</script>

<a href={`/products/${product.slug}`} class="product-card">
  <div class="product-image">
    {#if product.image}
      <img src={product.image} alt={product.name} loading="lazy" />
    {:else}
      <div class="no-image">
        <span>📷</span>
      </div>
    {/if}

    {#if hasDiscount()}
      <span class="discount-badge">-{getDiscountPercent()}%</span>
    {/if}
  </div>

  <div class="product-info">
    {#if product.category}
      <span class="product-category">{product.category.name}</span>
    {/if}

    <h3 class="product-name">{product.name}</h3>

    {#if product.shortDesc}
      <p class="product-desc">{product.shortDesc}</p>
    {/if}

    <div class="product-price">
      <span class="current-price">{getPrice()}</span>
      {#if hasDiscount()}
        <span class="old-price">{formatPrice(Number(product.comparePrice))}</span>
      {/if}
    </div>
  </div>
</a>

<style>
  .product-card {
    display: flex;
    flex-direction: column;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    text-decoration: none;
    color: var(--color-text);
    transition: all var(--transition-normal);
  }

  .product-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  .product-image {
    position: relative;
    aspect-ratio: 1;
    background: var(--color-background-secondary);
    overflow: hidden;
  }

  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-normal);
  }

  .product-card:hover .product-image img {
    transform: scale(1.05);
  }

  .no-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: var(--color-text-muted);
  }

  .discount-badge {
    position: absolute;
    top: var(--spacing-3);
    right: var(--spacing-3);
    padding: var(--spacing-1) var(--spacing-3);
    background: var(--color-error);
    color: white;
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-bold);
  }

  .product-info {
    padding: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    flex: 1;
  }

  .product-category {
    font-size: var(--font-font-size-xs);
    color: var(--color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .product-name {
    margin: 0;
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .product-desc {
    margin: 0;
    font-size: var(--font-font-size-sm);
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .product-price {
    margin-top: auto;
    padding-top: var(--spacing-2);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .current-price {
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-bold);
    color: var(--color-text);
  }

  .old-price {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
