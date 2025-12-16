<script lang="ts">
  /**
   * Sync Status Component
   *
   * Displays connection status, pending transactions count, and manual sync button.
   * Uses Svelte 5 runes for reactive state management.
   */

  import { onMount } from 'svelte';
  import { syncPendingTransactions, offlineDB } from '$lib/pos/sync';

  // Reactive state с Svelte 5 runes
  let syncStatus = $state<'idle' | 'syncing' | 'error'>('idle');
  let pendingCount = $state(0);
  let lastSyncTime = $state<Date | null>(null);
  let isOnline = $state(navigator.onLine);

  // Обновление счётчика несинхронизированных транзакций
  async function updatePendingCount() {
    const count = await offlineDB.pendingTransactions
      .where('synced')
      .equals(false)
      .count();

    pendingCount = count;
  }

  // Ручная синхронизация
  async function handleManualSync() {
    if (!isOnline) {
      window.Telegram?.WebApp.showAlert('Нет подключения к интернету');
      return;
    }

    syncStatus = 'syncing';

    try {
      const result = await syncPendingTransactions();

      if (result.syncedCount > 0) {
        lastSyncTime = new Date();
        await updatePendingCount();

        window.Telegram?.WebApp.showAlert(
          `Синхронизировано: ${result.syncedCount} транзакций`
        );
      } else {
        window.Telegram?.WebApp.showAlert('Нет транзакций для синхронизации');
      }

      syncStatus = 'idle';

    } catch (error) {
      console.error('Sync error:', error);
      syncStatus = 'error';

      window.Telegram?.WebApp.showAlert(
        'Ошибка синхронизации. Попробуйте позже.'
      );
    }
  }

  // Слушаем изменение online статуса
  function handleOnlineStatus() {
    window.addEventListener('online', () => {
      isOnline = true;
      handleManualSync(); // Автосинхронизация при восстановлении связи
    });

    window.addEventListener('offline', () => {
      isOnline = false;
    });
  }

  // Форматирование времени
  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'только что';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;

    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onMount(() => {
    updatePendingCount();
    handleOnlineStatus();

    // Обновляем счётчик каждые 30 секунд
    const interval = setInterval(updatePendingCount, 30000);

    return () => {
      clearInterval(interval);
    };
  });
</script>

<div class="sync-status-panel">
  <!-- Статус подключения -->
  <div class="connection-status" class:online={isOnline} class:offline={!isOnline}>
    <span class="status-dot"></span>
    <span class="status-text">
      {isOnline ? 'Онлайн' : 'Оффлайн режим'}
    </span>
  </div>

  <!-- Индикатор несинхронизированных транзакций -->
  {#if pendingCount > 0}
    <div class="pending-sync-badge" onclick={handleManualSync} role="button" tabindex="0">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4V2.21c0-.45-.54-.67-.85-.35l-2.8 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.32.31.86.09.86-.36V6c3.31 0 6 2.69 6 6 0 .79-.15 1.56-.44 2.25-.15.36-.04.77.23 1.04.51.51 1.37.33 1.64-.34.37-.91.57-1.91.57-2.95 0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-.79.15-1.56.44-2.25.15-.36.04-.77-.23-1.04-.51-.51-1.37-.33-1.64.34C4.2 9.96 4 10.96 4 12c0 4.42 3.58 8 8 8v1.79c0 .45.54.67.85.35l2.79-2.79c.2-.2.2-.51 0-.71l-2.79-2.79c-.31-.31-.85-.09-.85.36V18z"/>
      </svg>
      <span>{pendingCount} не синхр.</span>
    </div>
  {/if}

  <!-- Кнопка синхронизации -->
  <button
    class="sync-button"
    onclick={handleManualSync}
    disabled={syncStatus === 'syncing' || !isOnline}
    aria-label="Синхронизировать транзакции"
  >
    {#if syncStatus === 'syncing'}
      <div class="spinner" aria-hidden="true"></div>
      <span>Синхронизация...</span>
    {:else if syncStatus === 'error'}
      <svg class="icon error" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>Повторить</span>
    {:else}
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4V2.21c0-.45-.54-.67-.85-.35l-2.8 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.32.31.86.09.86-.36V6c3.31 0 6 2.69 6 6 0 .79-.15 1.56-.44 2.25-.15.36-.04.77.23 1.04.51.51 1.37.33 1.64-.34.37-.91.57-1.91.57-2.95 0-4.42-3.58-8-8-8z"/>
      </svg>
      <span>Синхронизировать</span>
    {/if}
  </button>

  <!-- Время последней синхронизации -->
  {#if lastSyncTime}
    <div class="last-sync">
      Последняя синхр.: {formatTimeAgo(lastSyncTime)}
    </div>
  {/if}
</div>

<style>
  .sync-status-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--tg-theme-secondary-bg-color, #f4f4f5);
    border-bottom: 1px solid var(--tg-theme-section-separator-color, #e5e5e7);
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
  }

  .connection-status.online {
    background: #E8F5E9;
    color: #2E7D32;
  }

  .connection-status.offline {
    background: #FFF3E0;
    color: #E65100;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .online .status-dot {
    background: #4CAF50;
  }

  .offline .status-dot {
    background: #FF9800;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .pending-sync-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #FFF3E0;
    border: 1px solid #FFB74D;
    border-radius: 16px;
    color: #E65100;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pending-sync-badge:hover {
    background: #FFE0B2;
    border-color: #FFA726;
  }

  .sync-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--tg-theme-button-color, #3390EC);
    color: var(--tg-theme-button-text-color, #fff);
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sync-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .sync-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .sync-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
    flex-shrink: 0;
  }

  .icon.error {
    fill: #f44336;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .last-sync {
    margin-left: auto;
    font-size: 12px;
    color: var(--tg-theme-hint-color, #999);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .sync-status-panel {
      flex-wrap: wrap;
    }

    .last-sync {
      margin-left: 0;
      width: 100%;
      text-align: center;
    }
  }
</style>
