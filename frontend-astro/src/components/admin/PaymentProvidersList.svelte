<script lang="ts">
  /**
   * Payment Providers List Component
   *
   * Manage payment providers (YooKassa, Telegram Stars)
   * Features: CRUD, toggle active, configure credentials
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface PaymentProvider {
    id: number;
    type: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
    config: Record<string, string>;
    position: number;
    createdAt: string;
    updatedAt: string;
  }

  const PROVIDER_TYPES = [
    { type: 'yookassa', name: 'ЮKassa', icon: '💳', description: 'Банковские карты, электронные кошельки' },
    { type: 'telegram_stars', name: 'Telegram Stars', icon: '⭐', description: 'Оплата звёздами в Telegram' },
    { type: 'cash', name: 'Наличные', icon: '💵', description: 'Оплата при получении' },
    { type: 'bank_transfer', name: 'Банковский перевод', icon: '🏦', description: 'Перевод на счёт' },
  ];

  let providers: PaymentProvider[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit modal
  let showModal = $state(false);
  let editingProvider = $state<PaymentProvider | null>(null);
  let formData = $state({
    type: 'yookassa',
    name: '',
    isActive: true,
    isDefault: false,
    config: {} as Record<string, string>,
    position: 0,
  });
  let saving = $state(false);

  // Config fields by provider type
  const CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; type: string; placeholder?: string; required?: boolean }>> = {
    yookassa: [
      { key: 'shopId', label: 'Shop ID', type: 'text', placeholder: '123456', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'live_...', required: true },
      { key: 'returnUrl', label: 'Return URL', type: 'url', placeholder: 'https://example.com/payment/success' },
    ],
    telegram_stars: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-...', required: true },
      { key: 'providerToken', label: 'Provider Token', type: 'password', placeholder: 'Telegram Payment Provider Token' },
    ],
    cash: [],
    bank_transfer: [
      { key: 'bankName', label: 'Название банка', type: 'text', placeholder: 'Сбербанк' },
      { key: 'accountNumber', label: 'Номер счёта', type: 'text', placeholder: '40817810...' },
      { key: 'bik', label: 'БИК', type: 'text', placeholder: '044525225' },
      { key: 'inn', label: 'ИНН', type: 'text', placeholder: '7707083893' },
    ],
  };

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load providers
  async function loadProviders() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<PaymentProvider[]>('/api/admin/payments/providers');
      providers = data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки провайдеров';
    } finally {
      loading = false;
    }
  }

  // Get provider info
  function getProviderInfo(type: string) {
    return PROVIDER_TYPES.find(p => p.type === type) || { icon: '💳', name: type, description: '' };
  }

  // Open modal for create/edit
  function openModal(provider?: PaymentProvider) {
    if (provider) {
      editingProvider = provider;
      formData = {
        type: provider.type,
        name: provider.name,
        isActive: provider.isActive,
        isDefault: provider.isDefault,
        config: { ...provider.config },
        position: provider.position,
      };
    } else {
      editingProvider = null;
      const typeInfo = PROVIDER_TYPES[0];
      formData = {
        type: typeInfo.type,
        name: typeInfo.name,
        isActive: true,
        isDefault: providers.length === 0,
        config: {},
        position: providers.length,
      };
    }
    showModal = true;
  }

  // Close modal
  function closeModal() {
    showModal = false;
    editingProvider = null;
  }

  // Update form when type changes
  function onTypeChange(newType: string) {
    formData.type = newType;
    const typeInfo = PROVIDER_TYPES.find(p => p.type === newType);
    if (typeInfo && !editingProvider) {
      formData.name = typeInfo.name;
    }
    // Reset config for new type
    if (!editingProvider) {
      formData.config = {};
    }
  }

  // Save provider
  async function saveProvider() {
    if (!formData.name.trim()) {
      showNotification('error', 'Введите название провайдера');
      return;
    }

    // Validate required config fields
    const fields = CONFIG_FIELDS[formData.type] || [];
    for (const field of fields) {
      if (field.required && !formData.config[field.key]?.trim()) {
        showNotification('error', `Заполните поле "${field.label}"`);
        return;
      }
    }

    saving = true;

    try {
      const payload = {
        type: formData.type,
        name: formData.name.trim(),
        isActive: formData.isActive,
        isDefault: formData.isDefault,
        config: formData.config,
        position: formData.position,
      };

      if (editingProvider) {
        await apiFetch(`/api/admin/payments/providers/${editingProvider.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Провайдер обновлён');
      } else {
        await apiFetch('/api/admin/payments/providers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Провайдер добавлен');
      }

      closeModal();
      loadProviders();
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Toggle active status
  async function toggleActive(provider: PaymentProvider) {
    try {
      await apiFetch(`/api/admin/payments/providers/${provider.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !provider.isActive }),
      });
      showNotification('success', provider.isActive ? 'Провайдер отключён' : 'Провайдер включён');
      loadProviders();
    } catch (e) {
      console.error('Toggle active error:', e);
      showNotification('error', 'Не удалось обновить статус');
    }
  }

  // Set as default
  async function setDefault(provider: PaymentProvider) {
    if (provider.isDefault) return;

    try {
      await apiFetch(`/api/admin/payments/providers/${provider.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isDefault: true }),
      });
      showNotification('success', `${provider.name} установлен по умолчанию`);
      loadProviders();
    } catch (e) {
      console.error('Set default error:', e);
      showNotification('error', 'Не удалось установить провайдер по умолчанию');
    }
  }

  // Delete provider
  async function deleteProvider(provider: PaymentProvider) {
    if (provider.isDefault) {
      showNotification('error', 'Нельзя удалить провайдер по умолчанию');
      return;
    }

    if (!confirm(`Удалить платёжный провайдер "${provider.name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/api/admin/payments/providers/${provider.id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Провайдер удалён');
      loadProviders();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить провайдер');
    }
  }

  // Initial load
  onMount(() => {
    loadProviders();
  });
</script>

<div class="providers-list">
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
    <h2 class="toolbar-title">Платёжные провайдеры</h2>
    <div class="toolbar-actions">
      <button onclick={() => openModal()} class="btn btn-primary">
        ➕ Добавить провайдер
      </button>
    </div>
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
      <button onclick={loadProviders} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if providers.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💳</div>
      <h3>Платёжные провайдеры не настроены</h3>
      <p>Добавьте способы оплаты для вашего магазина</p>
      <button onclick={() => openModal()} class="btn btn-primary">
        Добавить провайдер
      </button>
    </div>
  {:else}
    <div class="providers-grid">
      {#each providers as provider (provider.id)}
        {@const info = getProviderInfo(provider.type)}
        <div class="provider-card" class:inactive={!provider.isActive} class:default={provider.isDefault}>
          <div class="provider-header">
            <div class="provider-icon">{info.icon}</div>
            <div class="provider-info">
              <div class="provider-name">{provider.name}</div>
              <div class="provider-type">{info.description}</div>
            </div>
            {#if provider.isDefault}
              <span class="default-badge">По умолчанию</span>
            {/if}
          </div>

          <div class="provider-status">
            <span class="status-dot" class:active={provider.isActive}></span>
            <span class="status-text">{provider.isActive ? 'Активен' : 'Отключён'}</span>
          </div>

          <div class="provider-actions">
            <button
              onclick={() => openModal(provider)}
              class="action-btn"
              title="Настроить"
            >
              ⚙️
            </button>
            {#if !provider.isDefault}
              <button
                onclick={() => setDefault(provider)}
                class="action-btn"
                title="Сделать основным"
              >
                ⭐
              </button>
            {/if}
            <button
              onclick={() => toggleActive(provider)}
              class="action-btn"
              title={provider.isActive ? 'Отключить' : 'Включить'}
            >
              {provider.isActive ? '🔴' : '🟢'}
            </button>
            {#if !provider.isDefault}
              <button
                onclick={() => deleteProvider(provider)}
                class="action-btn action-delete"
                title="Удалить"
              >
                🗑️
              </button>
            {/if}
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
          <h2>{editingProvider ? 'Настройка провайдера' : 'Новый провайдер'}</h2>
          <button type="button" class="modal-close" onclick={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="provider-type">Тип провайдера</label>
            <select
              id="provider-type"
              value={formData.type}
              onchange={(e) => onTypeChange((e.target as HTMLSelectElement).value)}
              class="form-input"
              disabled={!!editingProvider}
            >
              {#each PROVIDER_TYPES as type}
                <option value={type.type}>{type.icon} {type.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="provider-name">Название *</label>
            <input
              type="text"
              id="provider-name"
              bind:value={formData.name}
              placeholder="Название для покупателей"
              class="form-input"
            />
          </div>

          <!-- Dynamic config fields -->
          {#each CONFIG_FIELDS[formData.type] || [] as field}
            <div class="form-group">
              <label for="config-{field.key}">
                {field.label} {field.required ? '*' : ''}
              </label>
              <input
                type={field.type}
                id="config-{field.key}"
                bind:value={formData.config[field.key]}
                placeholder={field.placeholder}
                class="form-input"
              />
            </div>
          {/each}

          <div class="form-row">
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.isActive}
                />
                <span>Активен</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={formData.isDefault}
                />
                <span>По умолчанию</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={closeModal}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={saveProvider} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .providers-list {
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
    flex-wrap: wrap;
  }

  .toolbar-title {
    margin: 0;
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-semibold);
  }

  .toolbar-actions {
    display: flex;
    gap: var(--spacing-2);
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

  /* Providers grid */
  .providers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-4);
  }

  .provider-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    transition: all var(--transition-fast);
  }

  .provider-card:hover {
    box-shadow: var(--shadow-md);
  }

  .provider-card.inactive {
    opacity: 0.6;
  }

  .provider-card.default {
    border-color: var(--color-primary);
    border-width: 2px;
  }

  .provider-header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-3);
  }

  .provider-icon {
    font-size: 2rem;
  }

  .provider-info {
    flex: 1;
  }

  .provider-name {
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text);
  }

  .provider-type {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .default-badge {
    padding: 2px 8px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
    white-space: nowrap;
  }

  .provider-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .status-dot.active {
    background: var(--color-success);
  }

  .status-text {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-secondary);
  }

  .provider-actions {
    display: flex;
    gap: var(--spacing-1);
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-3);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1.1rem;
    transition: background var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--color-background-secondary);
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

  .form-row {
    display: flex;
    gap: var(--spacing-6);
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

  .form-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
