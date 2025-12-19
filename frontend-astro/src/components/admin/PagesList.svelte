<script lang="ts">
  /**
   * Pages List Component
   *
   * Interactive table for managing landing pages
   * Features: pagination, search, filters, bulk actions
   */

  import { onMount } from 'svelte';

  interface Page {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: 'draft' | 'published';
    publishedAt: string | null;
    prerender: boolean;
    createdAt: string;
    updatedAt: string;
    author: {
      id: number;
      name: string | null;
      email: string;
    };
  }

  interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  let pages: Page[] = $state([]);
  let pagination: Pagination = $state({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let search = $state('');
  let statusFilter = $state<'all' | 'draft' | 'published'>('all');
  let searchTimeout: number;

  // Load pages
  async function loadPages() {
    loading = true;
    error = null;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        status: statusFilter,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      if (search) {
        params.set('search', search);
      }

      const res = await fetch(`/api/admin/pages?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to load pages');
      }

      const data = await res.json();
      pages = data.pages;
      pagination = data.pagination;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  // Debounced search
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      pagination.page = 1;
      loadPages();
    }, 300);
  }

  // Status filter change
  function handleStatusChange() {
    pagination.page = 1;
    loadPages();
  }

  // Pagination
  function goToPage(page: number) {
    if (page < 1 || page > pagination.totalPages) return;
    pagination.page = page;
    loadPages();
  }

  // Actions
  async function publishPage(id: number) {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/admin/pages/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadPages();
      }
    } catch (e) {
      console.error('Publish error:', e);
    }
  }

  async function unpublishPage(id: number) {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/admin/pages/${id}/unpublish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadPages();
      }
    } catch (e) {
      console.error('Unpublish error:', e);
    }
  }

  async function deletePage(id: number, title: string) {
    if (!confirm(`Удалить страницу "${title}"?`)) return;

    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/admin/pages/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadPages();
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  }

  async function duplicatePage(id: number) {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/admin/pages/${id}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadPages();
      }
    } catch (e) {
      console.error('Duplicate error:', e);
    }
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Initial load - use onMount to load once, not $effect which creates infinite loop
  onMount(() => {
    loadPages();
  });
</script>

<div class="pages-list">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <input
        type="text"
        placeholder="Поиск по названию..."
        bind:value={search}
        oninput={handleSearch}
        class="search-input"
      />
    </div>

    <div class="filters">
      <select bind:value={statusFilter} onchange={handleStatusChange} class="filter-select">
        <option value="all">Все статусы</option>
        <option value="draft">Черновики</option>
        <option value="published">Опубликованные</option>
      </select>
    </div>

    <a href="/admin/pages/new" class="btn btn-primary">
      ➕ Создать страницу
    </a>
  </div>

  <!-- Table -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>❌ {error}</p>
      <button onclick={loadPages} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if pages.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <h3>Страницы не найдены</h3>
      <p>Создайте первую страницу для вашего лендинга</p>
      <a href="/admin/pages/new" class="btn btn-primary">Создать страницу</a>
    </div>
  {:else}
    <div class="table-container">
      <table class="pages-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Slug</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each pages as page (page.id)}
            <tr>
              <td class="title-cell">
                <a href={`/admin/pages/${page.id}`} class="page-title">
                  {page.title}
                </a>
                {#if page.description}
                  <span class="page-description">{page.description}</span>
                {/if}
              </td>
              <td class="slug-cell">
                <code>/{page.slug}</code>
                <a
                  href={`/${page.slug}`}
                  target="_blank"
                  rel="noopener"
                  class="preview-link"
                  title="Открыть страницу"
                >
                  ↗
                </a>
              </td>
              <td>
                <span class={`status-badge status-${page.status}`}>
                  {page.status === 'published' ? '✅ Опубликовано' : '📝 Черновик'}
                </span>
              </td>
              <td class="date-cell">
                {formatDate(page.updatedAt)}
              </td>
              <td class="actions-cell">
                <div class="actions-menu">
                  <a href={`/admin/pages/${page.id}`} class="action-btn" title="Редактировать">
                    ✏️
                  </a>
                  {#if page.status === 'draft'}
                    <button
                      onclick={() => publishPage(page.id)}
                      class="action-btn"
                      title="Опубликовать"
                    >
                      📤
                    </button>
                  {:else}
                    <button
                      onclick={() => unpublishPage(page.id)}
                      class="action-btn"
                      title="Снять с публикации"
                    >
                      📥
                    </button>
                  {/if}
                  <button
                    onclick={() => duplicatePage(page.id)}
                    class="action-btn"
                    title="Дублировать"
                  >
                    📋
                  </button>
                  <button
                    onclick={() => deletePage(page.id, page.title)}
                    class="action-btn action-delete"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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

        <span class="page-info">
          Страница {pagination.page} из {pagination.totalPages}
          ({pagination.total} записей)
        </span>

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
</div>

<style>
  .pages-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .search-box {
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .filter-select {
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
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

  .btn-secondary:hover {
    background: var(--color-background-tertiary);
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
    color: var(--color-text);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4);
    color: var(--color-text-muted);
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .pages-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-font-size-sm);
  }

  .pages-table th,
  .pages-table td {
    padding: var(--spacing-4);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .pages-table th {
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-muted);
    background: var(--color-background-secondary);
  }

  .pages-table tr:last-child td {
    border-bottom: none;
  }

  .pages-table tr:hover {
    background: var(--color-background-secondary);
  }

  /* Title cell */
  .title-cell {
    min-width: 200px;
  }

  .page-title {
    display: block;
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
    text-decoration: none;
  }

  .page-title:hover {
    color: var(--color-primary);
  }

  .page-description {
    display: block;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  /* Slug cell */
  .slug-cell {
    white-space: nowrap;
  }

  .slug-cell code {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-background-secondary);
    border-radius: var(--radius-sm);
    font-family: var(--font-font-family-mono);
    font-size: var(--font-font-size-xs);
  }

  .preview-link {
    display: inline-block;
    margin-left: var(--spacing-2);
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .preview-link:hover {
    color: var(--color-primary);
  }

  /* Status badge */
  .status-badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  .status-published {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .status-draft {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  /* Date cell */
  .date-cell {
    white-space: nowrap;
    color: var(--color-text-muted);
  }

  /* Actions */
  .actions-cell {
    white-space: nowrap;
  }

  .actions-menu {
    display: flex;
    gap: var(--spacing-1);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1rem;
    transition: background var(--transition-fast);
    text-decoration: none;
  }

  .action-btn:hover {
    background: var(--color-background-secondary);
  }

  .action-delete:hover {
    background: var(--color-error-light);
  }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
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
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }
</style>
