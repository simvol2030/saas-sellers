<script lang="ts">
  /**
   * Section Editor Component
   *
   * Dynamic editor for landing page sections
   * Renders appropriate form fields based on section type
   */

  import { onMount } from 'svelte';

  interface SectionItem {
    title?: string;
    description?: string;
    icon?: string;
    image?: string;
    link?: string;
    price?: string;
    features?: string[];
    name?: string;
    role?: string;
    avatar?: string;
    quote?: string;
    rating?: number;
    question?: string;
    answer?: string;
    [key: string]: any;
  }

  interface Section {
    id: string;
    type: string;
    className?: string;
    hidden?: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
    ctaLink?: string;
    secondaryCtaText?: string;
    secondaryCtaLink?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    image?: string;
    imagePosition?: 'left' | 'right';
    items?: SectionItem[];
    columns?: number;
    variant?: string;
    [key: string]: any;
  }

  // Props
  interface Props {
    pageId: number;
    sectionIndex: number;
  }

  let { pageId, sectionIndex }: Props = $props();

  // State
  let section: Section | null = $state(null);
  let pageTitle = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Section type metadata
  const sectionMeta: Record<string, { name: string; icon: string; fields: string[] }> = {
    'hero': {
      name: 'Hero',
      icon: '🦸',
      fields: ['title', 'subtitle', 'description', 'ctaText', 'ctaLink', 'secondaryCtaText', 'secondaryCtaLink', 'backgroundImage']
    },
    'hero-split': {
      name: 'Hero Split',
      icon: '↔️',
      fields: ['title', 'subtitle', 'description', 'ctaText', 'ctaLink', 'image', 'imagePosition']
    },
    'hero-video': {
      name: 'Hero Video',
      icon: '🎬',
      fields: ['title', 'subtitle', 'ctaText', 'ctaLink', 'backgroundVideo']
    },
    'features': {
      name: 'Features Grid',
      icon: '⭐',
      fields: ['title', 'subtitle', 'columns', 'items']
    },
    'features-alt': {
      name: 'Features Alt',
      icon: '🔲',
      fields: ['title', 'subtitle', 'items']
    },
    'features-icons': {
      name: 'Features Icons',
      icon: '🎯',
      fields: ['title', 'subtitle', 'columns', 'items']
    },
    'pricing': {
      name: 'Pricing',
      icon: '💰',
      fields: ['title', 'subtitle', 'items']
    },
    'pricing-toggle': {
      name: 'Pricing Toggle',
      icon: '🔄',
      fields: ['title', 'subtitle', 'items']
    },
    'testimonials': {
      name: 'Testimonials',
      icon: '💬',
      fields: ['title', 'subtitle', 'items']
    },
    'testimonials-carousel': {
      name: 'Testimonials Carousel',
      icon: '🎠',
      fields: ['title', 'subtitle', 'items']
    },
    'cta': {
      name: 'CTA',
      icon: '📢',
      fields: ['title', 'description', 'ctaText', 'ctaLink', 'backgroundImage']
    },
    'cta-split': {
      name: 'CTA Split',
      icon: '📋',
      fields: ['title', 'description', 'ctaText', 'ctaLink', 'image']
    },
    'faq': {
      name: 'FAQ',
      icon: '❓',
      fields: ['title', 'subtitle', 'items']
    },
    'faq-columns': {
      name: 'FAQ Columns',
      icon: '📊',
      fields: ['title', 'subtitle', 'columns', 'items']
    },
    'contact': {
      name: 'Contact',
      icon: '✉️',
      fields: ['title', 'subtitle', 'description']
    },
    'contact-map': {
      name: 'Contact Map',
      icon: '🗺️',
      fields: ['title', 'subtitle', 'description', 'mapUrl']
    },
    'gallery': {
      name: 'Gallery',
      icon: '🖼️',
      fields: ['title', 'subtitle', 'columns', 'items']
    },
    'gallery-masonry': {
      name: 'Gallery Masonry',
      icon: '🧱',
      fields: ['title', 'subtitle', 'items']
    },
    'team': {
      name: 'Team',
      icon: '👥',
      fields: ['title', 'subtitle', 'columns', 'items']
    },
    'stats': {
      name: 'Stats',
      icon: '📈',
      fields: ['title', 'subtitle', 'items']
    },
    'logos': {
      name: 'Logos',
      icon: '🏢',
      fields: ['title', 'subtitle', 'items']
    },
    'social-feed': {
      name: 'Social Feed',
      icon: '📱',
      fields: ['title', 'subtitle', 'items']
    },
    'social-proof': {
      name: 'Social Proof',
      icon: '✅',
      fields: ['title', 'subtitle', 'items']
    },
  };

  // Field labels
  const fieldLabels: Record<string, string> = {
    title: 'Заголовок',
    subtitle: 'Подзаголовок',
    description: 'Описание',
    ctaText: 'Текст кнопки',
    ctaLink: 'Ссылка кнопки',
    secondaryCtaText: 'Вторая кнопка (текст)',
    secondaryCtaLink: 'Вторая кнопка (ссылка)',
    backgroundImage: 'Фоновое изображение (URL)',
    backgroundVideo: 'Фоновое видео (URL)',
    image: 'Изображение (URL)',
    imagePosition: 'Позиция изображения',
    columns: 'Колонок',
    mapUrl: 'URL карты',
    className: 'CSS класс',
  };

  // Load section data
  async function loadSection() {
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
      pageTitle = data.page.title;

      if (!data.page.sections || !data.page.sections[sectionIndex]) {
        error = 'Секция не найдена';
        return;
      }

      section = data.page.sections[sectionIndex];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  // Save section
  async function saveSection() {
    if (!section) return;

    saving = true;
    error = null;
    success = null;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    try {
      // First get current page data
      const getRes = await fetch(`/api/admin/pages/${pageId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!getRes.ok) throw new Error('Failed to load page');

      const pageData = await getRes.json();
      const sections = pageData.page.sections;
      sections[sectionIndex] = section;

      // Update page with modified sections
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sections }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      success = 'Секция сохранена';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      saving = false;
    }
  }

  // Add item to array field
  function addItem() {
    if (!section) return;

    const type = section.type;
    let newItem: SectionItem = {};

    // Default item structure based on section type
    if (type.includes('pricing')) {
      newItem = { title: 'План', price: '$0', description: '', features: ['Функция 1'] };
    } else if (type.includes('testimonial')) {
      newItem = { name: 'Имя', role: 'Должность', quote: 'Отзыв...', avatar: '', rating: 5 };
    } else if (type.includes('faq')) {
      newItem = { question: 'Вопрос?', answer: 'Ответ...' };
    } else if (type.includes('team')) {
      newItem = { name: 'Имя', role: 'Должность', avatar: '', description: '' };
    } else if (type.includes('gallery') || type.includes('logos')) {
      newItem = { image: '', title: '', link: '' };
    } else if (type.includes('stats')) {
      newItem = { title: 'Показатель', value: '100+', description: '' };
    } else if (type.includes('social')) {
      newItem = { title: '', image: '', link: '' };
    } else {
      newItem = { title: 'Элемент', description: '', icon: '' };
    }

    section.items = [...(section.items || []), newItem];
  }

  // Remove item from array
  function removeItem(index: number) {
    if (!section?.items) return;
    section.items = section.items.filter((_, i) => i !== index);
  }

  // Move item in array
  function moveItem(index: number, direction: 'up' | 'down') {
    if (!section?.items) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= section.items.length) return;

    const items = [...section.items];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    section.items = items;
  }

  // Add feature to pricing item
  function addFeature(itemIndex: number) {
    if (!section?.items?.[itemIndex]) return;
    const item = section.items[itemIndex];
    item.features = [...(item.features || []), 'Новая функция'];
    section.items = [...section.items];
  }

  // Remove feature from pricing item
  function removeFeature(itemIndex: number, featureIndex: number) {
    if (!section?.items?.[itemIndex]?.features) return;
    section.items[itemIndex].features = section.items[itemIndex].features!.filter((_, i) => i !== featureIndex);
    section.items = [...section.items];
  }

  // Get meta for current section
  function getMeta() {
    if (!section) return null;
    return sectionMeta[section.type] || { name: section.type, icon: '📦', fields: ['title', 'description'] };
  }

  // Check if field should be shown
  function hasField(field: string): boolean {
    const meta = getMeta();
    return meta?.fields.includes(field) || false;
  }

  // Initial load
  onMount(() => {
    loadSection();
  });
</script>

<div class="section-editor">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error && !section}
    <div class="error-state">
      <p>❌ {error}</p>
      <a href={`/admin/pages/${pageId}`} class="btn btn-secondary">← К странице</a>
    </div>
  {:else if section}
    <!-- Header -->
    <div class="editor-header">
      <div class="header-left">
        <a href={`/admin/pages/${pageId}`} class="back-link">← {pageTitle}</a>
        <h1 class="editor-title">
          {getMeta()?.icon} {getMeta()?.name}
          <span class="section-index">#{sectionIndex + 1}</span>
        </h1>
      </div>
      <div class="header-actions">
        <button
          type="button"
          onclick={saveSection}
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

    <!-- Form -->
    <div class="form-section">
      <h2 class="section-title">Основные настройки</h2>

      <!-- Common fields -->
      {#if hasField('title')}
        <div class="form-group">
          <label for="title">{fieldLabels.title}</label>
          <input
            id="title"
            type="text"
            bind:value={section.title}
            placeholder="Введите заголовок"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('subtitle')}
        <div class="form-group">
          <label for="subtitle">{fieldLabels.subtitle}</label>
          <input
            id="subtitle"
            type="text"
            bind:value={section.subtitle}
            placeholder="Введите подзаголовок"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('description')}
        <div class="form-group">
          <label for="description">{fieldLabels.description}</label>
          <textarea
            id="description"
            bind:value={section.description}
            placeholder="Введите описание"
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>
      {/if}

      <!-- CTA fields -->
      {#if hasField('ctaText') || hasField('ctaLink')}
        <div class="form-grid">
          {#if hasField('ctaText')}
            <div class="form-group">
              <label for="ctaText">{fieldLabels.ctaText}</label>
              <input
                id="ctaText"
                type="text"
                bind:value={section.ctaText}
                placeholder="Начать"
                class="form-input"
              />
            </div>
          {/if}
          {#if hasField('ctaLink')}
            <div class="form-group">
              <label for="ctaLink">{fieldLabels.ctaLink}</label>
              <input
                id="ctaLink"
                type="text"
                bind:value={section.ctaLink}
                placeholder="#contact"
                class="form-input"
              />
            </div>
          {/if}
        </div>
      {/if}

      {#if hasField('secondaryCtaText') || hasField('secondaryCtaLink')}
        <div class="form-grid">
          {#if hasField('secondaryCtaText')}
            <div class="form-group">
              <label for="secondaryCtaText">{fieldLabels.secondaryCtaText}</label>
              <input
                id="secondaryCtaText"
                type="text"
                bind:value={section.secondaryCtaText}
                placeholder="Узнать больше"
                class="form-input"
              />
            </div>
          {/if}
          {#if hasField('secondaryCtaLink')}
            <div class="form-group">
              <label for="secondaryCtaLink">{fieldLabels.secondaryCtaLink}</label>
              <input
                id="secondaryCtaLink"
                type="text"
                bind:value={section.secondaryCtaLink}
                placeholder="#features"
                class="form-input"
              />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Media fields -->
      {#if hasField('backgroundImage')}
        <div class="form-group">
          <label for="backgroundImage">{fieldLabels.backgroundImage}</label>
          <input
            id="backgroundImage"
            type="text"
            bind:value={section.backgroundImage}
            placeholder="https://example.com/image.jpg"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('backgroundVideo')}
        <div class="form-group">
          <label for="backgroundVideo">{fieldLabels.backgroundVideo}</label>
          <input
            id="backgroundVideo"
            type="text"
            bind:value={section.backgroundVideo}
            placeholder="https://example.com/video.mp4"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('image')}
        <div class="form-group">
          <label for="image">{fieldLabels.image}</label>
          <input
            id="image"
            type="text"
            bind:value={section.image}
            placeholder="https://example.com/image.jpg"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('imagePosition')}
        <div class="form-group">
          <label for="imagePosition">{fieldLabels.imagePosition}</label>
          <select id="imagePosition" bind:value={section.imagePosition} class="form-select">
            <option value="left">Слева</option>
            <option value="right">Справа</option>
          </select>
        </div>
      {/if}

      {#if hasField('mapUrl')}
        <div class="form-group">
          <label for="mapUrl">{fieldLabels.mapUrl}</label>
          <input
            id="mapUrl"
            type="text"
            bind:value={section.mapUrl}
            placeholder="https://maps.google.com/..."
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('columns')}
        <div class="form-group">
          <label for="columns">{fieldLabels.columns}</label>
          <select id="columns" bind:value={section.columns} class="form-select">
            <option value={2}>2 колонки</option>
            <option value={3}>3 колонки</option>
            <option value={4}>4 колонки</option>
          </select>
        </div>
      {/if}

      <!-- CSS Class -->
      <div class="form-group">
        <label for="className">{fieldLabels.className}</label>
        <input
          id="className"
          type="text"
          bind:value={section.className}
          placeholder="custom-class"
          class="form-input"
        />
        <span class="form-hint">Дополнительный CSS класс для кастомизации</span>
      </div>
    </div>

    <!-- Items -->
    {#if hasField('items')}
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">Элементы ({section.items?.length || 0})</h2>
          <button type="button" onclick={addItem} class="btn btn-primary btn-sm">
            ➕ Добавить
          </button>
        </div>

        {#if !section.items?.length}
          <div class="empty-items">
            <p>Нет элементов. Добавьте первый элемент.</p>
          </div>
        {:else}
          <div class="items-list">
            {#each section.items as item, index (index)}
              <div class="item-card">
                <div class="item-header">
                  <span class="item-number">#{index + 1}</span>
                  <div class="item-actions">
                    <button
                      type="button"
                      onclick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      class="action-btn"
                      title="Вверх"
                    >↑</button>
                    <button
                      type="button"
                      onclick={() => moveItem(index, 'down')}
                      disabled={index === (section.items?.length || 0) - 1}
                      class="action-btn"
                      title="Вниз"
                    >↓</button>
                    <button
                      type="button"
                      onclick={() => removeItem(index)}
                      class="action-btn action-delete"
                      title="Удалить"
                    >🗑️</button>
                  </div>
                </div>

                <div class="item-fields">
                  <!-- Different fields based on section type -->
                  {#if section.type.includes('pricing')}
                    <!-- Pricing item -->
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Название плана</label>
                        <input type="text" bind:value={item.title} class="form-input" />
                      </div>
                      <div class="form-group">
                        <label>Цена</label>
                        <input type="text" bind:value={item.price} class="form-input" placeholder="$99/мес" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Описание</label>
                      <input type="text" bind:value={item.description} class="form-input" />
                    </div>
                    <div class="form-group">
                      <label>Функции</label>
                      <div class="features-list">
                        {#each item.features || [] as feature, fi}
                          <div class="feature-item">
                            <input type="text" bind:value={item.features[fi]} class="form-input" />
                            <button type="button" onclick={() => removeFeature(index, fi)} class="action-btn action-delete">✕</button>
                          </div>
                        {/each}
                        <button type="button" onclick={() => addFeature(index)} class="btn btn-secondary btn-sm">+ Функция</button>
                      </div>
                    </div>

                  {:else if section.type.includes('testimonial')}
                    <!-- Testimonial item -->
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Имя</label>
                        <input type="text" bind:value={item.name} class="form-input" />
                      </div>
                      <div class="form-group">
                        <label>Должность</label>
                        <input type="text" bind:value={item.role} class="form-input" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Отзыв</label>
                      <textarea bind:value={item.quote} class="form-textarea" rows="3"></textarea>
                    </div>
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Аватар (URL)</label>
                        <input type="text" bind:value={item.avatar} class="form-input" />
                      </div>
                      <div class="form-group">
                        <label>Рейтинг (1-5)</label>
                        <input type="number" bind:value={item.rating} min="1" max="5" class="form-input" />
                      </div>
                    </div>

                  {:else if section.type.includes('faq')}
                    <!-- FAQ item -->
                    <div class="form-group">
                      <label>Вопрос</label>
                      <input type="text" bind:value={item.question} class="form-input" />
                    </div>
                    <div class="form-group">
                      <label>Ответ</label>
                      <textarea bind:value={item.answer} class="form-textarea" rows="3"></textarea>
                    </div>

                  {:else if section.type.includes('team')}
                    <!-- Team item -->
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Имя</label>
                        <input type="text" bind:value={item.name} class="form-input" />
                      </div>
                      <div class="form-group">
                        <label>Должность</label>
                        <input type="text" bind:value={item.role} class="form-input" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Фото (URL)</label>
                      <input type="text" bind:value={item.avatar} class="form-input" />
                    </div>
                    <div class="form-group">
                      <label>Описание</label>
                      <textarea bind:value={item.description} class="form-textarea" rows="2"></textarea>
                    </div>

                  {:else if section.type.includes('stats')}
                    <!-- Stats item -->
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Значение</label>
                        <input type="text" bind:value={item.value} class="form-input" placeholder="100+" />
                      </div>
                      <div class="form-group">
                        <label>Название</label>
                        <input type="text" bind:value={item.title} class="form-input" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Описание</label>
                      <input type="text" bind:value={item.description} class="form-input" />
                    </div>

                  {:else if section.type.includes('gallery') || section.type.includes('logos') || section.type.includes('social')}
                    <!-- Gallery/Logo/Social item -->
                    <div class="form-group">
                      <label>Изображение (URL)</label>
                      <input type="text" bind:value={item.image} class="form-input" />
                    </div>
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Название</label>
                        <input type="text" bind:value={item.title} class="form-input" />
                      </div>
                      <div class="form-group">
                        <label>Ссылка</label>
                        <input type="text" bind:value={item.link} class="form-input" />
                      </div>
                    </div>

                  {:else}
                    <!-- Default feature item -->
                    <div class="form-group">
                      <label>Заголовок</label>
                      <input type="text" bind:value={item.title} class="form-input" />
                    </div>
                    <div class="form-group">
                      <label>Описание</label>
                      <textarea bind:value={item.description} class="form-textarea" rows="2"></textarea>
                    </div>
                    <div class="form-grid">
                      <div class="form-group">
                        <label>Иконка</label>
                        <input type="text" bind:value={item.icon} class="form-input" placeholder="⭐ или URL" />
                      </div>
                      <div class="form-group">
                        <label>Ссылка</label>
                        <input type="text" bind:value={item.link} class="form-input" />
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Save button at bottom -->
    <div class="form-actions">
      <a href={`/admin/pages/${pageId}`} class="btn btn-secondary">← Назад к странице</a>
      <button
        type="button"
        onclick={saveSection}
        disabled={saving}
        class="btn btn-primary"
      >
        {saving ? 'Сохранение...' : '💾 Сохранить секцию'}
      </button>
    </div>
  {/if}
</div>

<style>
  .section-editor {
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
    flex-direction: column;
    gap: var(--spacing-2);
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
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .section-index {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    font-weight: normal;
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

  .btn-secondary:hover {
    background: var(--color-background-tertiary);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-font-size-xs);
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
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  .form-textarea:focus,
  .form-select:focus {
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

  /* Items */
  .empty-items {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .item-card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-3);
    border-bottom: 1px solid var(--color-border);
  }

  .item-number {
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-muted);
  }

  .item-actions {
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
    background: var(--color-background);
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    transition: background var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--color-background-tertiary);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-delete:hover {
    background: var(--color-error-light);
  }

  .item-fields {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .item-fields .form-group {
    margin-bottom: 0;
  }

  /* Features list */
  .features-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .feature-item {
    display: flex;
    gap: var(--spacing-2);
  }

  .feature-item .form-input {
    flex: 1;
  }

  .feature-item .action-btn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  /* Form actions */
  .form-actions {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-4);
    padding-top: var(--spacing-4);
  }
</style>
