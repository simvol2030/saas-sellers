<script lang="ts">
  /**
   * Notification Settings Component
   *
   * Configure low stock alerts and notification preferences
   * Features: Threshold settings, email/telegram notifications, test alerts
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface NotificationSettings {
    id: number;
    emailEnabled: boolean;
    emailRecipients: string[];
    telegramEnabled: boolean;
    telegramChatId: string | null;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    dailyReportEnabled: boolean;
    dailyReportTime: string;
    updatedAt: string;
  }

  interface LowStockProduct {
    id: number;
    name: string;
    sku: string | null;
    stock: number;
    lowStockThreshold: number;
  }

  let settings = $state<NotificationSettings | null>(null);
  let lowStockProducts = $state<LowStockProduct[]>([]);
  let loading = $state(true);
  let loadingProducts = $state(false);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let saving = $state(false);
  let testing = $state(false);

  // Form state
  let formData = $state({
    emailEnabled: false,
    emailRecipients: '',
    telegramEnabled: false,
    telegramChatId: '',
    lowStockEnabled: true,
    lowStockThreshold: 5,
    dailyReportEnabled: false,
    dailyReportTime: '09:00',
  });

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load settings
  async function loadSettings() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<NotificationSettings>('/api/admin/notifications/settings');
      settings = data;
      formData = {
        emailEnabled: data.emailEnabled,
        emailRecipients: data.emailRecipients.join(', '),
        telegramEnabled: data.telegramEnabled,
        telegramChatId: data.telegramChatId || '',
        lowStockEnabled: data.lowStockEnabled,
        lowStockThreshold: data.lowStockThreshold,
        dailyReportEnabled: data.dailyReportEnabled,
        dailyReportTime: data.dailyReportTime,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки настроек';
    } finally {
      loading = false;
    }
  }

  // Load low stock products
  async function loadLowStockProducts() {
    loadingProducts = true;

    try {
      const data = await apiFetch<LowStockProduct[]>('/api/admin/notifications/low-stock');
      lowStockProducts = data;
    } catch (e) {
      console.error('Error loading low stock products:', e);
    } finally {
      loadingProducts = false;
    }
  }

  // Save settings
  async function saveSettings() {
    saving = true;

    try {
      // Parse email recipients
      const emailRecipients = formData.emailRecipients
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      const payload = {
        emailEnabled: formData.emailEnabled,
        emailRecipients,
        telegramEnabled: formData.telegramEnabled,
        telegramChatId: formData.telegramChatId.trim() || null,
        lowStockEnabled: formData.lowStockEnabled,
        lowStockThreshold: formData.lowStockThreshold,
        dailyReportEnabled: formData.dailyReportEnabled,
        dailyReportTime: formData.dailyReportTime,
      };

      await apiFetch('/api/admin/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showNotification('success', 'Настройки сохранены');
      loadSettings();
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Send test notification
  async function sendTestNotification(type: 'email' | 'telegram') {
    testing = true;

    try {
      await apiFetch('/api/admin/notifications/test', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      showNotification('success', `Тестовое уведомление отправлено (${type})`);
    } catch (e: any) {
      console.error('Test notification error:', e);
      showNotification('error', e.message || 'Ошибка отправки');
    } finally {
      testing = false;
    }
  }

  // Initial load
  onMount(() => {
    loadSettings();
    loadLowStockProducts();
  });
</script>

<div class="notification-settings">
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

  <div class="settings-layout">
    <!-- Settings panel -->
    <div class="settings-panel">
      <div class="panel-header">
        <h2>Настройки уведомлений</h2>
      </div>

      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      {:else if error}
        <div class="error-message">
          <p>❌ {error}</p>
          <button onclick={loadSettings} class="btn btn-secondary">Повторить</button>
        </div>
      {:else}
        <div class="panel-body">
          <!-- Low stock settings -->
          <section class="settings-section">
            <h3>📦 Оповещения о низком остатке</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.lowStockEnabled}
                />
                <span>Включить оповещения о низком остатке</span>
              </label>
            </div>

            <div class="form-group">
              <label for="threshold">Порог остатка (по умолчанию)</label>
              <div class="input-with-suffix">
                <input
                  type="number"
                  id="threshold"
                  bind:value={formData.lowStockThreshold}
                  min="0"
                  class="form-input"
                />
                <span class="suffix">шт.</span>
              </div>
              <p class="form-hint">Уведомлять, когда остаток товара меньше или равен этому значению</p>
            </div>
          </section>

          <!-- Email settings -->
          <section class="settings-section">
            <h3>📧 Email уведомления</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.emailEnabled}
                />
                <span>Включить Email уведомления</span>
              </label>
            </div>

            {#if formData.emailEnabled}
              <div class="form-group">
                <label for="emails">Получатели</label>
                <input
                  type="text"
                  id="emails"
                  bind:value={formData.emailRecipients}
                  placeholder="admin@example.com, manager@example.com"
                  class="form-input"
                />
                <p class="form-hint">Адреса через запятую</p>
              </div>

              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick={() => sendTestNotification('email')}
                disabled={testing || !formData.emailRecipients}
              >
                {testing ? '...' : '📤'} Тестовое письмо
              </button>
            {/if}
          </section>

          <!-- Telegram settings -->
          <section class="settings-section">
            <h3>📱 Telegram уведомления</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.telegramEnabled}
                />
                <span>Включить Telegram уведомления</span>
              </label>
            </div>

            {#if formData.telegramEnabled}
              <div class="form-group">
                <label for="telegram-chat">Chat ID</label>
                <input
                  type="text"
                  id="telegram-chat"
                  bind:value={formData.telegramChatId}
                  placeholder="-1001234567890"
                  class="form-input"
                />
                <p class="form-hint">ID чата или канала для уведомлений</p>
              </div>

              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick={() => sendTestNotification('telegram')}
                disabled={testing || !formData.telegramChatId}
              >
                {testing ? '...' : '📤'} Тестовое сообщение
              </button>
            {/if}
          </section>

          <!-- Daily report -->
          <section class="settings-section">
            <h3>📊 Ежедневный отчёт</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.dailyReportEnabled}
                />
                <span>Отправлять ежедневный отчёт</span>
              </label>
            </div>

            {#if formData.dailyReportEnabled}
              <div class="form-group">
                <label for="report-time">Время отправки</label>
                <input
                  type="time"
                  id="report-time"
                  bind:value={formData.dailyReportTime}
                  class="form-input"
                  style="max-width: 150px"
                />
              </div>
            {/if}
          </section>

          <!-- Save button -->
          <div class="form-actions">
            <button
              type="button"
              class="btn btn-primary"
              onclick={saveSettings}
              disabled={saving}
            >
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Low stock products panel -->
    <div class="low-stock-panel">
      <div class="panel-header">
        <h2>⚠️ Товары с низким остатком</h2>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          onclick={loadLowStockProducts}
          disabled={loadingProducts}
        >
          🔄 Обновить
        </button>
      </div>

      <div class="panel-body">
        {#if loadingProducts}
          <div class="loading-inline">
            <div class="spinner-sm"></div>
            <span>Загрузка...</span>
          </div>
        {:else if lowStockProducts.length === 0}
          <div class="empty-products">
            <div class="empty-icon">✅</div>
            <p>Все товары в наличии</p>
          </div>
        {:else}
          <div class="low-stock-list">
            {#each lowStockProducts as product (product.id)}
              <div class="low-stock-item">
                <div class="product-info">
                  <span class="product-name">{product.name}</span>
                  {#if product.sku}
                    <span class="product-sku">{product.sku}</span>
                  {/if}
                </div>
                <div class="stock-info">
                  <span class="stock-value" class:critical={product.stock === 0}>
                    {product.stock} шт.
                  </span>
                  <span class="threshold">порог: {product.lowStockThreshold}</span>
                </div>
              </div>
            {/each}
          </div>
          <div class="low-stock-footer">
            <span class="count">Всего: {lowStockProducts.length} товаров</span>
            <a href="/admin/products" class="btn btn-secondary btn-sm">
              Управление товарами →
            </a>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .notification-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .settings-layout {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: var(--spacing-4);
  }

  @media (max-width: 1024px) {
    .settings-layout {
      grid-template-columns: 1fr;
    }
  }

  .settings-panel,
  .low-stock-panel {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-4);
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background-secondary);
  }

  .panel-header h2 {
    margin: 0;
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .panel-body {
    padding: var(--spacing-6);
  }

  .settings-section {
    margin-bottom: var(--spacing-6);
    padding-bottom: var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
  }

  .settings-section:last-of-type {
    border-bottom: none;
    margin-bottom: var(--spacing-4);
    padding-bottom: 0;
  }

  .settings-section h3 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text);
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

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-font-size-xs);
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
  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8);
    text-align: center;
  }

  .loading-inline {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4);
    color: var(--color-text-muted);
  }

  .spinner,
  .spinner-sm {
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner {
    width: 32px;
    height: 32px;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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

  .input-with-suffix {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .input-with-suffix .form-input {
    max-width: 100px;
  }

  .suffix {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .form-hint {
    margin-top: var(--spacing-1);
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
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

  .form-actions {
    padding-top: var(--spacing-4);
  }

  /* Low stock panel */
  .empty-products {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-8);
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-2);
  }

  .empty-products p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .low-stock-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .low-stock-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
    gap: var(--spacing-3);
  }

  .product-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .product-name {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .product-sku {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-family-mono);
  }

  .stock-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .stock-value {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-warning);
  }

  .stock-value.critical {
    color: var(--color-error);
  }

  .threshold {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .low-stock-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
  }

  .count {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
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
