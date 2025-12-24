<script lang="ts">
  /**
   * Pages List Component
   *
   * Interactive table for managing landing pages
   * Features: pagination, search, filters, bulk actions
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Tag {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  }

  interface Page {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: 'draft' | 'published';
    publishedAt: string | null;
    prerender: boolean;
    parentId: number | null;
    level: number;
    order: number;
    path: string | null;
    createdAt: string;
    updatedAt: string;
    author: {
      id: number;
      name: string | null;
      email: string;
    };
    tags: Tag[];
    childrenCount: number;
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
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let showImportModal = $state(false);
  let importFiles: FileList | null = $state(null);
  let importing = $state(false);

  // Filters
  let search = $state('');
  let statusFilter = $state<'all' | 'draft' | 'published'>('all');
  let tagFilter = $state<string>('');
  let viewMode = $state<'flat' | 'tree'>('flat');
  let searchTimeout: number;

  // Available tags
  let availableTags: Tag[] = $state([]);

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load available tags
  async function loadTags() {
    try {
      const data = await apiFetch<{ tags: Tag[] }>('/api/admin/tags');
      availableTags = data.tags;
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  }

  // Load pages
  async function loadPages() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        status: statusFilter,
        sortBy: viewMode === 'tree' ? 'order' : 'updatedAt',
        sortOrder: viewMode === 'tree' ? 'asc' : 'desc',
      });

      if (search) {
        params.set('search', search);
      }

      if (tagFilter) {
        params.set('tag', tagFilter);
      }

      const data = await apiFetch<{ pages: Page[]; pagination: Pagination }>(
        `/api/admin/pages?${params}`
      );

      pages = data.pages;
      pagination = data.pagination;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки страниц';
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

  // Tag filter change
  function handleTagChange() {
    pagination.page = 1;
    loadPages();
  }

  // View mode change
  function handleViewModeChange() {
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
    try {
      await apiFetch(`/api/admin/pages/${id}/publish`, {
        method: 'POST',
      });
      showNotification('success', 'Страница опубликована');
      loadPages();
    } catch (e) {
      console.error('Publish error:', e);
      showNotification('error', 'Не удалось опубликовать страницу');
    }
  }

  async function unpublishPage(id: number) {
    try {
      await apiFetch(`/api/admin/pages/${id}/unpublish`, {
        method: 'POST',
      });
      showNotification('success', 'Страница снята с публикации');
      loadPages();
    } catch (e) {
      console.error('Unpublish error:', e);
      showNotification('error', 'Не удалось снять страницу с публикации');
    }
  }

  async function deletePage(id: number, title: string) {
    if (!confirm(`Удалить страницу "${title}"?`)) return;

    try {
      await apiFetch(`/api/admin/pages/${id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Страница удалена');
      loadPages();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить страницу');
    }
  }

  async function duplicatePage(id: number) {
    try {
      await apiFetch(`/api/admin/pages/${id}/duplicate`, {
        method: 'POST',
      });
      showNotification('success', 'Страница скопирована');
      loadPages();
    } catch (e) {
      console.error('Duplicate error:', e);
      showNotification('error', 'Не удалось скопировать страницу');
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

  // Export single page
  async function exportPage(id: number, slug: string) {
    try {
      const token = localStorage.getItem('accessToken');
      const siteId = localStorage.getItem('currentSiteId');

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
      };
      if (siteId) {
        headers['X-Site-ID'] = siteId;
      }

      const response = await fetch(`/api/admin/pages/${id}/export`, { headers });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.md`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification('success', 'Страница экспортирована');
    } catch (e) {
      console.error('Export error:', e);
      showNotification('error', 'Ошибка экспорта');
    }
  }

  // Export all pages
  async function exportAllPages() {
    try {
      const token = localStorage.getItem('accessToken');
      const siteId = localStorage.getItem('currentSiteId');

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
      };
      if (siteId) {
        headers['X-Site-ID'] = siteId;
      }

      const response = await fetch('/api/admin/pages/export-all', { headers });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pages-export.zip';
      a.click();
      URL.revokeObjectURL(url);

      showNotification('success', 'Все страницы экспортированы');
    } catch (e) {
      console.error('Export all error:', e);
      showNotification('error', 'Ошибка экспорта');
    }
  }

  // Import pages
  async function importPages() {
    if (!importFiles || importFiles.length === 0) {
      showNotification('error', 'Выберите файлы для импорта');
      return;
    }

    importing = true;

    try {
      const formData = new FormData();

      if (importFiles.length === 1) {
        formData.append('file', importFiles[0]);

        await apiFetch('/api/admin/pages/import', {
          method: 'POST',
          body: formData,
        });
      } else {
        for (let i = 0; i < importFiles.length; i++) {
          formData.append(`files[${i}]`, importFiles[i]);
        }

        await apiFetch('/api/admin/pages/import/batch', {
          method: 'POST',
          body: formData,
        });
      }

      showNotification('success', 'Страницы импортированы');
      showImportModal = false;
      importFiles = null;
      loadPages();
    } catch (e: any) {
      console.error('Import error:', e);
      showNotification('error', e.message || 'Ошибка импорта');
    } finally {
      importing = false;
    }
  }

  // Initial load
  onMount(() => {
    loadPages();
    loadTags();
  });
</script>

<div class="pages-list">
  <!-- Notification -->
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button
        type="button"
        class="notification-close"
        onclick={() => notification = null}
      >
        ×
      </button>
    </div>
  {/if}

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

      {#if availableTags.length > 0}
        <select bind:value={tagFilter} onchange={handleTagChange} class="filter-select">
          <option value="">Все теги</option>
          {#each availableTags as tag (tag.id)}
            <option value={tag.slug}>{tag.name}</option>
          {/each}
        </select>
      {/if}

      <div class="view-mode">
        <button
          type="button"
          class={`view-btn ${viewMode === 'flat' ? 'active' : ''}`}
          onclick={() => { viewMode = 'flat'; handleViewModeChange(); }}
          title="Список"
        >
          ☰
        </button>
        <button
          type="button"
          class={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
          onclick={() => { viewMode = 'tree'; handleViewModeChange(); }}
          title="Дерево"
        >
          🌲
        </button>
      </div>
    </div>

    <div class="toolbar-actions">
      <button type="button" class="btn btn-outline" onclick={() => showImportModal = true}>
        📥 Импорт
      </button>
      <button type="button" class="btn btn-outline" onclick={exportAllPages}>
        📤 Экспорт всех
      </button>
      <a href="/admin/pages/new" class="btn btn-primary">
        ➕ Создать страницу
      </a>
    </div>
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
            <th>Теги</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each pages as page (page.id)}
            <tr>
              <td class="title-cell">
                <div class="page-title-wrapper" style={`padding-left: ${page.level * 24}px`}>
                  {#if page.level > 0}
                    <span class="hierarchy-indicator">↳</span>
                  {/if}
                  <a href={`/admin/pages/${page.id}`} class="page-title">
                    {page.title}
                  </a>
                  {#if page.childrenCount > 0}
                    <span class="children-count" title="Дочерних страниц: {page.childrenCount}">
                      ({page.childrenCount})
                    </span>
                  {/if}
                </div>
                {#if page.description}
                  <span class="page-description" style={`padding-left: ${page.level * 24}px`}>{page.description}</span>
                {/if}
              </td>
              <td class="slug-cell">
                <code>{page.path || '/' + page.slug}</code>
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
              <td class="tags-cell">
                {#if page.tags && page.tags.length > 0}
                  <div class="tags-list">
                    {#each page.tags.slice(0, 3) as tag (tag.id)}
                      <span
                        class="tag-badge"
                        style={tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}` : ''}
                      >
                        {tag.name}
                      </span>
                    {/each}
                    {#if page.tags.length > 3}
                      <span class="tag-more">+{page.tags.length - 3}</span>
                    {/if}
                  </div>
                {:else}
                  <span class="no-tags">—</span>
                {/if}
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
                    onclick={() => exportPage(page.id, page.slug)}
                    class="action-btn"
                    title="Экспорт в MD"
                  >
                    💾
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

  <!-- Import Modal -->
  {#if showImportModal}
    <div class="modal-overlay" onclick={() => showImportModal = false}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Импорт страниц</h2>
          <button type="button" class="modal-close" onclick={() => showImportModal = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="import-dropzone">
            <input
              type="file"
              accept=".md"
              multiple
              onchange={(e) => importFiles = (e.target as HTMLInputElement).files}
              id="import-files"
              class="file-input"
            />
            <label for="import-files" class="dropzone-label">
              <div class="dropzone-icon">📁</div>
              <div class="dropzone-text">
                {#if importFiles && importFiles.length > 0}
                  Выбрано файлов: {importFiles.length}
                {:else}
                  Выберите .md файлы или перетащите сюда
                {/if}
              </div>
            </label>
          </div>
          <p class="import-hint">
            Поддерживаются Markdown файлы с YAML frontmatter
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => showImportModal = false}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={importPages} disabled={importing}>
            {importing ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
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

  .view-mode {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .view-btn {
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: var(--color-background);
    cursor: pointer;
    font-size: 1rem;
    transition: all var(--transition-fast);
  }

  .view-btn:hover {
    background: var(--color-background-secondary);
  }

  .view-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .view-btn:first-child {
    border-right: 1px solid var(--color-border);
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

  .page-title-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .hierarchy-indicator {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .page-title {
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
    text-decoration: none;
  }

  .page-title:hover {
    color: var(--color-primary);
  }

  .children-count {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
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

  /* Tags cell */
  .tags-cell {
    min-width: 120px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
  }

  .tag-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    background: var(--color-background-secondary);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .tag-more {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .no-tags {
    color: var(--color-text-muted);
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
    font-weight: var(--font-font-weight-medium);
    box-shadow: var(--shadow-xl);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 1.5rem;
    line-height: 1;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Toolbar actions */
  .toolbar-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-outline {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover {
    background: var(--color-background-secondary);
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

  /* Import dropzone */
  .import-dropzone {
    position: relative;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .dropzone-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-8);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .dropzone-label:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .dropzone-icon {
    font-size: 3rem;
  }

  .dropzone-text {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .import-hint {
    margin: var(--spacing-3) 0 0;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
