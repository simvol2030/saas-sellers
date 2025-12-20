<script lang="ts">
  /**
   * Cart Drawer - Slide-out cart panel
   */

  import { cartStore, updateItem, removeItem, clearCart, closeCart } from '../../stores/cart.svelte.js';

  // Format price
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU').format(price);
  }

  // Update quantity
  async function handleQuantityChange(itemId: number, delta: number, current: number) {
    const newQty = current + delta;
    if (newQty < 1) {
      await removeItem(itemId);
    } else {
      await updateItem(itemId, newQty);
    }
  }

  // Handle remove
  async function handleRemove(itemId: number) {
    await removeItem(itemId);
  }

  // Handle clear
  async function handleClear() {
    if (confirm('Очистить корзину?')) {
      await clearCart();
    }
  }

  // Handle backdrop click
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeCart();
    }
  }

  // Handle escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeCart();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if cartStore.isOpen}
  <!-- Backdrop -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <!-- Drawer -->
    <aside class="drawer" role="dialog" aria-label="Корзина">
      <!-- Header -->
      <header class="drawer-header">
        <h2>
          Корзина
          {#if cartStore.itemCount > 0}
            <span class="count">({cartStore.itemCount})</span>
          {/if}
        </h2>
        <button class="close-btn" onclick={closeCart} aria-label="Закрыть">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <!-- Content -->
      <div class="drawer-content">
        {#if cartStore.loading}
          <div class="loading">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        {:else if cartStore.isEmpty}
          <div class="empty">
            <div class="empty-icon">🛒</div>
            <h3>Корзина пуста</h3>
            <p>Добавьте товары из каталога</p>
            <a href="/products" class="btn btn-primary" onclick={closeCart}>
              Перейти в каталог
            </a>
          </div>
        {:else if cartStore.cart}
          <!-- Items -->
          <div class="cart-items">
            {#each cartStore.cart.items as item (item.id)}
              <div class="cart-item">
                <!-- Image -->
                <div class="item-image">
                  {#if item.product.image}
                    <img src={item.product.image} alt={item.product.name} />
                  {:else}
                    <div class="no-image">📦</div>
                  {/if}
                </div>

                <!-- Info -->
                <div class="item-info">
                  <a href={`/products/${item.product.slug}`} class="item-name" onclick={closeCart}>
                    {item.product.name}
                  </a>
                  {#if item.variant}
                    <span class="item-variant">{item.variant.name}</span>
                  {/if}
                  <div class="item-price">
                    {formatPrice(item.price)} {cartStore.currencySymbol}
                  </div>
                </div>

                <!-- Quantity -->
                <div class="item-quantity">
                  <button
                    onclick={() => handleQuantityChange(item.id, -1, item.quantity)}
                    disabled={cartStore.loading}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onclick={() => handleQuantityChange(item.id, 1, item.quantity)}
                    disabled={cartStore.loading}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>

                <!-- Total & Remove -->
                <div class="item-actions">
                  <span class="item-total">{formatPrice(item.total)} {cartStore.currencySymbol}</span>
                  <button
                    class="remove-btn"
                    onclick={() => handleRemove(item.id)}
                    disabled={cartStore.loading}
                    aria-label="Удалить"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>

          <!-- Clear button -->
          <button class="clear-btn" onclick={handleClear} disabled={cartStore.loading}>
            Очистить корзину
          </button>
        {/if}
      </div>

      <!-- Footer -->
      {#if !cartStore.isEmpty && cartStore.cart}
        <footer class="drawer-footer">
          <div class="totals">
            {#if cartStore.cart.totalDiscount > 0}
              <div class="total-row discount">
                <span>Скидка:</span>
                <span>−{formatPrice(cartStore.cart.totalDiscount)} {cartStore.currencySymbol}</span>
              </div>
            {/if}
            <div class="total-row grand">
              <span>Итого:</span>
              <span class="grand-total">{formatPrice(cartStore.total)} {cartStore.currencySymbol}</span>
            </div>
          </div>

          <a href="/checkout" class="btn btn-primary btn-checkout" onclick={closeCart}>
            Оформить заказ
          </a>
        </footer>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-modal, 1000);
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 420px;
    background: var(--color-background);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .drawer-header h2 {
    margin: 0;
    font-size: var(--font-font-size-lg);
  }

  .drawer-header .count {
    color: var(--color-text-muted);
    font-weight: normal;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--color-background-secondary);
    color: var(--color-text);
  }

  /* Content */
  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4);
  }

  /* Loading */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-3);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--spacing-12) var(--spacing-4);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .empty h3 {
    margin: 0 0 var(--spacing-2);
  }

  .empty p {
    margin: 0 0 var(--spacing-6);
    color: var(--color-text-muted);
  }

  /* Cart items */
  .cart-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .cart-item {
    display: grid;
    grid-template-columns: 70px 1fr auto;
    grid-template-rows: auto auto;
    gap: var(--spacing-2) var(--spacing-3);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .item-image {
    grid-row: span 2;
    width: 70px;
    height: 70px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-background-secondary);
  }

  .item-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-image .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 1.5rem;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-name {
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
    text-decoration: none;
    line-height: 1.3;
  }

  .item-name:hover {
    color: var(--color-primary);
  }

  .item-variant {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .item-price {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .item-quantity {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    height: fit-content;
  }

  .item-quantity button {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--font-font-size-md);
  }

  .item-quantity button:hover:not(:disabled) {
    background: var(--color-background-secondary);
  }

  .item-quantity button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .item-quantity span {
    width: 30px;
    text-align: center;
    font-size: var(--font-font-size-sm);
  }

  .item-actions {
    grid-column: 2 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .item-total {
    font-weight: var(--font-font-weight-semibold);
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .remove-btn:hover:not(:disabled) {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .remove-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .clear-btn {
    width: 100%;
    margin-top: var(--spacing-4);
    padding: var(--spacing-2);
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
    cursor: pointer;
    text-decoration: underline;
  }

  .clear-btn:hover:not(:disabled) {
    color: var(--color-error);
  }

  .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Footer */
  .drawer-footer {
    padding: var(--spacing-4) var(--spacing-5);
    border-top: 1px solid var(--color-border);
    background: var(--color-background);
  }

  .totals {
    margin-bottom: var(--spacing-4);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-2);
  }

  .total-row.discount {
    color: var(--color-success);
  }

  .total-row.grand {
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-bold);
    margin-bottom: 0;
  }

  .grand-total {
    color: var(--color-primary);
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
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-checkout {
    width: 100%;
    padding: var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }
</style>
