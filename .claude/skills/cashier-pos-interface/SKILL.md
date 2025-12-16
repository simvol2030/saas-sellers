---
name: cashier-pos-interface
description: Экспертный навык для разработки POS-интерфейса кассира в Telegram Mini App. Поддержка offline mode, печати чеков ESC/POS, QR-сканирования карт лояльности, автосинхронизации продаж, начисления/списания баллов. Используется для создания надёжных торговых точек с offline-first архитектурой.
---

# Навык: Интерфейс POS-кассира для системы лояльности

## Описание

Экспертный навык для разработки POS-интерфейса кассира в Telegram Mini App с поддержкой:
- Offline mode для бесперебойной работы при отсутствии интернета
- Печати чеков через ESC/POS принтеры и star-printer-api
- Автоматической синхронизации продаж с бэкендом
- QR-сканирования карт лояльности через Telegram
- Начисления/списания баллов в момент покупки
- Обработки транзакций с откатом (rollback) при ошибках

Используется в контексте Telegram WebApp для кассиров магазинов, где необходима высокая надёжность работы независимо от качества интернет-соединения.

---

## Когда использовать

- Разработка POS-интерфейса для кассиров в Telegram Mini App
- Реализация offline-first архитектуры для торговых точек
- Интеграция с принтерами чеков (USB, Bluetooth, Wi-Fi)
- Синхронизация офлайн-продаж с централизованным бэкендом
- Работа с QR-кодами карт лояльности через Telegram WebApp
- Обработка транзакций начисления/списания баллов
- Реализация очереди отложенных операций (offline queue)

---

## Основные возможности

### 1. Сканировать QR-код карты лояльности через Telegram

Интегрировать сканирование QR-кода карты клиента с валидацией и получением информации о балансе.

**Технологии**: Telegram WebApp API 6.2+, showScanQrPopup(), validateQR()

**Пример workflow**:

```typescript
import { scanQRCode } from '$lib/telegram/qr_scanner';
import { validateQR } from '$lib/loyalty/qr_validator';

async function scanCustomerCard() {
  try {
    const qrData = await scanQRCode({
      text: 'Отсканируйте карту клиента'
    });

    const validated = await validateQR(qrData, {
      secretKey: env.QR_SECRET_KEY,
      maxAge: 300 // 5 минут
    });

    if (validated.type !== 'card') {
      throw new Error('Неверный тип QR-кода');
    }

    // Получаем данные клиента с сервера
    const customer = await fetchCustomerData(validated.customerId);

    return {
      customerId: customer.id,
      name: customer.name,
      tier: customer.tier,
      balance: customer.balance,
      cardNumber: validated.cardNumber
    };

  } catch (error) {
    if (error.message === 'QR scanning cancelled by user') {
      return null; // Кассир отменил сканирование
    }
    throw error;
  }
}
```

**Best Practices**:
- Всегда проверяйте `type === 'card'` после валидации
- Используйте `maxAge` для защиты от replay-атак
- Обрабатывайте отмену сканирования пользователем
- Показывайте haptic feedback при успешном сканировании

---

### 2. Начислить/списать баллы за покупку

Провести транзакцию начисления или списания баллов с учетом tier клиента и откатом при ошибках.

**Технологии**: Drizzle ORM transactions, SQLite offline storage, PostgreSQL sync

**Пример workflow**:

