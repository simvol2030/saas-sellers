<script lang="ts">
  /**
   * Site Settings Component
   *
   * General site configuration: metadata, header, footer, SEO
   */

  import { onMount } from 'svelte';

  interface Settings {
    // General
    siteName: string;
    siteTagline: string;
    logoUrl: string;
    faviconUrl: string;

    // Contact
    email: string;
    phone: string;
    address: string;

    // Social
    socialFacebook: string;
    socialTwitter: string;
    socialInstagram: string;
    socialLinkedIn: string;
    socialYoutube: string;
    socialTelegram: string;

    // SEO Defaults
    defaultMetaTitle: string;
    defaultMetaDescription: string;
    defaultOgImage: string;
    googleAnalyticsId: string;
    yandexMetrikaId: string;

    // Header
    headerStyle: 'default' | 'transparent' | 'sticky';
    showHeaderCta: boolean;
    headerCtaText: string;
    headerCtaLink: string;

    // Footer
    footerStyle: 'default' | 'minimal' | 'expanded';
    copyrightText: string;
    showSocialInFooter: boolean;
  }

  // Default settings
  const defaultSettings: Settings = {
    siteName: 'My Landing Site',
    siteTagline: 'Your amazing tagline here',
    logoUrl: '',
    faviconUrl: '',
    email: '',
    phone: '',
    address: '',
    socialFacebook: '',
    socialTwitter: '',
    socialInstagram: '',
    socialLinkedIn: '',
    socialYoutube: '',
    socialTelegram: '',
    defaultMetaTitle: '',
    defaultMetaDescription: '',
    defaultOgImage: '',
    googleAnalyticsId: '',
    yandexMetrikaId: '',
    headerStyle: 'default',
    showHeaderCta: true,
    headerCtaText: 'Get Started',
    headerCtaLink: '#contact',
    footerStyle: 'default',
    copyrightText: '© 2025 All rights reserved',
    showSocialInFooter: true,
  };

  // State
  let settings: Settings = $state({ ...defaultSettings });
  let activeTab = $state<'general' | 'contact' | 'seo' | 'header' | 'footer'>('general');
  let saving = $state(false);
  let success = $state<string | null>(null);
  let error = $state<string | null>(null);

  // Tabs
  const tabs = [
    { id: 'general', name: 'Основные', icon: '⚙️' },
    { id: 'contact', name: 'Контакты', icon: '📞' },
    { id: 'seo', name: 'SEO', icon: '🔍' },
    { id: 'header', name: 'Шапка', icon: '🔝' },
    { id: 'footer', name: 'Подвал', icon: '🔽' },
  ];

  // Load settings
  function loadSettings() {
    try {
      const saved = localStorage.getItem('siteSettings');
      if (saved) {
        settings = { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Load settings error:', e);
    }
  }

  // Save settings
  async function saveSettings() {
    saving = true;
    success = null;
    error = null;

    try {
      // Save to localStorage for now
      // In production, save to database via API
      localStorage.setItem('siteSettings', JSON.stringify(settings));
      success = 'Настройки сохранены';
    } catch (e) {
      error = 'Ошибка сохранения';
    } finally {
      saving = false;
    }
  }

  // Reset to defaults
  function resetSettings() {
    if (!confirm('Сбросить все настройки к значениям по умолчанию?')) return;
    settings = { ...defaultSettings };
    success = 'Настройки сброшены';
  }

  // Initial load
  onMount(() => {
    loadSettings();
  });
</script>

<div class="site-settings">
  <!-- Header -->
  <div class="settings-header">
    <div class="header-left">
      <h1 class="settings-title">⚙️ Настройки сайта</h1>
      <p class="settings-description">Общая конфигурация сайта, метаданные и внешний вид</p>
    </div>
    <div class="header-actions">
      <button type="button" onclick={resetSettings} class="btn btn-outline">
        🔄 Сброс
      </button>
      <button type="button" onclick={saveSettings} disabled={saving} class="btn btn-primary">
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

  <!-- Tabs -->
  <div class="tabs">
    {#each tabs as tab}
      <button
        type="button"
        class="tab"
        class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id as typeof activeTab}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-name">{tab.name}</span>
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="tab-content">
    {#if activeTab === 'general'}
      <div class="form-section">
        <h2 class="section-title">Основная информация</h2>

        <div class="form-group">
          <label for="siteName">Название сайта</label>
          <input
            id="siteName"
            type="text"
            bind:value={settings.siteName}
            class="form-input"
            placeholder="My Landing Site"
          />
        </div>

        <div class="form-group">
          <label for="siteTagline">Слоган</label>
          <input
            id="siteTagline"
            type="text"
            bind:value={settings.siteTagline}
            class="form-input"
            placeholder="Your amazing tagline"
          />
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="logoUrl">URL логотипа</label>
            <input
              id="logoUrl"
              type="text"
              bind:value={settings.logoUrl}
              class="form-input"
              placeholder="/images/logo.png"
            />
          </div>
          <div class="form-group">
            <label for="faviconUrl">URL favicon</label>
            <input
              id="faviconUrl"
              type="text"
              bind:value={settings.faviconUrl}
              class="form-input"
              placeholder="/favicon.ico"
            />
          </div>
        </div>
      </div>

    {:else if activeTab === 'contact'}
      <div class="form-section">
        <h2 class="section-title">Контактная информация</h2>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            bind:value={settings.email}
            class="form-input"
            placeholder="hello@example.com"
          />
        </div>

        <div class="form-group">
          <label for="phone">Телефон</label>
          <input
            id="phone"
            type="tel"
            bind:value={settings.phone}
            class="form-input"
            placeholder="+7 (999) 123-45-67"
          />
        </div>

        <div class="form-group">
          <label for="address">Адрес</label>
          <textarea
            id="address"
            bind:value={settings.address}
            class="form-textarea"
            rows="2"
            placeholder="Москва, ул. Примерная, д. 1"
          ></textarea>
        </div>

        <h3 class="subsection-title">Социальные сети</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="socialTelegram">Telegram</label>
            <input
              id="socialTelegram"
              type="text"
              bind:value={settings.socialTelegram}
              class="form-input"
              placeholder="https://t.me/channel"
            />
          </div>
          <div class="form-group">
            <label for="socialInstagram">Instagram</label>
            <input
              id="socialInstagram"
              type="text"
              bind:value={settings.socialInstagram}
              class="form-input"
              placeholder="https://instagram.com/..."
            />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="socialFacebook">Facebook</label>
            <input
              id="socialFacebook"
              type="text"
              bind:value={settings.socialFacebook}
              class="form-input"
              placeholder="https://facebook.com/..."
            />
          </div>
          <div class="form-group">
            <label for="socialTwitter">Twitter/X</label>
            <input
              id="socialTwitter"
              type="text"
              bind:value={settings.socialTwitter}
              class="form-input"
              placeholder="https://twitter.com/..."
            />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="socialLinkedIn">LinkedIn</label>
            <input
              id="socialLinkedIn"
              type="text"
              bind:value={settings.socialLinkedIn}
              class="form-input"
              placeholder="https://linkedin.com/..."
            />
          </div>
          <div class="form-group">
            <label for="socialYoutube">YouTube</label>
            <input
              id="socialYoutube"
              type="text"
              bind:value={settings.socialYoutube}
              class="form-input"
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>
      </div>

    {:else if activeTab === 'seo'}
      <div class="form-section">
        <h2 class="section-title">SEO по умолчанию</h2>

        <div class="form-group">
          <label for="defaultMetaTitle">Meta Title по умолчанию</label>
          <input
            id="defaultMetaTitle"
            type="text"
            bind:value={settings.defaultMetaTitle}
            class="form-input"
            placeholder="Site Name - Tagline"
            maxlength="100"
          />
          <span class="form-hint">{settings.defaultMetaTitle.length}/100</span>
        </div>

        <div class="form-group">
          <label for="defaultMetaDescription">Meta Description по умолчанию</label>
          <textarea
            id="defaultMetaDescription"
            bind:value={settings.defaultMetaDescription}
            class="form-textarea"
            rows="3"
            placeholder="Description for search engines..."
            maxlength="200"
          ></textarea>
          <span class="form-hint">{settings.defaultMetaDescription.length}/200</span>
        </div>

        <div class="form-group">
          <label for="defaultOgImage">OG Image по умолчанию</label>
          <input
            id="defaultOgImage"
            type="text"
            bind:value={settings.defaultOgImage}
            class="form-input"
            placeholder="https://example.com/og-image.jpg"
          />
        </div>

        <h3 class="subsection-title">Аналитика</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="googleAnalyticsId">Google Analytics ID</label>
            <input
              id="googleAnalyticsId"
              type="text"
              bind:value={settings.googleAnalyticsId}
              class="form-input"
              placeholder="G-XXXXXXXXXX"
            />
          </div>
          <div class="form-group">
            <label for="yandexMetrikaId">Яндекс.Метрика ID</label>
            <input
              id="yandexMetrikaId"
              type="text"
              bind:value={settings.yandexMetrikaId}
              class="form-input"
              placeholder="12345678"
            />
          </div>
        </div>
      </div>

    {:else if activeTab === 'header'}
      <div class="form-section">
        <h2 class="section-title">Настройки шапки</h2>

        <div class="form-group">
          <label for="headerStyle">Стиль шапки</label>
          <select id="headerStyle" bind:value={settings.headerStyle} class="form-select">
            <option value="default">Обычная</option>
            <option value="transparent">Прозрачная</option>
            <option value="sticky">Фиксированная</option>
          </select>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={settings.showHeaderCta} />
            <span>Показывать CTA кнопку в шапке</span>
          </label>
        </div>

        {#if settings.showHeaderCta}
          <div class="form-grid">
            <div class="form-group">
              <label for="headerCtaText">Текст CTA</label>
              <input
                id="headerCtaText"
                type="text"
                bind:value={settings.headerCtaText}
                class="form-input"
                placeholder="Get Started"
              />
            </div>
            <div class="form-group">
              <label for="headerCtaLink">Ссылка CTA</label>
              <input
                id="headerCtaLink"
                type="text"
                bind:value={settings.headerCtaLink}
                class="form-input"
                placeholder="#contact"
              />
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'footer'}
      <div class="form-section">
        <h2 class="section-title">Настройки подвала</h2>

        <div class="form-group">
          <label for="footerStyle">Стиль подвала</label>
          <select id="footerStyle" bind:value={settings.footerStyle} class="form-select">
            <option value="default">Обычный</option>
            <option value="minimal">Минималистичный</option>
            <option value="expanded">Расширенный</option>
          </select>
        </div>

        <div class="form-group">
          <label for="copyrightText">Текст копирайта</label>
          <input
            id="copyrightText"
            type="text"
            bind:value={settings.copyrightText}
            class="form-input"
            placeholder="© 2025 Company Name. All rights reserved."
          />
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={settings.showSocialInFooter} />
            <span>Показывать ссылки на соцсети в подвале</span>
          </label>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .site-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  /* Header */
  .settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-4);
  }

  .settings-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
  }

  .settings-description {
    margin: var(--spacing-1) 0 0;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-2);
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

  .btn-outline {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover {
    background: var(--color-background-secondary);
  }

  /* Messages */
  .message {
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-md);
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

  /* Tabs */
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    background: var(--color-background-secondary);
    padding: var(--spacing-2);
    border-radius: var(--radius-lg);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .tab:hover {
    color: var(--color-text);
    background: var(--color-background);
  }

  .tab.active {
    background: var(--color-background);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }

  .tab-icon {
    font-size: 1.1rem;
  }

  /* Form */
  .form-section {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
  }

  .section-title {
    margin: 0 0 var(--spacing-6);
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-semibold);
  }

  .subsection-title {
    margin: var(--spacing-6) 0 var(--spacing-4);
    font-size: var(--font-font-size-base);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-muted);
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
</style>
