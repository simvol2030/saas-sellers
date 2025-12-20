<script lang="ts">
  import { apiFetch } from '../../lib/api';

  // Props
  export let productId: number;
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let showLabel = false;

  // State
  let inWishlist = false;
  let loading = false;
  let animating = false;

  // Check initial state
  async function checkWishlist() {
    try {
      const response = await apiFetch<{ inWishlist: boolean }>(
        `/api/wishlist/check/${productId}`
      );
      inWishlist = response.inWishlist;
    } catch (err) {
      console.error('Failed to check wishlist:', err);
    }
  }

  // Toggle wishlist
  async function toggle() {
    if (loading) return;

    loading = true;
    animating = true;

    try {
      const response = await apiFetch<{
        success: boolean;
        action: string;
        inWishlist: boolean;
        count: number;
      }>('/api/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });

      inWishlist = response.inWishlist;

      // Dispatch custom event for parent components
      const event = new CustomEvent('wishlist-change', {
        detail: {
          productId,
          inWishlist: response.inWishlist,
          count: response.count,
        },
        bubbles: true,
      });
      document.dispatchEvent(event);

    } catch (err) {
      console.error('Failed to toggle wishlist:', err);
    } finally {
      loading = false;
      setTimeout(() => { animating = false; }, 300);
    }
  }

  // Check on mount
  $: if (productId) {
    checkWishlist();
  }
</script>

<button
  class="wishlist-btn"
  class:active={inWishlist}
  class:loading
  class:animating
  class:small={size === 'small'}
  class:large={size === 'large'}
  on:click|preventDefault|stopPropagation={toggle}
  aria-label={inWishlist ? 'Удалить из избранного' : 'Добавить в избранное'}
  title={inWishlist ? 'Удалить из избранного' : 'Добавить в избранное'}
>
  <svg
    class="heart-icon"
    viewBox="0 0 24 24"
    fill={inWishlist ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
  {#if showLabel}
    <span class="label">{inWishlist ? 'В избранном' : 'В избранное'}</span>
  {/if}
</button>

<style>
  .wishlist-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: none;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #999;
  }

  .wishlist-btn:hover {
    background: rgba(255, 255, 255, 1);
    color: #e74c3c;
    transform: scale(1.1);
  }

  .wishlist-btn.active {
    color: #e74c3c;
  }

  .wishlist-btn.loading {
    opacity: 0.6;
    cursor: wait;
  }

  .wishlist-btn.animating .heart-icon {
    animation: heartbeat 0.3s ease;
  }

  /* Sizes */
  .wishlist-btn.small {
    padding: 0.3rem;
  }

  .wishlist-btn.small .heart-icon {
    width: 16px;
    height: 16px;
  }

  .wishlist-btn .heart-icon {
    width: 24px;
    height: 24px;
  }

  .wishlist-btn.large {
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--bg-secondary, #f5f5f5);
  }

  .wishlist-btn.large .heart-icon {
    width: 28px;
    height: 28px;
  }

  /* With label */
  .wishlist-btn:has(.label) {
    border-radius: 8px;
    padding: 0.5rem 1rem;
  }

  .label {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
  }

  @keyframes heartbeat {
    0% { transform: scale(1); }
    25% { transform: scale(1.3); }
    50% { transform: scale(0.9); }
    75% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
</style>