```typescript
import { db } from '$lib/db';
import { transactions, users } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

interface ProcessPurchaseParams {
  customerId: string;
  amount: number;
  paymentType: 'cash' | 'card' | 'points';
  pointsToRedeem?: number;
  storeId: string;
  cashierId: string;
}

async function processPurchase(params: ProcessPurchaseParams) {
  const {
    customerId,
    amount,
    paymentType,
    pointsToRedeem = 0,
    storeId,
    cashierId
  } = params;

  return await db.transaction(async (tx) => {
    // 1. Получаем клиента с блокировкой строки
    const customer = await tx
      .select()
      .from(users)
      .where(eq(users.id, customerId))
      .for('update')
      .then(rows => rows[0]);

    if (!customer) {
      throw new Error('Клиент не найден');
    }

    // 2. Проверяем баланс для списания
    if (pointsToRedeem > 0 && customer.balance < pointsToRedeem) {
      throw new Error(`Недостаточно баллов (доступно: ${customer.balance})`);
    }

    // 3. Рассчитываем начисление (зависит от tier)
    const accrualRate = getTierAccrualRate(customer.tier);
    const pointsToAccrue = Math.floor(amount * accrualRate);

    // 4. Обновляем баланс
    const balanceChange = pointsToAccrue - pointsToRedeem;

    await tx
      .update(users)
      .set({
        balance: sql`${users.balance} + ${balanceChange}`,
        updatedAt: new Date()
      })
      .where(eq(users.id, customerId));

    // 5. Создаём запись транзакции
    const [transaction] = await tx
      .insert(transactions)
      .values({
        customerId,
        type: paymentType === 'points' ? 'redemption' : 'accrual',
        amount: Math.abs(balanceChange),
        purchaseAmount: amount,
        storeId,
        cashierId,
        status: 'completed',
        createdAt: new Date()
      })
      .returning();

    return {
      transactionId: transaction.id,
      previousBalance: customer.balance,
      newBalance: customer.balance + balanceChange,
      pointsAccrued: pointsToAccrue,
      pointsRedeemed: pointsToRedeem
    };
  });
}

function getTierAccrualRate(tier: 'bronze' | 'silver' | 'gold' | 'platinum'): number {
  const rates = {
    bronze: 0.05,   // 5% от суммы
    silver: 0.07,   // 7%
    gold: 0.10,     // 10%
    platinum: 0.15  // 15%
  };
  return rates[tier];
}
```

**Best Practices**:
- Используйте database transactions для атомарности
- Блокируйте строку клиента (`for('update')`) для избежания race conditions
- Проверяйте баланс ПЕРЕД списанием
- Логируйте все транзакции для аудита
- Обрабатывайте откат транзакции при ошибках

---

### 3. Работать в offline mode с локальной очередью

Реализовать offline-first архитектуру с локальным хранилищем и отложенной синхронизацией.

**Технологии**: IndexedDB, Service Workers, Background Sync API, Drizzle SQLite

**Пример workflow**:

```typescript
import Dexie, { Table } from 'dexie';

// Локальная база данных для offline mode
class OfflineDatabase extends Dexie {
  pendingTransactions!: Table<PendingTransaction>;
  cachedCustomers!: Table<CachedCustomer>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('LoyaltyPOS');

    this.version(1).stores({
      pendingTransactions: '++id, customerId, timestamp, synced',
      cachedCustomers: 'id, lastUpdated',
      syncQueue: '++id, type, timestamp, retries'
    });
  }
}

const offlineDB = new OfflineDatabase();

interface PendingTransaction {
  id?: number;
  customerId: string;
  amount: number;
  pointsAccrued: number;
  pointsRedeemed: number;
  storeId: string;
  cashierId: string;
  timestamp: number;
  synced: boolean;
}

// Сохранение транзакции офлайн
async function savePurchaseOffline(purchase: ProcessPurchaseParams) {
  const transaction: PendingTransaction = {
    customerId: purchase.customerId,
    amount: purchase.amount,
    pointsAccrued: Math.floor(purchase.amount * 0.05), // Default rate
    pointsRedeemed: purchase.pointsToRedeem || 0,
    storeId: purchase.storeId,
    cashierId: purchase.cashierId,
    timestamp: Date.now(),
    synced: false
  };

  const id = await offlineDB.pendingTransactions.add(transaction);

  // Попытка синхронизации
  trySync();

  return id;
}

// Синхронизация очереди с сервером
async function syncPendingTransactions() {
  const pending = await offlineDB.pendingTransactions
    .where('synced')
    .equals(false)
    .toArray();

  if (pending.length === 0) return;

  const results = await fetch('/api/pos/sync-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: pending })
  });

  if (results.ok) {
    const data = await results.json();

    // Помечаем синхронизированные
    for (const id of data.syncedIds) {
      await offlineDB.pendingTransactions.update(id, { synced: true });
    }

    return data.syncedIds.length;
  }

  throw new Error('Sync failed');
}

// Проверка online статуса и автосинхронизация
function trySync() {
  if (navigator.onLine) {
    syncPendingTransactions().catch(error => {
      console.error('Sync failed:', error);
      // Повторная попытка через 30 секунд
      setTimeout(trySync, 30000);
    });
  }
}

// Слушаем изменение online статуса
window.addEventListener('online', () => {
  console.log('Connection restored, syncing...');
  trySync();
});

window.addEventListener('offline', () => {
  console.log('Connection lost, switching to offline mode');
});
```

