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

  // Section type metadata - matches actual components in sections/
  const sectionMeta: Record<string, { name: string; icon: string; fields: string[]; itemsKey?: string }> = {
    'hero': {
      name: 'Hero',
      icon: '🦸',
      fields: ['title', 'subtitle', 'description', 'backgroundImage', 'backgroundVideo', 'ctaText', 'ctaHref', 'ctaSecondaryText', 'ctaSecondaryHref', 'align', 'height', 'overlay', 'overlayOpacity']
    },
    'heroMin': {
      name: 'HeroMin',
      icon: '📄',
      fields: ['title', 'subtitle', 'backgroundImage']
    },
    'textBlock': {
      name: 'Текстовый блок',
      icon: '📝',
      fields: ['content', 'columns', 'maxWidth']
    },
    'snippet': {
      name: 'Snippet',
      icon: '📰',
      fields: ['title', 'content', 'image', 'imageAlt', 'imagePosition', 'ctaText', 'ctaHref']
    },
    'longread': {
      name: 'Longread',
      icon: '📖',
      fields: ['content', 'showToc', 'tocTitle']
    },
    'photoGallery': {
      name: 'Фотогалерея',
      icon: '🖼️',
      fields: ['title', 'columns'],
      itemsKey: 'images'
    },
    'photoSlider': {
      name: 'Слайдер',
      icon: '🎠',
      fields: ['title', 'autoplay', 'interval'],
      itemsKey: 'images'
    },
    'videoYouTube': {
      name: 'YouTube видео',
      icon: '📺',
      fields: ['title', 'videoId', 'aspectRatio']
    },
    'videoLocal': {
      name: 'Локальное видео',
      icon: '🎬',
      fields: ['title', 'src', 'poster', 'autoplay', 'muted', 'loop', 'controls']
    },
    'mediaMix': {
      name: 'MediaMix',
      icon: '📷',
      fields: ['title'],
      itemsKey: 'items'
    },
    'cta': {
      name: 'CTA',
      icon: '📢',
      fields: ['title', 'description', 'buttonText', 'buttonHref', 'secondaryText', 'secondaryHref', 'variant']
    },
    'faq': {
      name: 'FAQ',
      icon: '❓',
      fields: ['title', 'subtitle'],
      itemsKey: 'items'
    },
    'contactForm': {
      name: 'Форма связи',
      icon: '✉️',
      fields: ['title', 'description', 'submitText', 'successMessage']
    },
    'pricing': {
      name: 'Тарифы',
      icon: '💰',
      fields: ['title', 'subtitle'],
      itemsKey: 'plans'
    },
    'compareTable': {
      name: 'Сравнение',
      icon: '📊',
      fields: ['title']
    },
    'testimonials': {
      name: 'Отзывы',
      icon: '💬',
      fields: ['title', 'layout'],
      itemsKey: 'items'
    },
    'features': {
      name: 'Преимущества',
      icon: '⭐',
      fields: ['title', 'subtitle', 'columns'],
      itemsKey: 'items'
    },
    'timeline': {
      name: 'Таймлайн',
      icon: '📅',
      fields: ['title'],
      itemsKey: 'items'
    },
    'stats': {
      name: 'Статистика',
      icon: '📈',
      fields: ['title', 'variant'],
      itemsKey: 'items'
    },
    'team': {
      name: 'Команда',
      icon: '👥',
      fields: ['title', 'subtitle'],
      itemsKey: 'members'
    },
    'partners': {
      name: 'Партнёры',
      icon: '🏢',
      fields: ['title', 'grayscale'],
      itemsKey: 'logos'
    },
    'instagramFeed': {
      name: 'Instagram Feed',
      icon: '📱',
      fields: ['title'],
      itemsKey: 'posts'
    },
    'facebookPost': {
      name: 'Facebook Post',
      icon: '👍',
      fields: ['date', 'content', 'image', 'likes', 'comments', 'shares', 'link']
    },
  };

  // Field labels for all section types
  const fieldLabels: Record<string, string> = {
    title: 'Заголовок',
    subtitle: 'Подзаголовок',
    description: 'Описание',
    content: 'Контент (Markdown)',
    // CTA fields
    ctaText: 'Текст кнопки',
    ctaHref: 'Ссылка кнопки',
    ctaSecondaryText: 'Вторая кнопка (текст)',
    ctaSecondaryHref: 'Вторая кнопка (ссылка)',
    buttonText: 'Текст кнопки',
    buttonHref: 'Ссылка кнопки',
    secondaryText: 'Вторая кнопка (текст)',
    secondaryHref: 'Вторая кнопка (ссылка)',
    // Media fields
    backgroundImage: 'Фоновое изображение (URL)',
    backgroundVideo: 'Фоновое видео (URL)',
    image: 'Изображение (URL)',
    imageAlt: 'Alt текст изображения',
    imagePosition: 'Позиция изображения',
    src: 'URL видео',
    poster: 'Постер видео (URL)',
    videoId: 'YouTube Video ID',
    aspectRatio: 'Соотношение сторон',
    // Layout fields
    columns: 'Колонок',
    maxWidth: 'Макс. ширина',
    align: 'Выравнивание',
    height: 'Высота',
    layout: 'Макет',
    variant: 'Вариант',
    // Boolean fields
    overlay: 'Затемнение',
    overlayOpacity: 'Прозрачность затемнения',
    autoplay: 'Автовоспроизведение',
    muted: 'Без звука',
    loop: 'Повтор',
    controls: 'Показать элементы управления',
    showToc: 'Показать оглавление',
    tocTitle: 'Заголовок оглавления',
    grayscale: 'Ч/Б фильтр',
    // Form fields
    submitText: 'Текст кнопки отправки',
    successMessage: 'Сообщение об успехе',
    // Other
    className: 'CSS класс',
    date: 'Дата',
    likes: 'Лайки',
    comments: 'Комментарии',
    shares: 'Репосты',
    link: 'Ссылка',
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

  // Get items array key for current section type
  function getItemsKey(): string {
    if (!section) return 'items';
    return sectionMeta[section.type]?.itemsKey || 'items';
  }

  // Get items array from section
  function getItems(): SectionItem[] {
    if (!section) return [];
    const key = getItemsKey();
    return (section as any)[key] || [];
  }

  // Set items array on section
  function setItems(items: SectionItem[]) {
    if (!section) return;
    const key = getItemsKey();
    (section as any)[key] = items;
  }

  // Add item to array field based on section type
  function addItem() {
    if (!section) return;

    const type = section.type;
    let newItem: SectionItem = {};

    // Default item structure based on actual parser.ts interfaces
    switch (type) {
      case 'pricing':
        newItem = { name: 'Тариф', price: '$0', period: '/мес', description: '', features: ['Функция 1'], ctaText: 'Выбрать', ctaHref: '#', highlighted: false };
        break;
      case 'testimonials':
        newItem = { content: 'Отзыв...', author: 'Имя', role: 'Должность', avatar: '', rating: 5 };
        break;
      case 'faq':
        newItem = { question: 'Вопрос?', answer: 'Ответ...' };
        break;
      case 'team':
        newItem = { name: 'Имя', role: 'Должность', avatar: '', bio: '' };
        break;
      case 'photoGallery':
      case 'photoSlider':
        newItem = { src: '', alt: '', caption: '' };
        break;
      case 'partners':
        newItem = { src: '', alt: '', href: '' };
        break;
      case 'stats':
        newItem = { value: '100+', label: 'Клиентов', prefix: '', suffix: '' };
        break;
      case 'features':
        newItem = { icon: '⭐', title: 'Преимущество', description: 'Описание...' };
        break;
      case 'timeline':
        newItem = { title: 'Этап', description: 'Описание...', date: '', icon: '' };
        break;
      case 'mediaMix':
        newItem = { type: 'image', src: '', caption: '' };
        break;
      case 'instagramFeed':
        newItem = { image: '', likes: 0, comments: 0, caption: '', link: '' };
        break;
      default:
        newItem = { title: 'Элемент', description: '' };
    }

    setItems([...getItems(), newItem]);
  }

  // Remove item from array
  function removeItem(index: number) {
    const items = getItems();
    if (!items.length) return;
    setItems(items.filter((_, i) => i !== index));
  }

  // Move item in array
  function moveItem(index: number, direction: 'up' | 'down') {
    const items = getItems();
    if (!items.length) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
  }

  // Add feature to pricing item
  function addFeature(itemIndex: number) {
    const items = getItems();
    if (!items[itemIndex]) return;
    items[itemIndex].features = [...(items[itemIndex].features || []), 'Новая функция'];
    setItems([...items]);
  }

  // Remove feature from pricing item
  function removeFeature(itemIndex: number, featureIndex: number) {
    const items = getItems();
    if (!items[itemIndex]?.features) return;
    items[itemIndex].features = items[itemIndex].features!.filter((_: any, i: number) => i !== featureIndex);
    setItems([...items]);
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

  // Check if section type has items
  function hasItems(): boolean {
    const meta = getMeta();
    return !!meta?.itemsKey;
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

      <!-- Content (Markdown) - for textBlock, longread -->
      {#if hasField('content')}
        <div class="form-group">
          <label for="content">{fieldLabels.content}</label>
          <textarea
            id="content"
            bind:value={section.content}
            placeholder="Markdown контент..."
            class="form-textarea form-textarea-lg"
            rows="10"
          ></textarea>
          <span class="form-hint">Поддерживается Markdown разметка</span>
        </div>
      {/if}

      <!-- Longread specific fields -->
      {#if hasField('showToc')}
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={section.showToc} />
            <span>Показать оглавление</span>
          </label>
        </div>
      {/if}

      {#if hasField('tocTitle')}
        <div class="form-group">
          <label for="tocTitle">{fieldLabels.tocTitle}</label>
          <input
            id="tocTitle"
            type="text"
            bind:value={section.tocTitle}
            placeholder="Содержание"
            class="form-input"
          />
        </div>
      {/if}

      <!-- Max width for textBlock -->
      {#if hasField('maxWidth')}
        <div class="form-group">
          <label for="maxWidth">{fieldLabels.maxWidth}</label>
          <select id="maxWidth" bind:value={section.maxWidth} class="form-select">
            <option value="sm">Узкая (640px)</option>
            <option value="md">Средняя (768px)</option>
            <option value="lg">Широкая (1024px)</option>
            <option value="full">Полная</option>
          </select>
        </div>
      {/if}

      <!-- Video fields -->
      {#if hasField('videoId')}
        <div class="form-group">
          <label for="videoId">{fieldLabels.videoId}</label>
          <input
            id="videoId"
            type="text"
            bind:value={section.videoId}
            placeholder="dQw4w9WgXcQ"
            class="form-input"
          />
          <span class="form-hint">ID видео из URL: youtube.com/watch?v=<strong>ID</strong></span>
        </div>
      {/if}

      {#if hasField('src')}
        <div class="form-group">
          <label for="src">{fieldLabels.src}</label>
          <input
            id="src"
            type="text"
            bind:value={section.src}
            placeholder="https://example.com/video.mp4"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('poster')}
        <div class="form-group">
          <label for="poster">{fieldLabels.poster}</label>
          <input
            id="poster"
            type="text"
            bind:value={section.poster}
            placeholder="https://example.com/poster.jpg"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('aspectRatio')}
        <div class="form-group">
          <label for="aspectRatio">{fieldLabels.aspectRatio}</label>
          <select id="aspectRatio" bind:value={section.aspectRatio} class="form-select">
            <option value="16:9">16:9 (стандарт)</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1 (квадрат)</option>
            <option value="9:16">9:16 (вертикаль)</option>
          </select>
        </div>
      {/if}

      <!-- Video boolean options -->
      {#if hasField('autoplay') || hasField('muted') || hasField('loop') || hasField('controls')}
        <div class="form-group">
          <label>Настройки видео</label>
          <div class="checkbox-list">
            {#if hasField('autoplay')}
              <label class="checkbox-item">
                <input type="checkbox" bind:checked={section.autoplay} />
                <span>Автовоспроизведение</span>
              </label>
            {/if}
            {#if hasField('muted')}
              <label class="checkbox-item">
                <input type="checkbox" bind:checked={section.muted} />
                <span>Без звука</span>
              </label>
            {/if}
            {#if hasField('loop')}
              <label class="checkbox-item">
                <input type="checkbox" bind:checked={section.loop} />
                <span>Повтор</span>
              </label>
            {/if}
            {#if hasField('controls')}
              <label class="checkbox-item">
                <input type="checkbox" bind:checked={section.controls} />
                <span>Показать элементы управления</span>
              </label>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Hero specific fields -->
      {#if hasField('align')}
        <div class="form-group">
          <label for="align">{fieldLabels.align}</label>
          <select id="align" bind:value={section.align} class="form-select">
            <option value="left">Слева</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </div>
      {/if}

      {#if hasField('height')}
        <div class="form-group">
          <label for="height">{fieldLabels.height}</label>
          <select id="height" bind:value={section.height} class="form-select">
            <option value="small">Маленькая (50vh)</option>
            <option value="medium">Средняя (70vh)</option>
            <option value="large">Большая (100vh)</option>
          </select>
        </div>
      {/if}

      {#if hasField('overlay')}
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={section.overlay} />
            <span>Затемнение фона</span>
          </label>
        </div>
      {/if}

      {#if hasField('overlayOpacity')}
        <div class="form-group">
          <label for="overlayOpacity">{fieldLabels.overlayOpacity}: {section.overlayOpacity || 0.5}</label>
          <input
            id="overlayOpacity"
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={section.overlayOpacity}
            class="form-range"
          />
        </div>
      {/if}

      <!-- CTA fields for hero (ctaHref) -->
      {#if hasField('ctaHref')}
        <div class="form-grid">
          <div class="form-group">
            <label for="ctaText">Текст кнопки</label>
            <input
              id="ctaText"
              type="text"
              bind:value={section.ctaText}
              placeholder="Начать"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="ctaHref">Ссылка кнопки</label>
            <input
              id="ctaHref"
              type="text"
              bind:value={section.ctaHref}
              placeholder="#contact"
              class="form-input"
            />
          </div>
        </div>
      {/if}

      {#if hasField('ctaSecondaryText') || hasField('ctaSecondaryHref')}
        <div class="form-grid">
          <div class="form-group">
            <label for="ctaSecondaryText">Вторая кнопка (текст)</label>
            <input
              id="ctaSecondaryText"
              type="text"
              bind:value={section.ctaSecondaryText}
              placeholder="Узнать больше"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="ctaSecondaryHref">Вторая кнопка (ссылка)</label>
            <input
              id="ctaSecondaryHref"
              type="text"
              bind:value={section.ctaSecondaryHref}
              placeholder="#features"
              class="form-input"
            />
          </div>
        </div>
      {/if}

      <!-- CTA section fields (buttonText/buttonHref) -->
      {#if hasField('buttonText') || hasField('buttonHref')}
        <div class="form-grid">
          <div class="form-group">
            <label for="buttonText">Текст кнопки</label>
            <input
              id="buttonText"
              type="text"
              bind:value={section.buttonText}
              placeholder="Начать"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="buttonHref">Ссылка кнопки</label>
            <input
              id="buttonHref"
              type="text"
              bind:value={section.buttonHref}
              placeholder="#contact"
              class="form-input"
            />
          </div>
        </div>
      {/if}

      {#if hasField('secondaryText') || hasField('secondaryHref')}
        <div class="form-grid">
          <div class="form-group">
            <label for="secondaryText">Вторая кнопка (текст)</label>
            <input
              id="secondaryText"
              type="text"
              bind:value={section.secondaryText}
              placeholder="Узнать больше"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="secondaryHref">Вторая кнопка (ссылка)</label>
            <input
              id="secondaryHref"
              type="text"
              bind:value={section.secondaryHref}
              placeholder="#features"
              class="form-input"
            />
          </div>
        </div>
      {/if}

      <!-- Contact form fields -->
      {#if hasField('submitText')}
        <div class="form-group">
          <label for="submitText">{fieldLabels.submitText}</label>
          <input
            id="submitText"
            type="text"
            bind:value={section.submitText}
            placeholder="Отправить"
            class="form-input"
          />
        </div>
      {/if}

      {#if hasField('successMessage')}
        <div class="form-group">
          <label for="successMessage">{fieldLabels.successMessage}</label>
          <input
            id="successMessage"
            type="text"
            bind:value={section.successMessage}
            placeholder="Спасибо! Мы свяжемся с вами."
            class="form-input"
          />
        </div>
      {/if}

      <!-- Partners grayscale -->
      {#if hasField('grayscale')}
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={section.grayscale} />
            <span>Ч/Б фильтр для логотипов</span>
          </label>
        </div>
      {/if}

      <!-- Layout/variant -->
      {#if hasField('layout')}
        <div class="form-group">
          <label for="layout">{fieldLabels.layout}</label>
          <select id="layout" bind:value={section.layout} class="form-select">
            <option value="grid">Сетка</option>
            <option value="slider">Слайдер</option>
            <option value="list">Список</option>
          </select>
        </div>
      {/if}

      {#if hasField('variant')}
        <div class="form-group">
          <label for="variant">{fieldLabels.variant}</label>
          <select id="variant" bind:value={section.variant} class="form-select">
            <option value="default">Стандартный</option>
            <option value="primary">Акцентный</option>
            <option value="minimal">Минималистичный</option>
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
    {#if hasItems()}
      {@const items = getItems()}
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">Элементы ({items.length})</h2>
          <button type="button" onclick={addItem} class="btn btn-primary btn-sm">
            + Добавить
          </button>
        </div>

        {#if !items.length}
          <div class="empty-items">
            <p>Нет элементов. Добавьте первый элемент.</p>
          </div>
        {:else}
          <div class="items-list">
            {#each items as item, index (index)}
              <div class="item-card">
                <div class="item-header">
                  <span class="item-number">#{index + 1}</span>
                  <div class="item-actions">
                    <button type="button" onclick={() => moveItem(index, 'up')} disabled={index === 0} class="action-btn" title="Вверх">^</button>
                    <button type="button" onclick={() => moveItem(index, 'down')} disabled={index === items.length - 1} class="action-btn" title="Вниз">v</button>
                    <button type="button" onclick={() => removeItem(index)} class="action-btn action-delete" title="Удалить">x</button>
                  </div>
                </div>

                <div class="item-fields">
                  {#if section.type === 'pricing'}
                    <!-- Pricing plan -->
                    <div class="form-grid">
                      <div class="form-group"><label>Название</label><input type="text" bind:value={item.name} class="form-input" /></div>
                      <div class="form-group"><label>Цена</label><input type="text" bind:value={item.price} class="form-input" /></div>
                      <div class="form-group"><label>Период</label><input type="text" bind:value={item.period} class="form-input" placeholder="/мес" /></div>
                    </div>
                    <div class="form-group"><label>Описание</label><input type="text" bind:value={item.description} class="form-input" /></div>
                    <div class="form-grid">
                      <div class="form-group"><label>Текст кнопки</label><input type="text" bind:value={item.ctaText} class="form-input" /></div>
                      <div class="form-group"><label>Ссылка</label><input type="text" bind:value={item.ctaHref} class="form-input" /></div>
                    </div>
                    <div class="form-group"><label><input type="checkbox" bind:checked={item.highlighted} /> Выделенный</label></div>
                    <div class="form-group">
                      <label>Функции</label>
                      <div class="features-list">
                        {#each item.features || [] as _, fi}
                          <div class="feature-item">
                            <input type="text" bind:value={item.features[fi]} class="form-input" />
                            <button type="button" onclick={() => removeFeature(index, fi)} class="action-btn action-delete">x</button>
                          </div>
                        {/each}
                        <button type="button" onclick={() => addFeature(index)} class="btn btn-secondary btn-sm">+ Функция</button>
                      </div>
                    </div>

                  {:else if section.type === 'testimonials'}
                    <!-- Testimonial -->
                    <div class="form-group"><label>Отзыв</label><textarea bind:value={item.content} class="form-textarea" rows="3"></textarea></div>
                    <div class="form-grid">
                      <div class="form-group"><label>Автор</label><input type="text" bind:value={item.author} class="form-input" /></div>
                      <div class="form-group"><label>Должность</label><input type="text" bind:value={item.role} class="form-input" /></div>
                    </div>
                    <div class="form-grid">
                      <div class="form-group"><label>Аватар (URL)</label><input type="text" bind:value={item.avatar} class="form-input" /></div>
                      <div class="form-group"><label>Рейтинг (1-5)</label><input type="number" bind:value={item.rating} min="1" max="5" class="form-input" /></div>
                    </div>

                  {:else if section.type === 'faq'}
                    <!-- FAQ -->
                    <div class="form-group"><label>Вопрос</label><input type="text" bind:value={item.question} class="form-input" /></div>
                    <div class="form-group"><label>Ответ</label><textarea bind:value={item.answer} class="form-textarea" rows="3"></textarea></div>

                  {:else if section.type === 'team'}
                    <!-- Team member -->
                    <div class="form-grid">
                      <div class="form-group"><label>Имя</label><input type="text" bind:value={item.name} class="form-input" /></div>
                      <div class="form-group"><label>Должность</label><input type="text" bind:value={item.role} class="form-input" /></div>
                    </div>
                    <div class="form-group"><label>Фото (URL)</label><input type="text" bind:value={item.avatar} class="form-input" /></div>
                    <div class="form-group"><label>Биография</label><textarea bind:value={item.bio} class="form-textarea" rows="2"></textarea></div>

                  {:else if section.type === 'photoGallery' || section.type === 'photoSlider'}
                    <!-- Image -->
                    <div class="form-group"><label>Изображение (URL)</label><input type="text" bind:value={item.src} class="form-input" /></div>
                    <div class="form-grid">
                      <div class="form-group"><label>Alt текст</label><input type="text" bind:value={item.alt} class="form-input" /></div>
                      <div class="form-group"><label>Подпись</label><input type="text" bind:value={item.caption} class="form-input" /></div>
                    </div>

                  {:else if section.type === 'partners'}
                    <!-- Partner logo -->
                    <div class="form-group"><label>Логотип (URL)</label><input type="text" bind:value={item.src} class="form-input" /></div>
                    <div class="form-grid">
                      <div class="form-group"><label>Alt текст</label><input type="text" bind:value={item.alt} class="form-input" /></div>
                      <div class="form-group"><label>Ссылка</label><input type="text" bind:value={item.href} class="form-input" /></div>
                    </div>

                  {:else if section.type === 'stats'}
                    <!-- Stat -->
                    <div class="form-grid">
                      <div class="form-group"><label>Значение</label><input type="text" bind:value={item.value} class="form-input" /></div>
                      <div class="form-group"><label>Подпись</label><input type="text" bind:value={item.label} class="form-input" /></div>
                    </div>
                    <div class="form-grid">
                      <div class="form-group"><label>Префикс</label><input type="text" bind:value={item.prefix} class="form-input" placeholder="$" /></div>
                      <div class="form-group"><label>Суффикс</label><input type="text" bind:value={item.suffix} class="form-input" placeholder="+" /></div>
                    </div>

                  {:else if section.type === 'timeline'}
                    <!-- Timeline item -->
                    <div class="form-grid">
                      <div class="form-group"><label>Заголовок</label><input type="text" bind:value={item.title} class="form-input" /></div>
                      <div class="form-group"><label>Дата</label><input type="text" bind:value={item.date} class="form-input" /></div>
                    </div>
                    <div class="form-group"><label>Описание</label><textarea bind:value={item.description} class="form-textarea" rows="2"></textarea></div>
                    <div class="form-group"><label>Иконка</label><input type="text" bind:value={item.icon} class="form-input" /></div>

                  {:else if section.type === 'mediaMix'}
                    <!-- MediaMix item -->
                    <div class="form-grid">
                      <div class="form-group"><label>Тип</label><select bind:value={item.type} class="form-select"><option value="image">Фото</option><option value="video">Видео</option></select></div>
                      <div class="form-group"><label>URL</label><input type="text" bind:value={item.src} class="form-input" /></div>
                    </div>
                    <div class="form-group"><label>Подпись</label><input type="text" bind:value={item.caption} class="form-input" /></div>

                  {:else if section.type === 'instagramFeed'}
                    <!-- Instagram post -->
                    <div class="form-group"><label>Изображение (URL)</label><input type="text" bind:value={item.image} class="form-input" /></div>
                    <div class="form-grid">
                      <div class="form-group"><label>Лайки</label><input type="number" bind:value={item.likes} class="form-input" /></div>
                      <div class="form-group"><label>Комментарии</label><input type="number" bind:value={item.comments} class="form-input" /></div>
                    </div>
                    <div class="form-group"><label>Подпись</label><input type="text" bind:value={item.caption} class="form-input" /></div>
                    <div class="form-group"><label>Ссылка</label><input type="text" bind:value={item.link} class="form-input" /></div>

                  {:else}
                    <!-- Default: features -->
                    <div class="form-group"><label>Заголовок</label><input type="text" bind:value={item.title} class="form-input" /></div>
                    <div class="form-group"><label>Описание</label><textarea bind:value={item.description} class="form-textarea" rows="2"></textarea></div>
                    <div class="form-group"><label>Иконка</label><input type="text" bind:value={item.icon} class="form-input" placeholder="emoji или URL" /></div>
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

  .form-textarea-lg {
    min-height: 200px;
    font-family: var(--font-font-family-mono);
  }

  .form-range {
    width: 100%;
    height: 8px;
    cursor: pointer;
    accent-color: var(--color-primary);
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
    accent-color: var(--color-primary);
  }

  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    cursor: pointer;
    font-size: var(--font-font-size-sm);
  }

  .checkbox-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
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
