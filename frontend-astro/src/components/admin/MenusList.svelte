<script lang="ts">
  /**
   * Menus List Component
   *
   * Management of site navigation menus
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface MenuItem {
    id: string;
    label: string;
    href: string;
    target?: '_blank' | '_self';
    icon?: string;
    children?: MenuItem[];
    pageId?: number;
  }

  interface Menu {
    id: number;
    name: string;
    slug: string;
    location: string;
    items: MenuItem[];
    createdAt: string;
    updatedAt: string;
  }

  let menus: Menu[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let showCreateModal = $state(false);

  // New menu form
  let newMenu = $state({
    name: '',
    slug: '',
    location: 'header',
  });

  const locations = [
    { value: 'header', label: 'Шапка (Header)' },
    { value: 'footer', label: 'Подвал (Footer)' },
    { value: 'sidebar', label: 'Боковая панель' },
    { value: 'mobile', label: 'Мобильное меню' },
  ];

  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => notification = null, 5000);
  }

  async function loadMenus() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<{ menus: Menu[] }>('/api/admin/menus');
      menus = data.menus.map((m: Menu) => ({
        ...m,
        items: typeof m.items === 'string' ? JSON.parse(m.items) : m.items || [],
      }));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки меню';
    } finally {
      loading = false;
    }
  }

  async function createMenu() {
    if (!newMenu.name || !newMenu.slug) {
      showNotification('error', 'Заполните название и slug');
      return;
    }

    try {
      await apiFetch('/api/admin/menus', {
        method: 'POST',
        body: JSON.stringify({
          ...newMenu,
          items: [],
        }),
      });
      showNotification('success', 'Меню создано');
      showCreateModal = false;
      newMenu = { name: '', slug: '', location: 'header' };
      loadMenus();
    } catch (e: any) {
      showNotification('error', e.message || 'Ошибка создания меню');
    }
  }

  async function deleteMenu(id: number, name: string) {
    if (!confirm(`Удалить меню "${name}"?`)) return;

    try {
      await apiFetch(`/api/admin/menus/${id}`, { method: 'DELETE' });
      showNotification('success', 'Меню удалено');
      loadMenus();
    } catch (e: any) {
      showNotification('error', e.message || 'Ошибка удаления');
    }
  }

  function generateSlug() {
    if (newMenu.slug || !newMenu.name) return;

    const cyrillicMap: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    };

    newMenu.slug = newMenu.name
      .toLowerCase()
      .split('')
      .map(char => cyrillicMap[char] ?? char)
      .join('')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  function getLocationLabel(location: string): string {
    return locations.find(l => l.value === location)?.label || location;
  }

  function countItems(items: MenuItem[]): number {
    let count = items.length;
    for (const item of items) {
      if (item.children) {
        count += countItems(item.children);
      }
    }
    return count;
  }

  onMount(() => {
    loadMenus();
  });
</script>

<div class="menus-list">
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button type="button" class="notification-close" onclick={() => notification = null}>×</button>
    </div>
  {/if}

  <div class="toolbar">
    <h2 class="page-title">Навигация</h2>
    <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
      ➕ Создать меню
    </button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>❌ {error}</p>
      <button onclick={loadMenus} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if menus.length === 0}
    <div class="empty-state">
      <div class="empty-icon">☰</div>
      <h3>Меню не найдены</h3>
      <p>Создайте меню для навигации по сайту</p>
      <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
        Создать меню
      </button>
    </div>
  {:else}
    <div class="menus-grid">
      {#each menus as menu (menu.id)}
        <div class="menu-card">
          <div class="menu-header">
            <div class="menu-icon">☰</div>
            <div class="menu-info">
              <h3 class="menu-name">{menu.name}</h3>
              <span class="menu-location">{getLocationLabel(menu.location)}</span>
            </div>
          </div>
          <div class="menu-preview">
            {#if menu.items.length > 0}
              <ul class="preview-items">
                {#each menu.items.slice(0, 5) as item (item.id)}
                  <li>
                    {item.label}
                    {#if item.children && item.children.length > 0}
                      <span class="has-children">▸</span>
                    {/if}
                  </li>
                {/each}
                {#if menu.items.length > 5}
                  <li class="more-items">... и ещё {menu.items.length - 5}</li>
                {/if}
              </ul>
            {:else}
              <p class="no-items">Пустое меню</p>
            {/if}
          </div>
          <div class="menu-meta">
            <span>{countItems(menu.items)} пунктов</span>
            <span class="menu-slug">/{menu.slug}</span>
          </div>
          <div class="menu-actions">
            <a href={`/admin/menus/${menu.id}`} class="btn btn-sm btn-outline">
              ✏️ Редактировать
            </a>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              onclick={() => deleteMenu(menu.id, menu.name)}
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCreateModal}
    <div class="modal-overlay" onclick={() => showCreateModal = false}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Новое меню</h2>
          <button type="button" class="modal-close" onclick={() => showCreateModal = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="menu-name">Название *</label>
            <input
              id="menu-name"
              type="text"
              bind:value={newMenu.name}
              onblur={generateSlug}
              placeholder="Главное меню"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="menu-slug">Slug *</label>
            <input
              id="menu-slug"
              type="text"
              bind:value={newMenu.slug}
              placeholder="main"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="menu-location">Расположение</label>
            <select id="menu-location" bind:value={newMenu.location} class="form-select">
              {#each locations as loc}
                <option value={loc.value}>{loc.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={createMenu}>
            Создать
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .menus-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .page-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
    font-weight: var(--font-font-weight-semibold);
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

  .btn-outline {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover {
    background: var(--color-background-secondary);
  }

  .btn-danger {
    background: transparent;
    color: var(--color-error);
    border: 1px solid var(--color-error);
  }

  .btn-danger:hover {
    background: var(--color-error-light);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-font-size-xs);
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
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4);
    color: var(--color-text-muted);
  }

  /* Menus Grid */
  .menus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-4);
  }

  .menu-card {
    display: flex;
    flex-direction: column;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: box-shadow var(--transition-fast);
  }

  .menu-card:hover {
    box-shadow: var(--shadow-md);
  }

  .menu-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .menu-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-md);
    font-size: 1.5rem;
  }

  .menu-info {
    flex: 1;
  }

  .menu-name {
    margin: 0;
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .menu-location {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .menu-preview {
    padding: var(--spacing-4);
    flex: 1;
    min-height: 100px;
  }

  .preview-items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .preview-items li {
    padding: var(--spacing-1) 0;
    font-size: var(--font-font-size-sm);
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .has-children {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-xs);
  }

  .more-items {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .no-items {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
    font-style: italic;
  }

  .menu-meta {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
  }

  .menu-slug {
    font-family: var(--font-font-family-mono);
  }

  .menu-actions {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .menu-actions .btn {
    flex: 1;
    justify-content: center;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-4);
    z-index: 1000;
  }

  .modal {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-font-size-lg);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1.2rem;
    color: var(--color-text-muted);
  }

  .modal-close:hover {
    background: var(--color-background-secondary);
  }

  .modal-body {
    padding: var(--spacing-6);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-6);
    border-top: 1px solid var(--color-border);
  }

  /* Form */
  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
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
    box-shadow: var(--shadow-xl);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
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
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
</style>