**Best Practices**:
- Используйте Dexie.js для работы с IndexedDB (удобнее чем нативный API)
- Сохраняйте timestamp для разрешения конфликтов
- Кэшируйте данные клиентов для offline доступа
- Реализуйте exponential backoff для повторных попыток синхронизации
- Показывайте индикатор несинхронизированных транзакций в UI

---

### 4. Печатать чеки через ESC/POS принтер

Интегрировать печать чеков на термопринтеры через USB, Bluetooth или Wi-Fi.

**Технологии**: star-micronics/react-native-star-prnt, ESC/POS commands, Web Serial API

**Пример workflow** (для Telegram WebApp через Web Serial API):

```typescript
// Для браузера (Chrome 89+) через Web Serial API
interface ReceiptData {
  storeInfo: {
    name: string;
    address: string;
    inn: string;
  };
  transaction: {
    id: string;
    date: Date;
    cashier: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  payment: {
    total: number;
    cash?: number;
    change?: number;
    pointsRedeemed?: number;
  };
  loyalty: {
    pointsAccrued: number;
    previousBalance: number;
    newBalance: number;
  };
}

class ESCPOSPrinter {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  // ESC/POS команды
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';

  private commands = {
    INIT: `${this.ESC}@`,
    ALIGN_CENTER: `${this.ESC}a1`,
    ALIGN_LEFT: `${this.ESC}a0`,
    BOLD_ON: `${this.ESC}E1`,
    BOLD_OFF: `${this.ESC}E0`,
    TEXT_NORMAL: `${this.GS}!0`,
    TEXT_2X: `${this.GS}!17`,
    CUT: `${this.GS}V66\x00`,
    NEWLINE: '\n',
    SEPARATOR: '--------------------------------\n'
  };

  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API не поддерживается');
    }

    this.port = await (navigator as any).serial.requestPort();
    await this.port.open({ baudRate: 9600 });

    this.writer = this.port.writable.getWriter();
  }

  async disconnect() {
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  private async write(text: string) {
    if (!this.writer) throw new Error('Принтер не подключен');

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.writer.write(data);
  }

  async printReceipt(receipt: ReceiptData) {
    const { INIT, ALIGN_CENTER, ALIGN_LEFT, BOLD_ON, BOLD_OFF,
            TEXT_2X, TEXT_NORMAL, SEPARATOR, NEWLINE, CUT } = this.commands;

    // Инициализация
    await this.write(INIT);

    // Заголовок (центрировано, крупным шрифтом)
    await this.write(ALIGN_CENTER + TEXT_2X + BOLD_ON);
    await this.write(receipt.storeInfo.name + NEWLINE);
    await this.write(BOLD_OFF + TEXT_NORMAL);
    await this.write(receipt.storeInfo.address + NEWLINE);
    await this.write(`ИНН: ${receipt.storeInfo.inn}` + NEWLINE);
    await this.write(SEPARATOR);

    // Дата и номер чека
    await this.write(ALIGN_LEFT);
    await this.write(`Чек: ${receipt.transaction.id}${NEWLINE}`);
    await this.write(`Дата: ${formatDate(receipt.transaction.date)}${NEWLINE}`);
    await this.write(`Кассир: ${receipt.transaction.cashier}${NEWLINE}`);
    await this.write(SEPARATOR);

    // Товары
    await this.write(BOLD_ON + 'ТОВАРЫ' + BOLD_OFF + NEWLINE);
    for (const item of receipt.items) {
      await this.write(`${item.name}${NEWLINE}`);
      await this.write(`  ${item.quantity} x ${item.price} = ${item.total}₽${NEWLINE}`);
    }
    await this.write(SEPARATOR);

    // Итого
    await this.write(BOLD_ON + TEXT_2X);
    await this.write(`ИТОГО: ${receipt.payment.total}₽${NEWLINE}`);
    await this.write(TEXT_NORMAL + BOLD_OFF);

    if (receipt.payment.cash) {
      await this.write(`Получено: ${receipt.payment.cash}₽${NEWLINE}`);
      await this.write(`Сдача: ${receipt.payment.change}₽${NEWLINE}`);
    }

    if (receipt.payment.pointsRedeemed) {
      await this.write(`Списано баллов: ${receipt.payment.pointsRedeemed}${NEWLINE}`);
    }

    await this.write(SEPARATOR);

    // Программа лояльности
    await this.write(ALIGN_CENTER + BOLD_ON);
    await this.write(`ПРОГРАММА ЛОЯЛЬНОСТИ${NEWLINE}`);
    await this.write(BOLD_OFF + ALIGN_LEFT);
    await this.write(`Начислено баллов: +${receipt.loyalty.pointsAccrued}${NEWLINE}`);
    await this.write(`Баланс баллов: ${receipt.loyalty.newBalance}${NEWLINE}`);
    await this.write(SEPARATOR);

    // Футер
    await this.write(ALIGN_CENTER);
    await this.write('Спасибо за покупку!' + NEWLINE);
    await this.write('Приходите снова!' + NEWLINE + NEWLINE + NEWLINE);

    // Отрезать чек
    await this.write(CUT);
  }
}

function formatDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Использование
async function printPurchaseReceipt(receiptData: ReceiptData) {
  const printer = new ESCPOSPrinter();

  try {
    await printer.connect();
    await printer.printReceipt(receiptData);
    await printer.disconnect();

    return { success: true };
  } catch (error) {
    console.error('Print failed:', error);

    // Сохраняем для печати позже
    await saveReceiptForLaterPrint(receiptData);

    throw error;
  }
}
```

