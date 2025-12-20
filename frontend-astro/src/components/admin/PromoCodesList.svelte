<script lang="ts">
  /**
   * Promo Codes List Component
   *
   * Manage promotional codes (discounts, coupons)
   * Features: CRUD, percentage/fixed discounts, usage limits, date ranges
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface PromoCode {
    id: number;
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minOrderAmount: number | null;
    maxDiscount: number | null;
    usageLimit: number | null;
    usageCount: number;
    perUserLimit: number | null;
    startsAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }

  let promoCodes: PromoCode[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit modal
  let showModal = $state(false);
  let editingCode = $state<PromoCode | null>(null);
  let formData = $state({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: '',
    startsAt: '',
    expiresAt: '',
    isActive: true,
    description: '',
  });
  let saving = $state(false);

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load promo codes
  async function loadPromoCodes() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch<PromoCode[]>('/api/admin/promo');
      promoCodes = data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки промокодов';
    } finally {
      loading = false;
    }
  }

  // Generate random code
  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    formData.code = code;
  }

  // Format date for input
  function formatDateForInput(date: string | null): string {
    if (!date) return '';
    return new Date(date).toISOString().slice(0, 16);
  }

  // Open modal for create/edit
  function openModal(code?: PromoCode) {
    if (code) {
      editingCode = code;
      formData = {
        code: code.code,
        discountType: code.discountType,
        discountValue: code.discountValue,
        minOrderAmount: code.minOrderAmount?.toString() || '',
        maxDiscount: code.maxDiscount?.toString() || '',
        usageLimit: code.usageLimit?.toString() || '',
        perUserLimit: code.perUserLimit?.toString() || '',
        startsAt: formatDateForInput(code.startsAt),
        expiresAt: formatDateForInput(code.expiresAt),
        isActive: code.isActive,
        description: code.description || '',
      };
    } else {
      editingCode = null;
      formData = {
        code: '',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: '',
        maxDiscount: '',
        usageLimit: '',
        perUserLimit: '',
        startsAt: '',
        expiresAt: '',
        isActive: true,
        description: '',
      };
      generateCode();
    }
    showModal = true;
  }

  // Close modal
  function closeModal() {
    showModal = false;
    editingCode = null;
  }

  // Save promo code
  async function savePromoCode() {
    if (!formData.code.trim()) {
      showNotification('error', 'Введите код промокода');
      return;
    }

    if (formData.discountValue <= 0) {
      showNotification('error', 'Укажите размер скидки');
      return;
    }

    if (formData.discountType === 'percentage' && formData.discountValue > 100) {
      showNotification('error', 'Процент скидки не может превышать 100%');
      return;
    }

    saving = true;

    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit) : null,
        startsAt: formData.startsAt || null,
        expiresAt: formData.expiresAt || null,
        isActive: formData.isActive,
        description: formData.description.trim() || null,
      };

      if (editingCode) {
        await apiFetch(`/api/admin/promo/${editingCode.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Промокод обновлён');
      } else {
        await apiFetch('/api/admin/promo', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Промокод создан');
      }

      closeModal();
      loadPromoCodes();
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Toggle active status
  async function toggleActive(code: PromoCode) {
    try {
      await apiFetch(`/api/admin/promo/${code.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !code.isActive }),
      });
      showNotification('success', code.isActive ? 'Промокод отключён' : 'Промокод активирован');
      loadPromoCodes();
    } catch (e) {
      console.error('Toggle active error:', e);
      showNotification('error', 'Не удалось обновить статус');
    }
  }

  // Delete promo code
  async function deletePromoCode(code: PromoCode) {
    if (!confirm(`Удалить промокод "${code.code}"?`)) {
      return;
    }

    try {
      await apiFetch(`/api/admin/promo/${code.id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Промокод удалён');
      loadPromoCodes();
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('error', 'Не удалось удалить промокод');
    }
  }

  // Format discount display
  function formatDiscount(code: PromoCode): string {
    if (code.discountType === 'percentage') {
      return `-${code.discountValue}%`;
    }
    return `-${code.discountValue} ₽`;
  }

  // Check if code is expired
  function isExpired(code: PromoCode): boolean {
    if (!code.expiresAt) return false;
    return new Date(code.expiresAt) < new Date();
  }

  // Check if code hasn't started
  function isNotStarted(code: PromoCode): boolean {
    if (!code.startsAt) return false;
    return new Date(code.startsAt) > new Date();
  }

  // Check if usage limit reached
  function isLimitReached(code: PromoCode): boolean {
    if (!code.usageLimit) return false;
    return code.usageCount >= code.usageLimit;
  }

  // Get status info
  function getStatus(code: PromoCode): { text: string; class: string } {
    if (!code.isActive) return { text: 'Отключён', class: 'status-inactive' };
    if (isExpired(code)) return { text: 'Истёк', class: 'status-expired' };
    if (isNotStarted(code)) return { text: 'Ожидает', class: 'status-pending' };
    if (isLimitReached(code)) return { text: 'Лимит исчерпан', class: 'status-limit' };
    return { text: 'Активен', class: 'status-active' };
  }

  // Initial load
  onMount(() => {
    loadPromoCodes();
  });
</script>

<div class="promo-list">
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
    <h2 class="toolbar-title">Промокоды</h2>
    <div class="toolbar-actions">
      <button onclick={() => openModal()} class="btn btn-primary">
        ➕ Создать промокод
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
      <button onclick={loadPromoCodes} class="btn btn-secondary">Повторить</button>
    </div>
  {:else if promoCodes.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎟️</div>
      <h3>Промокоды не созданы</h3>
      <p>Создайте промокоды для скидок и акций</p>
      <button onclick={() => openModal()} class="btn btn-primary">
        Создать промокод
      </button>
    </div>
  {:else}
    <div class="promo-table-wrapper">
      <table class="promo-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Скидка</th>
            <th>Использований</th>
            <th>Период</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each promoCodes as code (code.id)}
            {@const status = getStatus(code)}
            <tr class:inactive={!code.isActive}>
              <td>
                <div class="code-cell">
                  <code class="promo-code">{code.code}</code>
                  {#if code.description}
                    <span class="code-description">{code.description}</span>
                  {/if}
                </div>
              </td>
              <td>
                <span class="discount-badge">{formatDiscount(code)}</span>
                {#if code.minOrderAmount}
                  <div class="min-order">от {code.minOrderAmount} ₽</div>
                {/if}
              </td>
              <td>
                <div class="usage-info">
                  <span class="usage-count">{code.usageCount}</span>
                  {#if code.usageLimit}
                    <span class="usage-limit">/ {code.usageLimit}</span>
                  {:else}
                    <span class="usage-limit">/ ∞</span>
                  {/if}
                </div>
              </td>
              <td>
                <div class="period-info">
                  {#if code.startsAt}
                    <div class="period-start">с {new Date(code.startsAt).toLocaleDateString('ru-RU')}</div>
                  {/if}
                  {#if code.expiresAt}
                    <div class="period-end">до {new Date(code.expiresAt).toLocaleDateString('ru-RU')}</div>
                  {/if}
                  {#if !code.startsAt && !code.expiresAt}
                    <span class="no-limit">Бессрочно</span>
                  {/if}
                </div>
              </td>
              <td>
                <span class="status-badge {status.class}">{status.text}</span>
              </td>
              <td>
                <div class="actions">
                  <button
                    onclick={() => openModal(code)}
                    class="action-btn"
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    onclick={() => toggleActive(code)}
                    class="action-btn"
                    title={code.isActive ? 'Отключить' : 'Включить'}
                  >
                    {code.isActive ? '🔴' : '🟢'}
                  </button>
                  <button
                    onclick={() => deletePromoCode(code)}
                    class="action-btn action-delete"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" onclick={closeModal}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{editingCode ? 'Редактирование промокода' : 'Новый промокод'}</h2>
          <button type="button" class="modal-close" onclick={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="promo-code">Код промокода *</label>
            <div class="code-input-group">
              <input
                type="text"
                id="promo-code"
                bind:value={formData.code}
                placeholder="SALE2024"
                class="form-input"
                style="text-transform: uppercase"
              />
              <button type="button" class="btn btn-secondary" onclick={generateCode}>
                🎲
              </button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="discount-type">Тип скидки</label>
              <select
                id="discount-type"
                bind:value={formData.discountType}
                class="form-input"
              >
                <option value="percentage">Процент (%)</option>
                <option value="fixed">Фиксированная (₽)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="discount-value">
                Размер скидки * {formData.discountType === 'percentage' ? '(%)' : '(₽)'}
              </label>
              <input
                type="number"
                id="discount-value"
                bind:value={formData.discountValue}
                min="0"
                max={formData.discountType === 'percentage' ? 100 : undefined}
                step={formData.discountType === 'percentage' ? 1 : 0.01}
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="min-order">Мин. сумма заказа (₽)</label>
              <input
                type="number"
                id="min-order"
                bind:value={formData.minOrderAmount}
                placeholder="1000"
                min="0"
                step="0.01"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="max-discount">Макс. скидка (₽)</label>
              <input
                type="number"
                id="max-discount"
                bind:value={formData.maxDiscount}
                placeholder="5000"
                min="0"
                step="0.01"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="usage-limit">Лимит использований</label>
              <input
                type="number"
                id="usage-limit"
                bind:value={formData.usageLimit}
                placeholder="100"
                min="1"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="per-user-limit">На пользователя</label>
              <input
                type="number"
                id="per-user-limit"
                bind:value={formData.perUserLimit}
                placeholder="1"
                min="1"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="starts-at">Начало действия</label>
              <input
                type="datetime-local"
                id="starts-at"
                bind:value={formData.startsAt}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="expires-at">Окончание</label>
              <input
                type="datetime-local"
                id="expires-at"
                bind:value={formData.expiresAt}
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="description">Описание</label>
            <input
              type="text"
              id="description"
              bind:value={formData.description}
              placeholder="Скидка на первый заказ"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={formData.isActive}
              />
              <span>Активен</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={closeModal}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={savePromoCode} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .promo-list {
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

  /* Table */
  .promo-table-wrapper {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow-x: auto;
  }

  .promo-table {
    width: 100%;
    border-collapse: collapse;
  }

  .promo-table th,
  .promo-table td {
    padding: var(--spacing-3) var(--spacing-4);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .promo-table th {
    background: var(--color-background-secondary);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-text-secondary);
  }

  .promo-table tbody tr:hover {
    background: var(--color-background-secondary);
  }

  .promo-table tbody tr.inactive {
    opacity: 0.6;
  }

  .code-cell {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .promo-code {
    font-family: var(--font-family-mono);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
    color: var(--color-primary);
    background: var(--color-primary-light);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
  }

  .code-description {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .discount-badge {
    display: inline-block;
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-bold);
    color: var(--color-success);
  }

  .min-order {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .usage-info {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-1);
  }

  .usage-count {
    font-weight: var(--font-font-weight-semibold);
  }

  .usage-limit {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .period-info {
    font-size: var(--font-font-size-sm);
  }

  .period-start,
  .period-end {
    color: var(--color-text-secondary);
  }

  .no-limit {
    color: var(--color-text-muted);
  }

  .status-badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  .status-active {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .status-inactive {
    background: var(--color-background-tertiary);
    color: var(--color-text-muted);
  }

  .status-expired {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .status-pending {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .status-limit {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .actions {
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
    max-width: 550px;
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

  .code-input-group {
    display: flex;
    gap: var(--spacing-2);
  }

  .code-input-group .form-input {
    flex: 1;
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
