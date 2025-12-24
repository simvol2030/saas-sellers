<script lang="ts">
  /**
   * Categories List Component
   *
   * Interactive tree view for managing product categories
   * Features: hierarchical display, drag-drop reorder, inline edit
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    parentId: number | null;
    level: number;
    position: number;
    isActive: boolean;
    businessTypeHint: string | null;
    createdAt: string;
    updatedAt: string;
    _count?: {
      products: number;
      children: number;
    };
    children?: Category[];
  }

  let categories: Category[] = $state([]);
  let flatCategories: Category[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit modal
  let showModal = $state(false);
  let editingCategory = $state<Category | null>(null);
  let formData = $state({
    name: '',
    slug: '',
    description: '',
    parentId: null as number | null,
    isActive: true,
    businessTypeHint: '',
  });
  let saving = $state(false);

  // Business type hints
  const businessTypeHints = [
    { value: '', label: 'Не указано' },
    { value: 'clothing', label: 'Одежда' },
    { value: 'food', label: 'Еда' },
    { value: 'cafe', label: 'Кафе' },
    { value: 'pet', label: 'Зоотовары' },
    { value: 'household', label: 'Бытовые товары' },
  ];

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load categories
  async function loadCategories() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<{ categories: Category[]; tree: Category[] }>(
        '/api/admin/categories'
      );

      categories = data.tree || [];
      flatCategories = data.categories || [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки категорий';
    } finally {
      loading = false;
    }
  }

  // Flatten tree for display
  function flattenTree(nodes: Category[], result: Category[] = []): Category[] {
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        flattenTree(node.children, result);
      }
    }
    return result;
  }

  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[а-яё]/gi, (char) => {
        const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
        const en = 'abvgdeejzijklmnoprstufhcchshschyieyuya';
        const i = ru.indexOf(char.toLowerCase());
        return i >= 0 ? en[i] : char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Open modal for create/edit
  function openModal(category?: Category) {
    if (category) {
      editingCategory = category;
      formData = {
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parentId: category.parentId,
        isActive: category.isActive,
        businessTypeHint: category.businessTypeHint || '',
      };
    } else {
      editingCategory = null;
      formData = {
        name: '',
        slug: '',
        description: '',
        parentId: null,
        isActive: true,
        businessTypeHint: '',
      };
    }
    showModal = true;
  }

  // Close modal
  function closeModal() {
    showModal = false;
    editingCategory = null;
  }

  // Handle name change - auto-generate slug
  function handleNameChange() {
    if (!editingCategory) {
      formData.slug = generateSlug(formData.name);
    }
  }

  // Save category
  async function saveCategory() {
    if (!formData.name.trim()) {
      showNotification('error', 'Введите название категории');
      return;
    }

    saving = true;

    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || generateSlug(formData.name),
        description: formData.description.trim() || null,
        parentId: formData.parentId,
        isActive: formData.isActive,
        businessTypeHint: formData.businessTypeHint || null,
      };

      if (editingCategory) {
        await apiFetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Категория обновлена');
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Категория создана');
      }

      closeModal();
      loadCategories();
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Toggle active status
  async function toggleActive(category: Category) {
    try {
      await apiFetch(`/api/admin/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      showNotification('success', category.isActive ? 'Категория скрыта' : 'Категория активирована');
      loadCategories();
    } catch (e) {
      console.error('Toggle active error:', e);
      showNotification('error', 'Не удалось обновить статус');
    }
  }

  // Delete category
  async function deleteCategory(category: Category) {
    const hasChildren = category._count?.children && category._count.children > 0;
    const hasProducts = category._count?.products && category._count.products > 0;

    if (hasChildren) {
      showNotification('error', 'Нельзя удалить категорию с подкатегориями');
      return;
    }

    if (hasProducts) {
      if (!confirm(`Категория "${category.name}" содержит ${category._count?.products} товаров. Удалить?`)) {
        return;
      }
    } else if (!confirm(`Удалить категорию "${category.name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/api/admin/categories/${category.id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Категория удалена');
      loadCategories();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить категорию');
    }
  }

  // Get available parent options (exclude self and descendants)
  function getParentOptions(excludeId?: number): Category[] {
    if (!excludeId) return flatCategories.filter(c => c.level < 2);

    const excludeIds = new Set<number>();
    excludeIds.add(excludeId);

    // Find all descendants
    function addDescendants(parentId: number) {
      for (const cat of flatCategories) {
        if (cat.parentId === parentId && !excludeIds.has(cat.id)) {
          excludeIds.add(cat.id);
          addDescendants(cat.id);
        }
      }
    }
    addDescendants(excludeId);

    return flatCategories.filter(c => !excludeIds.has(c.id) && c.level < 2);
  }

  // Render tree recursively
  function renderCategory(category: Category, depth = 0) {
    const indent = depth * 24;
    return category;
  }

  // Initial load
  onMount(() => {
    loadCategories();
  });
</script>

<div class="categories-list">
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
    <h2 class="toolbar-title">Категории товаров</h2>
    <button onclick={() => openModal()} class="btn btn-primary">
      ➕ Добавить категорию
    </button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>❌ {error}</p>
      <button onclick={loadCategories} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if categories.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📁</div>
      <h3>Категории не найдены</h3>
      <p>Создайте первую категорию для организации товаров</p>
      <button onclick={() => openModal()} class="btn btn-primary">Добавить категорию</button>
    </div>
  {:else}
    <div class="categories-tree">
      {#each flattenTree(categories) as category (category.id)}
        <div
          class="category-item"
          class:inactive={!category.isActive}
          style={`padding-left: ${category.level * 24 + 16}px`}
        >
          <div class="category-info">
            {#if category.level > 0}
              <span class="hierarchy-indicator">↳</span>
            {/if}
            <span class="category-name">{category.name}</span>
            {#if category.businessTypeHint}
              <span class="type-hint">{category.businessTypeHint}</span>
            {/if}
            {#if category._count?.products}
              <span class="products-count">{category._count.products} товаров</span>
            {/if}
            {#if !category.isActive}
              <span class="inactive-badge">Скрыта</span>
            {/if}
          </div>
          <div class="category-actions">
            <button
              onclick={() => openModal(category)}
              class="action-btn"
              title="Редактировать"
            >
              ✏️
            </button>
            <button
              onclick={() => toggleActive(category)}
              class="action-btn"
              title={category.isActive ? 'Скрыть' : 'Показать'}
            >
              {category.isActive ? '👁️' : '👁️‍🗨️'}
            </button>
            <button
              onclick={() => deleteCategory(category)}
              class="action-btn action-delete"
              title="Удалить"
              disabled={category._count?.children && category._count.children > 0}
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" onclick={closeModal}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{editingCategory ? 'Редактирование категории' : 'Новая категория'}</h2>
          <button type="button" class="modal-close" onclick={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="cat-name">Название *</label>
            <input
              type="text"
              id="cat-name"
              bind:value={formData.name}
              oninput={handleNameChange}
              placeholder="Название категории"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="cat-slug">Slug (URL)</label>
            <input
              type="text"
              id="cat-slug"
              bind:value={formData.slug}
              placeholder="category-slug"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="cat-parent">Родительская категория</label>
            <select
              id="cat-parent"
              bind:value={formData.parentId}
              class="form-input"
            >
              <option value={null}>— Корневая категория —</option>
              {#each getParentOptions(editingCategory?.id) as cat (cat.id)}
                <option value={cat.id}>
                  {'—'.repeat(cat.level)} {cat.name}
                </option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="cat-description">Описание</label>
            <textarea
              id="cat-description"
              bind:value={formData.description}
              placeholder="Описание категории"
              class="form-input"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="cat-type">Тип бизнеса (подсказка)</label>
            <select
              id="cat-type"
              bind:value={formData.businessTypeHint}
              class="form-input"
            >
              {#each businessTypeHints as hint}
                <option value={hint.value}>{hint.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={formData.isActive}
              />
              <span>Активна (видна в каталоге)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={closeModal}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={saveCategory} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .categories-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .toolbar-title {
    margin: 0;
    font-size: var(--font-font-size-lg);
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

  .btn-secondary:hover {
    background: var(--color-background-tertiary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Categories tree */
  .categories-tree {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
    transition: background var(--transition-fast);
  }

  .category-item:last-child {
    border-bottom: none;
  }

  .category-item:hover {
    background: var(--color-background-secondary);
  }

  .category-item.inactive {
    opacity: 0.6;
  }

  .category-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    flex: 1;
  }

  .hierarchy-indicator {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .category-name {
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
  }

  .type-hint {
    padding: 2px 8px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
  }

  .products-count {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-xs);
  }

  .inactive-badge {
    padding: 2px 8px;
    background: var(--color-background-secondary);
    color: var(--color-text-muted);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
  }

  /* Actions */
  .category-actions {
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
  }

  .action-btn:hover {
    background: var(--color-background-secondary);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-delete:hover:not(:disabled) {
    background: var(--color-error-light);
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
    max-height: 90vh;
    overflow-y: auto;
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

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
  }

  .form-input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  textarea.form-input {
    resize: vertical;
    min-height: 80px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    cursor: pointer;
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
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
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