**Best Practices**:
- Проверяйте поддержку Web Serial API (`'serial' in navigator`)
- Сохраняйте неудавшиеся чеки для повторной печати
- Используйте encoding='cp866' для русского текста на старых принтерах
- Добавляйте QR-код с данными транзакции для клиента
- Тестируйте на реальном оборудовании (эмуляторы не покажут проблемы)

---

### 5. Синхронизировать продажи с бэкендом

Реализовать batch-синхронизацию офлайн-продаж с централизованным сервером.

**Технологии**: Background Sync API, Retry mechanism, Conflict resolution

**Пример workflow**:

```typescript
interface SyncTransaction {
  localId: number;
  customerId: string;
  amount: number;
  pointsAccrued: number;
  pointsRedeemed: number;
  storeId: string;
  cashierId: string;
  timestamp: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflicts: Array<{
    localId: number;
    reason: string;
  }>;
}

async function batchSyncTransactions(
  maxBatchSize: number = 50
): Promise<SyncResult> {
  // 1. Получаем несинхронизированные транзакции
  const pending = await offlineDB.pendingTransactions
    .where('synced')
    .equals(false)
    .limit(maxBatchSize)
    .toArray();

  if (pending.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0, conflicts: [] };
  }

  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    conflicts: []
  };

  try {
    // 2. Отправляем батч на сервер
    const response = await fetch('/api/pos/batch-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        transactions: pending,
        storeId: getCurrentStoreId(),
        cashierId: getCurrentCashierId()
      })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    const data = await response.json();

    // 3. Обрабатываем результат
    for (const item of data.results) {
      if (item.status === 'success') {
        // Помечаем как синхронизированную
        await offlineDB.pendingTransactions.update(item.localId, {
          synced: true,
          serverId: item.serverId
        });
        result.syncedCount++;

      } else if (item.status === 'conflict') {
        // Конфликт (например, клиент не найден)
        result.conflicts.push({
          localId: item.localId,
          reason: item.error
        });
        result.failedCount++;

      } else {
        // Другая ошибка
        result.failedCount++;
      }
    }

    // 4. Обновляем кэш клиентов
    if (data.updatedCustomers) {
      for (const customer of data.updatedCustomers) {
        await offlineDB.cachedCustomers.put({
          id: customer.id,
          ...customer,
          lastUpdated: Date.now()
        });
      }
    }

  } catch (error) {
    console.error('Batch sync failed:', error);
    result.success = false;
    result.failedCount = pending.length;
  }

  return result;
}

// Автоматическая синхронизация каждые 5 минут
let syncInterval: number;

function startAutoSync() {
  syncInterval = window.setInterval(async () => {
    if (navigator.onLine) {
      const result = await batchSyncTransactions();

      if (result.syncedCount > 0) {
        console.log(`Synced ${result.syncedCount} transactions`);

        // Показываем уведомление кассиру
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(
            `Синхронизировано: ${result.syncedCount} транзакций`
          );
        }
      }

      if (result.conflicts.length > 0) {
        console.warn('Conflicts detected:', result.conflicts);
        // Сохраняем конфликты для ручной обработки
        await saveConflictsForReview(result.conflicts);
      }
    }
  }, 5 * 60 * 1000); // 5 минут
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
}
```

