<script lang="ts">
  /**
   * Dashboard Component
   *
   * Overview of pages, media, and quick actions
   */

  import { onMount } from 'svelte';

  interface Stats {
    totalPages: number;
    publishedPages: number;
    draftPages: number;
    totalMedia: number;
    totalImages: number;
    totalVideos: number;
  }

  interface RecentPage {
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    updatedAt: string;
  }

  // State
  let stats: Stats = $state({
    totalPages: 0,
    publishedPages: 0,
    draftPages: 0,
    totalMedia: 0,
    totalImages: 0,
    totalVideos: 0,
  });

  let recentPages: RecentPage[] = $state([]);
  let loading = $state(true);
  let userName = $state('');

  // Load data
  async function loadDashboard() {
    loading = true;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      // Load pages stats
      const pagesRes = await fetch('/api/admin/pages?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        stats.totalPages = data.pagination.total;
        recentPages = data.pages;

        // Count by status
        const publishedRes = await fetch('/api/admin/pages?status=published&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (publishedRes.ok) {
          const pData = await publishedRes.json();
          stats.publishedPages = pData.pagination.total;
          stats.draftPages = stats.totalPages - stats.publishedPages;
        }
      }

      // Load media stats
      const mediaRes = await fetch('/api/media', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (mediaRes.ok) {
        const data = await mediaRes.json();
        stats.totalMedia = data.total;
        stats.totalImages = data.files.filter((f: any) => f.type === 'image').length;
        stats.totalVideos = data.files.filter((f: any) => f.type === 'video').length;
      }

      // Get user info
      const userRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        userName = userData.user?.name || userData.user?.email || 'Admin';
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      loading = false;
    }
  }

  // Format date
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  // Get greeting based on time
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  }

  // Initial load
  onMount(() => {
    loadDashboard();
  });
</script>

