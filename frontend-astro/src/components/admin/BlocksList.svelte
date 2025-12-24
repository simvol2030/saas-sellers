<script lang="ts">
  /**
   * Blocks List Component
   *
   * Management of reusable content blocks
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Block {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    category: string | null;
    thumbnail: string | null;
    sections: any[];
    usageCount: number;
    createdAt: string;
    updatedAt: string;
    author: {
      id: number;
      name: string | null;
      email: string;
    };
  }

  let blocks: Block[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let showCreateModal = $state(false);

  // New block form
  let newBlock = $state({
    name: '',
    slug: '',
    description: '',
    category: '',
  });

  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => notification = null, 5000);
  }

  async function loadBlocks() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<{ blocks: Block[] }>('/api/admin/blocks');
      blocks = data.blocks;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки блоков';
    } finally {
      loading = false;
    }
  }

  async function createBlock() {
    if (!newBlock.name || !newBlock.slug) {
      showNotification('error', 'Заполните название и slug');
      return;
    }

    try {
      await apiFetch('/api/admin/blocks', {
        method: 'POST',
        body: JSON.stringify({
          ...newBlock,
          sections: [],
        }),
      });
      showNotification('success', 'Блок создан');
      showCreateModal = false;
      newBlock = { name: '', slug: '', description: '', category: '' };
      loadBlocks();
    } catch (e: any) {
      showNotification('error', e.message || 'Ошибка создания блока');
    }
  }

  async function deleteBlock(id: number, name: string) {
    if (!confirm(`Удалить блок "${name}"? Это повлияет на все страницы, где он используется.`)) return;

    try {
      await apiFetch(`/api/admin/blocks/${id}`, { method: 'DELETE' });
      showNotification('success', 'Блок удалён');
      loadBlocks();
    } catch (e: any) {
      showNotification('error', e.message || 'Ошибка удаления');
    }
  }

  function generateSlug() {
    if (newBlock.slug || !newBlock.name) return;

    const cyrillicMap: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    };

    newBlock.slug = newBlock.name
      .toLowerCase()
      .split('')
      .map(char => cyrillicMap[char] ?? char)
      .join('')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  onMount(() => {
    loadBlocks();
  });
</script>

<div class="blocks-list">
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button type="button" class="notification-close" onclick={() => notification = null}>×</button>
    </div>
  {/if}

  <div class="toolbar">
    <h2 class="page-title">Повторяемые блоки</h2>
    <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
      ➕ Создать блок
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
      <button onclick={loadBlocks} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if blocks.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🧩</div>
      <h3>Блоки не найдены</h3>
      <p>Создайте повторяемый блок для использования на нескольких страницах</p>
      <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
        Создать блок
      </button>
    </div>
  {:else}
    <div class="blocks-grid">
      {#each blocks as block (block.id)}
        <div class="block-card">
          <div class="block-preview">
            {#if block.thumbnail}
              <img src={block.thumbnail} alt={block.name} />
            {:else}
              <div class="block-placeholder">🧩</div>
            {/if}
          </div>
          <div class="block-info">
            <h3 class="block-name">{block.name}</h3>
            {#if block.description}
              <p class="block-description">{block.description}</p>
            {/if}
            <div class="block-meta">
              <span class="block-sections">{block.sections?.length || 0} секций</span>
              <span class="block-usage">{block.usageCount || 0} использований</span>
            </div>
          </div>
          <div class="block-actions">
            <a href={`/admin/blocks/${block.id}`} class="btn btn-sm btn-outline">
              ✏️ Редактировать
            </a>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              onclick={() => deleteBlock(block.id, block.name)}
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
          <h2>Новый блок</h2>
          <button type="button" class="modal-close" onclick={() => showCreateModal = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="block-name">Название *</label>
            <input
              id="block-name"
              type="text"
              bind:value={newBlock.name}
              onblur={generateSlug}
              placeholder="Hero + Features комбо"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="block-slug">Slug *</label>
            <input
              id="block-slug"
              type="text"
              bind:value={newBlock.slug}
              placeholder="hero-features-combo"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="block-description">Описание</label>
            <textarea
              id="block-description"
              bind:value={newBlock.description}
              placeholder="Описание блока"
              class="form-textarea"
              rows="2"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="block-category">Категория</label>
            <input
              id="block-category"
              type="text"
              bind:value={newBlock.category}
              placeholder="Лендинги"
              class="form-input"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={createBlock}>
            Создать
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .blocks-list {
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

  /* Blocks Grid */
  .blocks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-4);
  }

  .block-card {
    display: flex;
    flex-direction: column;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: box-shadow var(--transition-fast);
  }

  .block-card:hover {
    box-shadow: var(--shadow-md);
  }

  .block-preview {
    height: 120px;
    background: var(--color-background-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .block-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .block-placeholder {
    font-size: 3rem;
    color: var(--color-text-muted);
  }

  .block-info {
    padding: var(--spacing-4);
    flex: 1;
  }

  .block-name {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .block-description {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .block-meta {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .block-actions {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .block-actions .btn {
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
  .form-textarea {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .form-textarea {
    resize: vertical;
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
