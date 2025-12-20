<script lang="ts">
  /**
   * Cart Icon - Header cart button with item count badge
   */

  import { onMount } from 'svelte';
  import { cartStore, fetchCart, toggleCart } from '../../stores/cart.svelte.js';

  let mounted = $state(false);

  onMount(() => {
    // Fetch cart on mount
    fetchCart();
    mounted = true;

    // Listen for cart:add events from product pages
    function handleCartAdd(e: CustomEvent) {
      const { productId, variantId, quantity } = e.detail;
      cartStore.addItem(productId, quantity, variantId);
    }

    window.addEventListener('cart:add', handleCartAdd as EventListener);

    return () => {
      window.removeEventListener('cart:add', handleCartAdd as EventListener);
    };
  });

  function handleClick() {
    toggleCart();
  }
</script>

<button
  class="cart-icon"
  onclick={handleClick}
  aria-label="Корзина"
  title="Корзина"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>

  {#if mounted && cartStore.itemCount > 0}
    <span class="badge">{cartStore.itemCount}</span>
  {/if}
</button>

<style>
  .cart-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    border-radius: var(--radius-full);
    transition: background var(--transition-fast);
  }

  .cart-icon:hover {
    background: var(--color-background-secondary);
  }

  .cart-icon svg {
    width: 22px;
    height: 22px;
  }

  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: var(--color-primary);
    color: white;
    font-size: 11px;
    font-weight: var(--font-font-weight-bold);
    border-radius: var(--radius-full);
    pointer-events: none;
  }
</style>