**Best Practices**:
- Используйте batch sync вместо отправки каждой транзакции отдельно
- Проверяйте дубликаты по `clientTimestamp`
- Возвращайте обновлённые данные клиентов для кэша
- Обрабатывайте конфликты (несуществующий клиент, недостаточно баллов)
- Логируйте все sync операции для аудита

---

### 6. Обрабатывать ошибки синхронизации с retry

Реализовать exponential backoff для повторных попыток синхронизации при ошибках.

**Технологии**: Retry mechanism, Exponential backoff, Error categorization

**Пример workflow**:

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 5,
  initialDelay: 1000, // 1 секунда
  maxDelay: 60000, // 1 минута
  backoffMultiplier: 2
};

async function syncWithRetry(
  syncFn: () => Promise<any>,
  config: RetryConfig = defaultRetryConfig
): Promise<any> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await syncFn();

      // Успешная синхронизация
      if (attempt > 0) {
        console.log(`Sync succeeded after ${attempt} retries`);
      }

      return result;

    } catch (error) {
      lastError = error as Error;

      // Проверяем, стоит ли повторять
      if (!isRetryableError(error)) {
        throw error; // Критическая ошибка, не повторяем
      }

      if (attempt < config.maxRetries) {
        console.log(`Sync attempt ${attempt + 1} failed, retrying in ${delay}ms`);

        // Сохраняем информацию о retry в БД
        await offlineDB.syncQueue.add({
          type: 'transaction_sync',
          timestamp: Date.now(),
          retries: attempt + 1,
          nextRetryAt: Date.now() + delay,
          error: lastError.message
        });

        // Ждём перед следующей попыткой
        await sleep(delay);

        // Увеличиваем задержку (exponential backoff)
        delay = Math.min(
          delay * config.backoffMultiplier,
          config.maxDelay
        );

      } else {
        // Превышен лимит попыток
        console.error(`Sync failed after ${config.maxRetries} retries`);

        // Сохраняем для ручной обработки
        await saveFailedSync({
          error: lastError.message,
          retries: config.maxRetries,
          timestamp: Date.now()
        });

        throw new Error(`Sync failed after ${config.maxRetries} retries: ${lastError.message}`);
      }
    }
  }

  throw lastError!;
}

