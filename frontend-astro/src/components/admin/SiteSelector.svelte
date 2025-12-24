<script lang="ts">
  /**
   * Site Selector Component - Phase 3
   *
   * Allows users to switch between sites they have access to.
   * Uses /api/admin/sites/accessible to get only sites user can access.
   */

  import { onMount } from 'svelte';
  import { apiFetch, setCurrentSiteId, getCurrentSiteId } from '../../lib/api';

  interface Site {
    id: number;
    name: string;
    slug: string;
    domain: string | null;
    subdomain: string | null;
  }

  let sites: Site[] = $state([]);
  let currentSite: Site | null = $state(null);
  let loading = $state(true);
  let open = $state(false);
  let error = $state<string | null>(null);

  async function loadSites() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<{ sites: Site[] }>('/api/admin/sites/accessible');
      sites = data.sites;

      // Find current site
      const currentSiteId = getCurrentSiteId();
      if (currentSiteId) {
        currentSite = sites.find(s => s.id === parseInt(currentSiteId)) || null;
      }

      // If no current site but sites exist, select first one
      if (!currentSite && sites.length > 0) {
        await switchSite(sites[0]);
      }
    } catch (e) {
      error = 'Ошибка загрузки сайтов';
      console.error('Failed to load sites:', e);
    } finally {
      loading = false;
    }
  }

  async function switchSite(site: Site) {
    try {
      // Call switch API to verify access
      await apiFetch(`/api/admin/sites/${site.id}/switch`, { method: 'POST' });

      // Update localStorage
      setCurrentSiteId(site.id);
      currentSite = site;
      open = false;

      // Reload page to refresh data for new site context
      window.location.reload();
    } catch (e: any) {
      console.error('Failed to switch site:', e);
      alert(e.data?.error || 'Ошибка переключения сайта');
    }
  }

  function handleOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.site-selector')) {
      open = false;
    }
  }

  onMount(() => {
    loadSites();
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  });
</script>

{#if !loading && sites.length > 1}
  <div class="site-selector">
    <button
      type="button"
      class="site-button"
      onclick={() => open = !open}
      aria-expanded={open}
      aria-haspopup="listbox"
    >
      <span class="site-icon">🌐</span>
      <span class="site-name">{currentSite?.name || 'Выберите сайт'}</span>
      <svg class="chevron" class:rotated={open} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>

    {#if open}
      <div class="site-dropdown" role="listbox">
        {#each sites as site (site.id)}
          <button
            type="button"
            class="site-option"
            class:active={currentSite?.id === site.id}
            onclick={() => switchSite(site)}
            role="option"
            aria-selected={currentSite?.id === site.id}
          >
            <span class="option-name">{site.name}</span>
            <span class="option-slug">/{site.slug}</span>
            {#if currentSite?.id === site.id}
              <span class="check-icon">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else if !loading && sites.length === 1}
  <div class="site-single">
    <span class="site-icon">🌐</span>
    <span class="site-name">{sites[0].name}</span>
  </div>
{/if}

<style>
  .site-selector {
    position: relative;
  }

  .site-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-font-size-sm);
    color: var(--color-text);
    transition: all var(--transition-fast);
  }

  .site-button:hover {
    background: var(--color-background);
    border-color: var(--color-primary);
  }

  .site-icon {
    font-size: 1rem;
  }

  .site-name {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    transition: transform var(--transition-fast);
    color: var(--color-text-muted);
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .site-dropdown {
    position: absolute;
    top: calc(100% + var(--spacing-2));
    left: 0;
    right: 0;
    min-width: 200px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .site-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--font-font-size-sm);
    color: var(--color-text);
    text-align: left;
    transition: background var(--transition-fast);
  }

  .site-option:hover {
    background: var(--color-background-secondary);
  }

  .site-option.active {
    background: var(--color-primary-light);
  }

  .option-name {
    flex: 1;
    font-weight: var(--font-font-weight-medium);
  }

  .option-slug {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .check-icon {
    color: var(--color-primary);
    font-weight: bold;
  }

  .site-single {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  @media (max-width: 640px) {
    .site-name {
      max-width: 100px;
    }

    .option-slug {
      display: none;
    }
  }
</style>
