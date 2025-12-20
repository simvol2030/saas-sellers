<script lang="ts">
  /**
   * Currencies List Component
   *
   * Manage store currencies and exchange rates
   * Features: CRUD, set default, seed currencies
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Currency {
    id: number;
    code: string;
    symbol: string;
    name: string;
    rate: number;
    isDefault: boolean;
    isActive: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
  }

  let currencies: Currency[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit modal
  let showModal = $state(false);
  let editingCurrency = $state<Currency | null>(null);
  let formData = $state({
    code: '',
    symbol: '',
    name: '',
    rate: 1,
    isDefault: false,
    isActive: true,
    position: 0,
  });
  let saving = $state(false);
  let seeding = $state(false);

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load currencies
  async function loadCurrencies() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<Currency[]>('/api/admin/currencies');
      currencies = data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки валют';
    } finally {
      loading = false;
    }
  }

  // Open modal for create/edit
  function openModal(currency?: Currency) {
    if (currency) {
      editingCurrency = currency;
      formData = {
        code: currency.code,
        symbol: currency.symbol,
        name: currency.name,
        rate: currency.rate,
        isDefault: currency.isDefault,
        isActive: currency.isActive,
        position: currency.position,
      };
    } else {
      editingCurrency = null;
      formData = {
        code: '',
        symbol: '',
        name: '',
        rate: 1,
        isDefault: false,
        isActive: true,
        position: currencies.length,
      };
    }
    showModal = true;
  }

  // Close modal
  function closeModal() {
    showModal = false;
    editingCurrency = null;
  }

  // Save currency
  async function saveCurrency() {
    if (!formData.code.trim() || !formData.symbol.trim() || !formData.name.trim()) {
      showNotification('error', 'Заполните все обязательные поля');
      return;
    }

    saving = true;

    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        symbol: formData.symbol.trim(),
        name: formData.name.trim(),
        rate: formData.rate,
        isDefault: formData.isDefault,
        isActive: formData.isActive,
        position: formData.position,
      };

      if (editingCurrency) {
        await apiFetch(`/api/admin/currencies/${editingCurrency.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Валюта обновлена');
      } else {
        await apiFetch('/api/admin/currencies', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Валюта создана');
      }

      closeModal();
      loadCurrencies();
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Update exchange rate
  async function updateRate(currency: Currency, newRate: number) {
    try {
      await apiFetch(`/api/admin/currencies/${currency.id}/rates`, {
        method: 'POST',
        body: JSON.stringify({ rate: newRate }),
      });
      showNotification('success', `Курс ${currency.code} обновлён`);
      loadCurrencies();
    } catch (e) {
      console.error('Update rate error:', e);
      showNotification('error', 'Не удалось обновить курс');
    }
  }

  // Toggle active status
  async function toggleActive(currency: Currency) {
    try {
      await apiFetch(`/api/admin/currencies/${currency.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currency.isActive }),
      });
      showNotification('success', currency.isActive ? 'Валюта скрыта' : 'Валюта активирована');
      loadCurrencies();
    } catch (e) {
      console.error('Toggle active error:', e);
      showNotification('error', 'Не удалось обновить статус');
    }
  }

  // Set as default
  async function setDefault(currency: Currency) {
    if (currency.isDefault) return;

    try {
      await apiFetch(`/api/admin/currencies/${currency.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isDefault: true }),
      });
      showNotification('success', `${currency.code} установлена как основная`);
      loadCurrencies();
    } catch (e) {
      console.error('Set default error:', e);
      showNotification('error', 'Не удалось установить валюту по умолчанию');
    }
  }

  // Delete currency
  async function deleteCurrency(currency: Currency) {
    if (currency.isDefault) {
      showNotification('error', 'Нельзя удалить валюту по умолчанию');
      return;
    }

    if (!confirm(`Удалить валюту "${currency.name}" (${currency.code})?`)) {
      return;
    }

    try {
      await apiFetch(`/api/admin/currencies/${currency.id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Валюта удалена');
      loadCurrencies();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить валюту');
    }
  }

  // Seed default currencies
  async function seedCurrencies() {
    seeding = true;
    try {
      const result = await apiFetch<{ created: string[]; skipped: string[] }>('/api/admin/currencies/seed', {
        method: 'POST',
      });
      if (result.created.length > 0) {
        showNotification('success', `Добавлены валюты: ${result.created.join(', ')}`);
      } else {
        showNotification('success', 'Все валюты уже существуют');
      }
      loadCurrencies();
    } catch (e: any) {
      console.error('Seed error:', e);
      showNotification('error', e.message || 'Ошибка добавления валют');
    } finally {
      seeding = false;
    }
  }

  // Initial load
  onMount(() => {
    loadCurrencies();
  });
</script>

<div class="currencies-list">
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
    <h2 class="toolbar-title">Валюты магазина</h2>
    <div class="toolbar-actions">
      <button onclick={seedCurrencies} class="btn btn-secondary" disabled={seeding}>
        {seeding ? 'Добавление...' : '🌍 Добавить стандартные'}
      </button>
      <button onclick={() => openModal()} class="btn btn-primary">
        ➕ Добавить валюту
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
      <button onclick={loadCurrencies} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if currencies.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💱</div>
      <h3>Валюты не настроены</h3>
      <p>Добавьте валюты для вашего магазина</p>
      <div class="empty-actions">
        <button onclick={seedCurrencies} class="btn btn-secondary" disabled={seeding}>
          🌍 Добавить стандартные валюты
        </button>
        <button onclick={() => openModal()} class="btn btn-primary">
          Добавить валюту
        </button>
      </div>
    </div>
  {:else}
    <div class="currencies-grid">
      {#each currencies as currency (currency.id)}
        <div class="currency-card" class:inactive={!currency.isActive} class:default={currency.isDefault}>
          <div class="currency-header">
            <div class="currency-symbol">{currency.symbol}</div>
            <div class="currency-code">{currency.code}</div>
            {#if currency.isDefault}
              <span class="default-badge">По умолчанию</span>
            {/if}
          </div>
          <div class="currency-name">{currency.name}</div>
          <div class="currency-rate">
            <label>Курс:</label>
            <input
              type="number"
              value={currency.rate}
              step="0.0001"
              min="0"
              onchange={(e) => updateRate(currency, parseFloat((e.target as HTMLInputElement).value))}
              class="rate-input"
            />
          </div>
          <div class="currency-actions">
            <button
              onclick={() => openModal(currency)}
              class="action-btn"
              title="Редактировать"
            >
              ✏️
            </button>
            {#if !currency.isDefault}
              <button
                onclick={() => setDefault(currency)}
                class="action-btn"
                title="Сделать основной"
              >
                ⭐
              </button>
            {/if}
            <button
              onclick={() => toggleActive(currency)}
              class="action-btn"
              title={currency.isActive ? 'Скрыть' : 'Показать'}
            >
              {currency.isActive ? '👁️' : '👁️‍🗨️'}
            </button>
            {#if !currency.isDefault}
              <button
                onclick={() => deleteCurrency(currency)}
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
          <h2>{editingCurrency ? 'Редактирование валюты' : 'Новая валюта'}</h2>
          <button type="button" class="modal-close" onclick={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label for="curr-code">Код валюты *</label>
              <input
                type="text"
                id="curr-code"
                bind:value={formData.code}
                placeholder="USD"
                class="form-input"
                maxlength="10"
              />
            </div>
            <div class="form-group">
              <label for="curr-symbol">Символ *</label>
              <input
                type="text"
                id="curr-symbol"
                bind:value={formData.symbol}
                placeholder="$"
                class="form-input"
                maxlength="5"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="curr-name">Название *</label>
            <input
              type="text"
              id="curr-name"
              bind:value={formData.name}
              placeholder="Доллар США"
              class="form-input"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="curr-rate">Курс к базовой</label>
              <input
                type="number"
                id="curr-rate"
                bind:value={formData.rate}
                step="0.0001"
                min="0"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="curr-position">Позиция</label>
              <input
                type="number"
                id="curr-position"
                bind:value={formData.position}
                min="0"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={formData.isActive}
              />
              <span>Активна (видна покупателям)</span>
            </label>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={formData.isDefault}
              />
              <span>Основная валюта</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={closeModal}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={saveCurrency} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .currencies-list {
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

  .empty-actions {
    display: flex;
    gap: var(--spacing-3);
  }

  /* Currencies grid */
  .currencies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-4);
  }

  .currency-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    transition: all var(--transition-fast);
  }

  .currency-card:hover {
    box-shadow: var(--shadow-md);
  }

  .currency-card.inactive {
    opacity: 0.6;
  }

  .currency-card.default {
    border-color: var(--color-primary);
    border-width: 2px;
  }

  .currency-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
  }

  .currency-symbol {
    font-size: var(--font-font-size-2xl);
    font-weight: var(--font-font-weight-bold);
    color: var(--color-primary);
  }

  .currency-code {
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text);
  }

  .default-badge {
    margin-left: auto;
    padding: 2px 8px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  .currency-name {
    color: var(--color-text-secondary);
    font-size: var(--font-font-size-sm);
    margin-bottom: var(--spacing-3);
  }

  .currency-rate {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
  }

  .currency-rate label {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .rate-input {
    flex: 1;
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    max-width: 120px;
  }

  .rate-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .currency-actions {
    display: flex;
    gap: var(--spacing-1);
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-3);
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
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
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