<div class="dashboard">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else}
    <!-- Welcome -->
    <div class="welcome-section">
      <h1 class="welcome-title">{getGreeting()}, {userName}!</h1>
      <p class="welcome-subtitle">Управление вашим сайтом в одном месте</p>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div class="stat-content">
          <span class="stat-value">{stats.totalPages}</span>
          <span class="stat-label">Всего страниц</span>
        </div>
      </div>

      <div class="stat-card stat-success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <span class="stat-value">{stats.publishedPages}</span>
          <span class="stat-label">Опубликовано</span>
        </div>
      </div>

      <div class="stat-card stat-warning">
        <div class="stat-icon">📝</div>
        <div class="stat-content">
          <span class="stat-value">{stats.draftPages}</span>
          <span class="stat-label">Черновиков</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🖼️</div>
        <div class="stat-content">
          <span class="stat-value">{stats.totalMedia}</span>
          <span class="stat-label">Медиа файлов</span>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="section">
      <h2 class="section-title">Быстрые действия</h2>
      <div class="actions-grid">
        <a href="/admin/pages/new" class="action-card">
          <span class="action-icon">➕</span>
          <span class="action-title">Создать страницу</span>
          <span class="action-description">Новый лендинг или страница</span>
        </a>

        <a href="/admin/media" class="action-card">
          <span class="action-icon">📤</span>
          <span class="action-title">Загрузить медиа</span>
          <span class="action-description">Изображения, видео, документы</span>
        </a>

        <a href="/admin/theme" class="action-card">
          <span class="action-icon">🎨</span>
          <span class="action-title">Настроить тему</span>
          <span class="action-description">Цвета и типографика</span>
        </a>

        <a href="/admin/settings" class="action-card">
          <span class="action-icon">⚙️</span>
          <span class="action-title">Настройки</span>
          <span class="action-description">Общие настройки сайта</span>
        </a>
      </div>
    </div>

    <!-- Recent pages -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Недавние страницы</h2>
        <a href="/admin/pages" class="section-link">Все страницы →</a>
      </div>

      {#if recentPages.length === 0}
        <div class="empty-state">
          <p>Нет страниц. Создайте первую!</p>
          <a href="/admin/pages/new" class="btn btn-primary">Создать страницу</a>
        </div>
      {:else}
        <div class="recent-pages">
          {#each recentPages as page (page.id)}
            <a href={`/admin/pages/${page.id}`} class="page-item">
              <div class="page-info">
                <span class="page-title">{page.title}</span>
                <span class="page-slug">/{page.slug}</span>
              </div>
              <div class="page-meta">
                <span class={`status-badge status-${page.status}`}>
                  {page.status === 'published' ? '✅' : '📝'}
                </span>
                <span class="page-date">{formatDate(page.updatedAt)}</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Section library preview -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Библиотека секций</h2>
        <span class="section-badge">23 компонента</span>
      </div>
      <div class="section-library">
        <div class="section-category">
          <span class="category-label">Баннеры</span>
          <span class="category-items">Hero, HeroMin</span>
        </div>
        <div class="section-category">
          <span class="category-label">Контент</span>
          <span class="category-items">TextBlock, Snippet, Longread</span>
        </div>
        <div class="section-category">
          <span class="category-label">Медиа</span>
          <span class="category-items">Галерея, Слайдер, YouTube, Видео, MediaMix</span>
        </div>
        <div class="section-category">
          <span class="category-label">Конверсия</span>
          <span class="category-items">CTA, FAQ, Форма, Тарифы, Сравнение, Отзывы</span>
        </div>
        <div class="section-category">
          <span class="category-label">Информация</span>
          <span class="category-items">Features, Timeline, Stats, Team, Partners</span>
        </div>
        <div class="section-category">
          <span class="category-label">Social</span>
          <span class="category-items">Instagram Feed, Facebook Post</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  /* Loading */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
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

  /* Welcome */
  .welcome-section {
    margin-bottom: var(--spacing-2);
  }

  .welcome-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
    font-weight: var(--font-font-weight-semibold);
  }

  .welcome-subtitle {
    margin: var(--spacing-1) 0 0;
    color: var(--color-text-muted);
  }

  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--spacing-4);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-5);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  .stat-card:hover {
    box-shadow: var(--shadow-md);
  }

  .stat-icon {
    font-size: 2rem;
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: var(--font-font-size-xl);
    font-weight: var(--font-font-weight-bold);
    line-height: 1;
  }

  .stat-label {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    margin-top: var(--spacing-1);
  }

  .stat-success .stat-icon {
    background: var(--color-success-light);
  }

  .stat-warning .stat-icon {
    background: var(--color-warning-light);
  }

  /* Sections */
  .section {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
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

  .section-link {
    color: var(--color-primary);
    text-decoration: none;
    font-size: var(--font-font-size-sm);
  }

  .section-link:hover {
    text-decoration: underline;
  }

  .section-badge {
    padding: var(--spacing-1) var(--spacing-3);
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  /* Actions grid */
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
  }

  .action-card {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-5);
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: all var(--transition-fast);
  }

  .action-card:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .action-icon {
    font-size: 2rem;
    margin-bottom: var(--spacing-3);
  }

  .action-title {
    font-weight: var(--font-font-weight-semibold);
    margin-bottom: var(--spacing-1);
  }

  .action-description {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  /* Recent pages */
  .recent-pages {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .page-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: background var(--transition-fast);
  }

  .page-item:hover {
    background: var(--color-background-tertiary);
  }

  .page-info {
    display: flex;
    flex-direction: column;
  }

  .page-title {
    font-weight: var(--font-font-weight-medium);
  }

  .page-slug {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-font-family-mono);
  }

  .page-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .status-badge {
    font-size: var(--font-font-size-sm);
  }

  .page-date {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-muted);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4);
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
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  /* Section library */
  .section-library {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-3);
  }

  .section-category {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .category-label {
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .category-items {
    font-size: var(--font-font-size-sm);
  }
</style>
