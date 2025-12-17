<script lang="ts">
  /**
   * Page Editor Component
   *
   * Full-featured editor for landing pages
   * Features:
   * - Page metadata (title, slug, description)
   * - SEO settings
   * - Section management with drag-and-drop
   * - Preview mode
   * - Autosave
   */

  import { onMount } from 'svelte';

  interface Section {
    id: string;
    type: string;
    className?: string;
    hidden?: boolean;
    [key: string]: any;
  }

  interface PageData {
    id?: number;
    slug: string;
    title: string;
    description: string;
    sections: Section[];
    headerConfig: any;
    footerConfig: any;
    hideHeader: boolean;
    hideFooter: boolean;
    metaTitle: string;
    metaDescription: string;
    ogImage: string;
    canonicalUrl: string;
    noindex: boolean;
    prerender: boolean;
    status?: 'draft' | 'published';
  }

  // Props
  interface Props {
    pageId?: number;
  }

  let { pageId }: Props = $props();

  // State
  let page: PageData = $state({
    slug: '',
    title: '',
    description: '',
    sections: [],
    headerConfig: null,
    footerConfig: null,
    hideHeader: false,
    hideFooter: false,
    metaTitle: '',
    metaDescription: '',
    ogImage: '',
    canonicalUrl: '',
    noindex: false,
    prerender: true,
  });

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let activeTab = $state<'content' | 'seo' | 'layout'>('content');
  let showSectionPicker = $state(false);
  let hasUnsavedChanges = $state(false);

  // Available section types
  const sectionTypes = [
    { type: 'hero', name: 'Hero', icon: '🦸', description: 'Главный баннер страницы' },
    { type: 'hero-split', name: 'Hero Split', icon: '↔️', description: 'Hero с изображением сбоку' },
    { type: 'hero-video', name: 'Hero Video', icon: '🎬', description: 'Hero с видео фоном' },
    { type: 'features', name: 'Features Grid', icon: '⭐', description: 'Сетка преимуществ' },
    { type: 'features-alt', name: 'Features Alt', icon: '🔲', description: 'Альтернативный стиль' },
    { type: 'features-icons', name: 'Features Icons', icon: '🎯', description: 'С иконками' },
    { type: 'pricing', name: 'Pricing', icon: '💰', description: 'Таблица цен' },
    { type: 'pricing-toggle', name: 'Pricing Toggle', icon: '🔄', description: 'С переключателем периода' },
    { type: 'testimonials', name: 'Testimonials', icon: '💬', description: 'Отзывы клиентов' },
    { type: 'testimonials-carousel', name: 'Testimonials Carousel', icon: '🎠', description: 'Карусель отзывов' },
    { type: 'cta', name: 'CTA', icon: '📢', description: 'Призыв к действию' },
    { type: 'cta-split', name: 'CTA Split', icon: '📋', description: 'CTA с формой' },
    { type: 'faq', name: 'FAQ', icon: '❓', description: 'Часто задаваемые вопросы' },
    { type: 'faq-columns', name: 'FAQ Columns', icon: '📊', description: 'FAQ в колонках' },
    { type: 'contact', name: 'Contact', icon: '✉️', description: 'Контактная форма' },
    { type: 'contact-map', name: 'Contact Map', icon: '🗺️', description: 'Контакты с картой' },
    { type: 'gallery', name: 'Gallery', icon: '🖼️', description: 'Галерея изображений' },
    { type: 'gallery-masonry', name: 'Gallery Masonry', icon: '🧱', description: 'Masonry галерея' },
    { type: 'team', name: 'Team', icon: '👥', description: 'Команда' },
    { type: 'stats', name: 'Stats', icon: '📈', description: 'Статистика в цифрах' },
    { type: 'logos', name: 'Logos', icon: '🏢', description: 'Логотипы партнёров' },
    { type: 'social-feed', name: 'Social Feed', icon: '📱', description: 'Социальная лента' },
    { type: 'social-proof', name: 'Social Proof', icon: '✅', description: 'Социальные доказательства' },
  ];

  // Load page data
  async function loadPage() {
    if (!pageId) {
      loading = false;
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        if (res.status === 404) {
          error = 'Страница не найдена';
          return;
        }
        throw new Error('Failed to load page');
      }

      const data = await res.json();
      page = {
        ...data.page,
        sections: data.page.sections || [],
        headerConfig: data.page.headerConfig || null,
        footerConfig: data.page.footerConfig || null,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  // Save page
  async function savePage() {
    saving = true;
    error = null;
    success = null;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      const url = pageId ? `/api/admin/pages/${pageId}` : '/api/admin/pages';
      const method = pageId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(page),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'SLUG_EXISTS') {
          error = 'Страница с таким slug уже существует';
        } else {
          error = data.error || 'Ошибка сохранения';
        }
        return;
      }

      success = pageId ? 'Изменения сохранены' : 'Страница создана';
      hasUnsavedChanges = false;

      // Redirect to edit page if creating new
      if (!pageId && data.page?.id) {
        setTimeout(() => {
          window.location.href = `/admin/pages/${data.page.id}`;
        }, 500);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      saving = false;
    }
  }

  // Generate slug from title
  function generateSlug() {
    if (page.slug || !page.title) return;

    page.slug = page.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);
  }

  // Add section
  function addSection(type: string) {
    const id = `${type}-${Date.now()}`;
    const section: Section = {
      id,
      type,
      hidden: false,
    };

    // Add default content based on type
    switch (type) {
      case 'hero':
        section.title = 'Заголовок';
        section.subtitle = 'Подзаголовок';
        section.ctaText = 'Начать';
        section.ctaLink = '#';
        break;
      case 'features':
        section.title = 'Наши преимущества';
        section.items = [
          { title: 'Преимущество 1', description: 'Описание' },
          { title: 'Преимущество 2', description: 'Описание' },
          { title: 'Преимущество 3', description: 'Описание' },
        ];
        break;
      case 'cta':
        section.title = 'Готовы начать?';
        section.description = 'Присоединяйтесь к нам сегодня';
        section.buttonText = 'Начать бесплатно';
        section.buttonLink = '#';
        break;
    }

    page.sections = [...page.sections, section];
    showSectionPicker = false;
    hasUnsavedChanges = true;
  }

  // Remove section
  function removeSection(index: number) {
    if (!confirm('Удалить секцию?')) return;
    page.sections = page.sections.filter((_, i) => i !== index);
    hasUnsavedChanges = true;
  }

  // Move section
  function moveSection(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= page.sections.length) return;

    const sections = [...page.sections];
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    page.sections = sections;
    hasUnsavedChanges = true;
  }

  // Toggle section visibility
  function toggleSection(index: number) {
    page.sections[index].hidden = !page.sections[index].hidden;
    hasUnsavedChanges = true;
  }

  // Publish/Unpublish
  async function togglePublish() {
    if (!pageId) return;

    const token = localStorage.getItem('accessToken');
    const action = page.status === 'published' ? 'unpublish' : 'publish';

    try {
      const res = await fetch(`/api/admin/pages/${pageId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        page.status = data.page.status;
        success = action === 'publish' ? 'Страница опубликована' : 'Страница снята с публикации';
      }
    } catch (e) {
      error = 'Ошибка изменения статуса';
    }
  }

  // Track changes
  function markChanged() {
    hasUnsavedChanges = true;
    success = null;
  }

  // Initial load
  onMount(() => {
    loadPage();

    // Warn before leaving with unsaved changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<div class="page-editor">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error && !page.title}
    <div class="error-state">
      <p>❌ {error}</p>
      <a href="/admin/pages" class="btn btn-secondary">← К списку страниц</a>
    </div>
  {:else}
    <!-- Header -->
    <div class="editor-header">
      <div class="header-left">
        <a href="/admin/pages" class="back-link">← Страницы</a>
        <h1 class="editor-title">{pageId ? 'Редактирование' : 'Новая страница'}</h1>
        {#if page.status}
          <span class={`status-badge status-${page.status}`}>
            {page.status === 'published' ? '✅ Опубликовано' : '📝 Черновик'}
          </span>
        {/if}
      </div>
      <div class="header-actions">
        {#if pageId && page.status}
          <button
            type="button"
            onclick={togglePublish}
            class="btn btn-outline"
          >
            {page.status === 'published' ? '📥 Снять' : '📤 Опубликовать'}
          </button>
        {/if}
        <button
          type="button"
          onclick={savePage}
          disabled={saving}
          class="btn btn-primary"
        >
          {saving ? 'Сохранение...' : '💾 Сохранить'}
        </button>
      </div>
    </div>

    <!-- Messages -->
    {#if error}
      <div class="message error">{error}</div>
    {/if}
    {#if success}
      <div class="message success">{success}</div>
    {/if}
    {#if hasUnsavedChanges}
      <div class="message warning">Есть несохранённые изменения</div>
    {/if}

    <!-- Tabs -->
    <div class="tabs">
      <button
        type="button"
        class={`tab ${activeTab === 'content' ? 'active' : ''}`}
        onclick={() => activeTab = 'content'}
      >
        📄 Контент
      </button>
      <button
        type="button"
        class={`tab ${activeTab === 'seo' ? 'active' : ''}`}
        onclick={() => activeTab = 'seo'}
      >
        🔍 SEO
      </button>
      <button
        type="button"
        class={`tab ${activeTab === 'layout' ? 'active' : ''}`}
        onclick={() => activeTab = 'layout'}
      >
        🎨 Макет
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'content'}
        <!-- Basic Info -->
        <div class="form-section">
          <h2 class="section-title">Основная информация</h2>

          <div class="form-grid">
            <div class="form-group">
              <label for="title">Название *</label>
              <input
                id="title"
                type="text"
                bind:value={page.title}
                onblur={generateSlug}
                oninput={markChanged}
                placeholder="Название страницы"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="slug">Slug *</label>
              <div class="slug-input">
                <span class="slug-prefix">/</span>
                <input
                  id="slug"
                  type="text"
                  bind:value={page.slug}
                  oninput={markChanged}
                  placeholder="url-slug"
                  class="form-input"
                  pattern="^[a-z0-9-]+$"
                />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="description">Описание</label>
            <textarea
              id="description"
              bind:value={page.description}
              oninput={markChanged}
              placeholder="Краткое описание страницы"
              class="form-textarea"
              rows="2"
            ></textarea>
          </div>
        </div>

        <!-- Sections -->
        <div class="form-section">
          <div class="section-header">
            <h2 class="section-title">Секции ({page.sections.length})</h2>
            <button
              type="button"
              onclick={() => showSectionPicker = true}
              class="btn btn-primary btn-sm"
            >
              ➕ Добавить секцию
            </button>
          </div>

          {#if page.sections.length === 0}
            <div class="empty-sections">
              <p>Нет секций. Добавьте первую секцию для страницы.</p>
            </div>
          {:else}
            <div class="sections-list">
              {#each page.sections as section, index (section.id)}
                <div class="section-item" class:hidden={section.hidden}>
                  <div class="section-drag">⋮⋮</div>
                  <div class="section-info">
                    <span class="section-type">
                      {sectionTypes.find(s => s.type === section.type)?.icon || '📦'}
                      {sectionTypes.find(s => s.type === section.type)?.name || section.type}
                    </span>
                    {#if section.title}
                      <span class="section-preview">{section.title}</span>
                    {/if}
                  </div>
                  <div class="section-actions">
                    <button
                      type="button"
                      onclick={() => moveSection(index, 'up')}
                      disabled={index === 0}
                      class="action-btn"
                      title="Вверх"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onclick={() => moveSection(index, 'down')}
                      disabled={index === page.sections.length - 1}
                      class="action-btn"
                      title="Вниз"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onclick={() => toggleSection(index)}
                      class="action-btn"
                      title={section.hidden ? 'Показать' : 'Скрыть'}
                    >
                      {section.hidden ? '👁️' : '🙈'}
                    </button>
                    <a
                      href={`/admin/pages/${pageId}/sections/${index}`}
                      class="action-btn"
                      title="Редактировать"
                    >
                      ✏️
                    </a>
                    <button
                      type="button"
                      onclick={() => removeSection(index)}
                      class="action-btn action-delete"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'seo'}
        <div class="form-section">
          <h2 class="section-title">SEO настройки</h2>

          <div class="form-group">
            <label for="metaTitle">Meta Title</label>
            <input
              id="metaTitle"
              type="text"
              bind:value={page.metaTitle}
              oninput={markChanged}
              placeholder={page.title || 'Заголовок для поисковиков'}
              class="form-input"
              maxlength="100"
            />
            <span class="form-hint">{(page.metaTitle || '').length}/100</span>
          </div>

          <div class="form-group">
            <label for="metaDescription">Meta Description</label>
            <textarea
              id="metaDescription"
              bind:value={page.metaDescription}
              oninput={markChanged}
              placeholder="Описание для поисковиков"
              class="form-textarea"
              rows="3"
              maxlength="200"
            ></textarea>
            <span class="form-hint">{(page.metaDescription || '').length}/200</span>
          </div>

          <div class="form-group">
            <label for="ogImage">OG Image URL</label>
            <input
              id="ogImage"
              type="text"
              bind:value={page.ogImage}
              oninput={markChanged}
              placeholder="https://example.com/image.jpg"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="canonicalUrl">Canonical URL</label>
            <input
              id="canonicalUrl"
              type="text"
              bind:value={page.canonicalUrl}
              oninput={markChanged}
              placeholder="https://example.com/page"
              class="form-input"
            />
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                bind:checked={page.noindex}
                onchange={markChanged}
              />
              <span>Noindex (скрыть от поисковиков)</span>
            </label>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                bind:checked={page.prerender}
                onchange={markChanged}
              />
              <span>Prerender (статическая генерация)</span>
            </label>
          </div>
        </div>

      {:else if activeTab === 'layout'}
        <div class="form-section">
          <h2 class="section-title">Настройки макета</h2>

          <div class="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                bind:checked={page.hideHeader}
                onchange={markChanged}
              />
              <span>Скрыть шапку</span>
            </label>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                bind:checked={page.hideFooter}
                onchange={markChanged}
              />
              <span>Скрыть подвал</span>
            </label>
          </div>

          <p class="form-hint">
            Настройка кастомных Header/Footer будет доступна в Phase 7.3
          </p>
        </div>
      {/if}
    </div>

    <!-- Section Picker Modal -->
    {#if showSectionPicker}
      <div class="modal-overlay" onclick={() => showSectionPicker = false}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Добавить секцию</h2>
            <button
              type="button"
              onclick={() => showSectionPicker = false}
              class="modal-close"
            >
              ✕
            </button>
          </div>
          <div class="section-picker">
            {#each sectionTypes as sectionType}
              <button
                type="button"
                class="section-option"
                onclick={() => addSection(sectionType.type)}
              >
                <span class="option-icon">{sectionType.icon}</span>
                <span class="option-name">{sectionType.name}</span>
                <span class="option-desc">{sectionType.description}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-editor {
    max-width: 900px;
  }

  /* Loading & Error */
  .loading,
  .error-state {
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
    margin-bottom: var(--spacing-4);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Header */
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
  }

  .back-link {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-font-size-sm);
  }

  .back-link:hover {
    color: var(--color-primary);
  }

  .editor-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
    font-weight: var(--font-font-weight-semibold);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-3);
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

  /* Messages */
  .message {
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-4);
    font-size: var(--font-font-size-sm);
  }

  .message.error {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .message.success {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .message.warning {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  /* Buttons */
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

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-font-size-xs);
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: var(--spacing-1);
    margin-bottom: var(--spacing-6);
    background: var(--color-background-secondary);
    padding: var(--spacing-1);
    border-radius: var(--radius-lg);
  }

  .tab {
    flex: 1;
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    background: var(--color-background);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }

  /* Form */
  .form-section {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    margin-bottom: var(--spacing-6);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-4);
  }

  .section-title {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-semibold);
  }

  .section-header .section-title {
    margin-bottom: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-4);
  }

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
    color: var(--color-text);
  }

  .form-input,
  .form-textarea,
  .form-select {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    transition: border-color var(--transition-fast);
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-hint {
    display: block;
    margin-top: var(--spacing-1);
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .slug-input {
    display: flex;
    align-items: center;
  }

  .slug-prefix {
    padding: var(--spacing-3) var(--spacing-3);
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    color: var(--color-text-muted);
    font-family: var(--font-font-family-mono);
  }

  .slug-input .form-input {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    font-family: var(--font-font-family-mono);
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  /* Sections List */
  .empty-sections {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
  }

  .sections-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .section-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .section-item.hidden {
    opacity: 0.5;
  }

  .section-drag {
    color: var(--color-text-muted);
    cursor: grab;
  }

  .section-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .section-type {
    font-weight: var(--font-font-weight-medium);
  }

  .section-preview {
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-actions {
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
    font-size: 0.9rem;
    transition: background var(--transition-fast);
    text-decoration: none;
    color: inherit;
  }

  .action-btn:hover {
    background: var(--color-background);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-delete:hover {
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
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
    color: var(--color-text);
  }

  .section-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-3);
    padding: var(--spacing-6);
    overflow-y: auto;
  }

  .section-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    cursor: pointer;
    text-align: center;
    transition: all var(--transition-fast);
  }

  .section-option:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .option-icon {
    font-size: 2rem;
  }

  .option-name {
    font-weight: var(--font-font-weight-medium);
    font-size: var(--font-font-size-sm);
  }

  .option-desc {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }
</style>
