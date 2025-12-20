<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  // State
  let count = 0;
  let loading = true;

  // Load count
  async function loadCount() {
    try {
      const response = await apiFetch<{ count: number }>('/api/wishlist/count');
      count = response.count;
    } catch (err) {
      console.error('Failed to load wishlist count:', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadCount();

    // Listen for wishlist changes
    const handler = (e: CustomEvent<{ count?: number }>) => {
      if (typeof e.detail?.count === 'number') {
        count = e.detail.count;
      } else {
        loadCount();
      }
    };

    document.addEventListener('wishlist-change', handler as EventListener);
    return () => document.removeEventListener('wishlist-change', handler as EventListener);
  });
</script>

<a href="/wishlist" class="wishlist-counter" title="Избранное">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
  {#if count > 0}
    <span class="count-badge">{count > 99 ? '99+' : count}</span>
  {/if}
</a>

<style>
  .wishlist-counter {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: var(--text-primary, #333);
    text-decoration: none;
    transition: color 0.2s;
  }

  .wishlist-counter:hover {
    color: #e74c3c;
  }

  .wishlist-counter svg {
    width: 24px;
    height: 24px;
  }

  .count-badge {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: #e74c3c;
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(25%, -25%);
  }
</style>