function isRetryableError(error: any): boolean {
  // Сетевые ошибки - можно повторить
  if (error.name === 'NetworkError') return true;
  if (error.message?.includes('fetch failed')) return true;
  if (error.message?.includes('timeout')) return true;

  // Ошибки сервера 5xx - можно повторить
  if (error.status >= 500 && error.status < 600) return true;

  // 429 Too Many Requests - можно повторить
  if (error.status === 429) return true;

  // Ошибки валидации, клиента не существует - НЕ повторяем
  if (error.status >= 400 && error.status < 500) return false;

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Best Practices**:
- Различайте retryable и non-retryable ошибки
- Используйте exponential backoff для предотвращения DDoS на сервер
- Сохраняйте информацию о failed syncs для ручной обработки
- Уведомляйте кассира о проблемах синхронизации
- Не блокируйте UI во время retry (используйте фоновую синхронизацию)

---

### 7. Кэшировать данные клиентов для offline доступа

Реализовать умное кэширование данных клиентов с TTL и invalidation.

**Технологии**: IndexedDB, Cache invalidation, TTL (Time To Live)

**Пример workflow** - см. документацию в references/offline_cache.md

**Best Practices**:
- Используйте TTL для автоматической инвалидации
- Возвращайте stale cache если сервер недоступен
- Предзагружайте частых клиентов при старте
- Инвалидируйте кэш после транзакций
- Периодически очищайте устаревший кэш

---

### 8. Показывать статус синхронизации в UI

Реализовать визуальные индикаторы состояния синхронизации для кассира.

**Технологии**: Svelte 5 runes, Reactive state, Telegram WebApp UI

**Пример компонента** - см. scripts/sync_status_component.svelte

**Best Practices**:
- Используйте цветовую индикацию (зелёный=онлайн, оранжевый=оффлайн)
- Показывайте счётчик несинхронизированных транзакций
- Добавьте кнопку ручной синхронизации
- Отображайте время последней синхронизации
- Используйте Telegram theme variables для цветов

---

### 9. Валидировать права доступа кассира

Реализовать проверку JWT токена и ролей кассира перед доступом к POS.

**Технологии**: JWT, Role-based access control, Telegram initData

**Пример workflow** - см. scripts/auth_cashier.ts

**Best Practices**:
- Всегда валидируйте Telegram initData перед выдачей JWT
- Используйте короткий TTL для JWT (24 часа max)
- Храните permissions в JWT payload для быстрой проверки
- Логируйте все входы кассиров для аудита
- Проверяйте `isActive` флаг перед выдачей токена

---

## Полный workflow кассира

```typescript
// 1. Инициализация POS приложения
async function initializePOS() {
  // Аутентификация кассира
  const initData = window.Telegram?.WebApp.initData;
  const auth = await authenticateCashier(initData);

  console.log('Authenticated:', auth);

  // Предзагрузка кэша клиентов
  await customerCache.preloadFrequentCustomers(100);

  // Запуск автосинхронизации
  startAutoSync();

  console.log('POS ready');
}

// 2. Обработка покупки
async function handlePurchase() {
  let customer = null;

  // Сканируем карту клиента
  try {
    customer = await scanCustomerCard();

    if (customer) {
      window.Telegram?.WebApp.showAlert(
        `Клиент: ${customer.name}\nБаланс: ${customer.balance} баллов`
      );
    }
  } catch (error) {
    console.error('Scan failed:', error);
  }

  // Формируем корзину
  const items = [
    { productId: 'prod-001', name: 'iPhone 16 Pro', quantity: 1, price: 89990 },
    { productId: 'prod-002', name: 'AirPods Pro 2', quantity: 1, price: 21990 }
  ];

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Проводим покупку
  const purchase = {
    customerId: customer?.id || 'guest',
    amount: total,
    paymentType: 'card',
    pointsToRedeem: 0,
    storeId: getCurrentStoreId(),
    cashierId: getCurrentCashierId()
  };

  let result;

  if (navigator.onLine) {
    result = await processPurchase(purchase);
  } else {
    await savePurchaseOffline(purchase);
    result = { offline: true };
  }

  // Печатаем чек
  await printPurchaseReceipt({...});

  window.Telegram?.WebApp.showAlert('Покупка завершена!');
}

// Запуск
initializePOS();
```

---

## Связанные ресурсы

- **Telegram WebApp API**: https://core.telegram.org/bots/webapps
- **Drizzle ORM Transactions**: https://orm.drizzle.team/docs/transactions
- **IndexedDB (Dexie.js)**: https://dexie.org/
- **ESC/POS Protocol**: https://reference.epson-biz.com/modules/ref_escpos/
- **Web Serial API**: https://developer.mozilla.org/en-US/docs/Web/API/Serial

---

## Ограничения

1. **Web Serial API**: Поддерживается только в Chrome/Edge 89+, не работает в Safari/Firefox
2. **Background Sync API**: Не работает в Telegram WebView (используйте setInterval)
3. **IndexedDB**: Лимит хранилища ~50MB в мобильных браузерах
4. **Offline mode**: Требует Service Worker для полной функциональности
5. **Bluetooth принтеры**: Web Bluetooth API не поддерживает SPP профиль (нужен native wrapper)

---

**Версия навыка**: 1.0.0
**Последнее обновление**: 2025-10-24
