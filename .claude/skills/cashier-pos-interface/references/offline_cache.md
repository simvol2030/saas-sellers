# Offline Cache Implementation Guide

## Обзор

Умное кэширование данных клиентов с TTL (Time To Live) и автоматической инвалидацией для обеспечения работы POS в оффлайн режиме.

---

## Архитектура

```
┌─────────────────────────────────────────────┐
│           POS Application                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐      ┌──────────────┐     │
│  │  Customer    │      │   Server     │     │
│  │    Cache     │◄────►│    API       │     │
│  └──────────────┘      └──────────────┘     │
│         │                                    │
│         ▼                                    │
│  ┌──────────────┐                            │
│  │  IndexedDB   │                            │
│  │  (Dexie.js)  │                            │
│  └──────────────┘                            │
│                                              │
└─────────────────────────────────────────────┘

Flow:
1. Request customer → Check cache
2. Cache HIT (fresh) → Return cached data
3. Cache MISS/stale → Fetch from server
4. Update cache → Return fresh data
5. Offline → Return stale cache (if exists)
```

---

## Реализация

### 1. Database Schema (Dexie.js)

```typescript
import Dexie, { Table } from 'dexie';

interface CachedCustomer {
  id: string;              // Primary key
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  balance: number;
  cardNumber: string;
  phone: string;
  lastPurchaseDate: string | null;
  lastUpdated: number;     // Timestamp for TTL
}

class OfflineDatabase extends Dexie {
  cachedCustomers!: Table<CachedCustomer>;

  constructor() {
    super('LoyaltyPOS');

    this.version(1).stores({
      cachedCustomers: 'id, lastUpdated, tier' // Indexes
    });
  }
}

export const offlineDB = new OfflineDatabase();
```

---

### 2. CustomerCache Class

```typescript
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

export class CustomerCache {
  /**
   * Получить клиента (сначала из кэша, потом с сервера)
   */
  async getCustomer(customerId: string): Promise<CachedCustomer> {
    // 1. Проверяем кэш
    const cached = await offlineDB.cachedCustomers.get(customerId);

    if (cached && !this.isCacheExpired(cached.lastUpdated)) {
      console.log('Cache hit:', customerId);
      return cached;
    }

    // 2. Кэш устарел или отсутствует - запрашиваем с сервера
    if (navigator.onLine) {
      try {
        const fresh = await this.fetchFromServer(customerId);
        await this.updateCache(fresh);
        return fresh;
      } catch (error) {
        // Если сервер недоступен, возвращаем устаревший кэш
        if (cached) {
          console.warn('Using stale cache due to server error');
          return cached;
        }
        throw error;
      }
    }

    // 3. Offline и нет кэша
    if (!cached) {
      throw new Error('Customer not found in offline cache');
    }

    console.warn('Using stale cache (offline mode)');
    return cached;
  }

  /**
   * Предзагрузка часто используемых клиентов
   */
  async preloadFrequentCustomers(limit: number = 50): Promise<number> {
    if (!navigator.onLine) {
      console.log('Offline, skipping preload');
      return 0;
    }

    try {
      const response = await fetch('/api/pos/frequent-customers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Store-Id': getCurrentStoreId()
        }
      });

      if (!response.ok) throw new Error('Preload failed');

      const customers: CachedCustomer[] = await response.json();

      // Сохраняем в кэш
      for (const customer of customers) {
        await this.updateCache(customer);
      }

      console.log(`Preloaded ${customers.length} customers`);
      return customers.length;

    } catch (error) {
      console.error('Preload failed:', error);
      return 0;
    }
  }

  /**
   * Инвалидация кэша клиента после транзакции
   */
  async invalidateCustomer(customerId: string): Promise<void> {
    await offlineDB.cachedCustomers.delete(customerId);
    console.log('Cache invalidated:', customerId);
  }

  /**
   * Обновление баланса локально (после offline транзакции)
   */
  async updateBalanceLocally(
    customerId: string,
    balanceChange: number
  ): Promise<void> {
    const cached = await offlineDB.cachedCustomers.get(customerId);

    if (cached) {
      await offlineDB.cachedCustomers.update(customerId, {
        balance: cached.balance + balanceChange,
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Очистка устаревшего кэша
   */
  async cleanupStaleCache(): Promise<number> {
    const all = await offlineDB.cachedCustomers.toArray();
    const now = Date.now();
    let cleaned = 0;

    for (const item of all) {
      if (this.isCacheExpired(item.lastUpdated)) {
        await offlineDB.cachedCustomers.delete(item.id);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} stale cache entries`);
    return cleaned;
  }

  // ===== Private Methods =====

  private isCacheExpired(lastUpdated: number): boolean {
    return Date.now() - lastUpdated > CACHE_TTL;
  }

  private async fetchFromServer(customerId: string): Promise<CachedCustomer> {
    const response = await fetch(`/api/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch customer: ${response.status}`);
    }

    return await response.json();
  }

  private async updateCache(customer: CachedCustomer): Promise<void> {
    await offlineDB.cachedCustomers.put({
      ...customer,
      lastUpdated: Date.now()
    });
  }
}

// Singleton instance
export const customerCache = new CustomerCache();
```

---

## Стратегии кэширования

### 1. Cache-First (по умолчанию)

**Используется для**: Частых запросов, толерантных к небольшой задержке данных

```typescript
async getCustomer(id: string) {
  const cached = await cache.get(id);

  if (cached && !isExpired(cached)) {
    return cached; // Возвращаем сразу
  }

  const fresh = await fetchFromServer(id);
  await cache.put(fresh);
  return fresh;
}
```

**Плюсы**:
- Мгновенный ответ
- Работает offline
- Снижает нагрузку на сервер

**Минусы**:
- Может вернуть устаревшие данные

---

### 2. Network-First with Stale Fallback

**Используется для**: Критичных данных (например, баланс клиента)

```typescript
async getCustomerBalance(id: string) {
  if (navigator.onLine) {
    try {
      const fresh = await fetchFromServer(id);
      await cache.put(fresh);
      return fresh.balance;
    } catch (error) {
      // Сервер недоступен, используем кэш
      const cached = await cache.get(id);
      if (cached) {
        console.warn('Using stale cache');
        return cached.balance;
      }
      throw error;
    }
  } else {
    // Offline - только кэш
    const cached = await cache.get(id);
    if (!cached) {
      throw new Error('No cached data');
    }
    return cached.balance;
  }
}
```

**Плюсы**:
- Всегда пытается получить свежие данные
- Graceful degradation при offline

**Минусы**:
- Медленнее (ждёт ответ сервера)

---

### 3. Background Refresh

**Используется для**: Данных, которые можно обновлять асинхронно

```typescript
async getCustomer(id: string) {
  const cached = await cache.get(id);

  if (cached) {
    // Возвращаем кэш сразу
    const result = cached;

    // Обновляем в фоне (если кэш устарел)
    if (isExpired(cached) && navigator.onLine) {
      this.refreshInBackground(id);
    }

    return result;
  }

  // Кэш отсутствует - синхронный запрос
  const fresh = await fetchFromServer(id);
  await cache.put(fresh);
  return fresh;
}

private async refreshInBackground(id: string) {
  try {
    const fresh = await fetchFromServer(id);
    await cache.put(fresh);
    console.log('Background refresh complete:', id);
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}
```

**Плюсы**:
- Мгновенный ответ
- Данные постепенно обновляются

**Минусы**:
- Может вернуть устаревшие данные

---

## TTL (Time To Live) Стратегии

### Фиксированный TTL

```typescript
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

function isExpired(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL;
}
```

**Подходит для**: Стабильных данных (профиль клиента, tier)

---

### Динамический TTL по tier

```typescript
function getTTLForTier(tier: string): number {
  const ttls = {
    platinum: 1 * 60 * 60 * 1000,   // 1 час (VIP - свежие данные)
    gold: 6 * 60 * 60 * 1000,       // 6 часов
    silver: 12 * 60 * 60 * 1000,    // 12 часов
    bronze: 24 * 60 * 60 * 1000     // 24 часа
  };

  return ttls[tier] || 24 * 60 * 60 * 1000;
}

function isExpired(customer: CachedCustomer): boolean {
  const ttl = getTTLForTier(customer.tier);
  return Date.now() - customer.lastUpdated > ttl;
}
```

**Подходит для**: Когда важность данных зависит от tier клиента

---

### Адаптивный TTL

```typescript
function getAdaptiveTTL(customer: CachedCustomer): number {
  const now = new Date();
  const lastPurchase = customer.lastPurchaseDate
    ? new Date(customer.lastPurchaseDate)
    : null;

  // Клиенты с недавней покупкой - короткий TTL
  if (lastPurchase) {
    const daysSinceLastPurchase =
      (now.getTime() - lastPurchase.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSinceLastPurchase < 7) {
      return 1 * 60 * 60 * 1000; // 1 час (активный клиент)
    }

    if (daysSinceLastPurchase < 30) {
      return 12 * 60 * 60 * 1000; // 12 часов
    }
  }

  return 24 * 60 * 60 * 1000; // 24 часа (неактивный клиент)
}
```

**Подходит для**: Оптимизации под паттерны использования

---

## Cache Invalidation

### Ручная инвалидация после транзакции

```typescript
async function processPurchase(customerId: string, amount: number) {
  // Проводим транзакцию
  const result = await api.createTransaction({ customerId, amount });

  // Инвалидируем кэш клиента
  await customerCache.invalidateCustomer(customerId);

  return result;
}
```

---

### Автоматическая инвалидация при синхронизации

```typescript
async function syncTransactions() {
  const result = await api.batchSync(pendingTransactions);

  // Инвалидируем кэш всех затронутых клиентов
  const affectedCustomers = result.transactions.map(t => t.customerId);

  for (const customerId of new Set(affectedCustomers)) {
    await customerCache.invalidateCustomer(customerId);
  }

  // ИЛИ обновляем кэш свежими данными
  if (result.updatedCustomers) {
    for (const customer of result.updatedCustomers) {
      await customerCache.updateCache(customer);
    }
  }
}
```

---

## Предзагрузка (Preloading)

### При старте приложения

```typescript
async function initializePOS() {
  console.log('Initializing POS...');

  // Предзагрузка часто используемых клиентов
  if (navigator.onLine) {
    const count = await customerCache.preloadFrequentCustomers(100);
    console.log(`Preloaded ${count} customers`);
  }

  console.log('POS ready');
}
```

---

### По расписанию (ночная синхронизация)

```typescript
function scheduleNightlyPreload() {
  const now = new Date();
  const tonight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // Следующий день
    2, // 2:00 AM
    0,
    0
  );

  const msUntilTonight = tonight.getTime() - now.getTime();

  setTimeout(() => {
    customerCache.preloadFrequentCustomers(500);

    // Повторяем каждые 24 часа
    setInterval(
      () => customerCache.preloadFrequentCustomers(500),
      24 * 60 * 60 * 1000
    );
  }, msUntilTonight);
}
```

---

## Cleanup (Очистка)

### Периодическая очистка устаревшего кэша

```typescript
// Автоочистка каждые 6 часов
setInterval(() => {
  customerCache.cleanupStaleCache();
}, 6 * 60 * 60 * 1000);
```

---

### Очистка при нехватке памяти

```typescript
async function ensureStorageSpace() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage! / estimate.quota!) * 100;

    if (percentUsed > 80) {
      console.warn('Storage almost full, cleaning cache...');
      await customerCache.cleanupStaleCache();
    }
  }
}

// Проверяем перед каждой предзагрузкой
async function preloadWithCheck() {
  await ensureStorageSpace();
  await customerCache.preloadFrequentCustomers(100);
}
```

---

## Best Practices

### ✅ DO

1. **Используйте TTL** для автоматической инвалидации
2. **Возвращайте stale cache** если сервер недоступен
3. **Предзагружайте** часто используемых клиентов при старте
4. **Инвалидируйте** кэш после транзакций
5. **Периодически очищайте** устаревший кэш
6. **Мониторьте** использование хранилища (IndexedDB quota)
7. **Логируйте** cache hits/misses для метрик

### ❌ DON'T

1. **Не храните** чувствительные данные без шифрования
2. **Не кэшируйте** платёжные данные (PCI DSS compliance)
3. **Не полагайтесь** на кэш для критичных операций (списание баллов)
4. **Не забывайте** про IndexedDB quota (~50MB на мобильных)
5. **Не блокируйте** UI при очистке большого кэша
6. **Не храните** кэш бесконечно (используйте TTL)

---

## Метрики

### Отслеживание эффективности кэша

```typescript
class CacheMetrics {
  private hits = 0;
  private misses = 0;

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
  }
}

const metrics = new CacheMetrics();

// В методе getCustomer
if (cached && !isExpired(cached)) {
  metrics.recordHit();
  return cached;
} else {
  metrics.recordMiss();
  // ... fetch from server
}

// Логируем метрики
setInterval(() => {
  console.log('Cache hit rate:', (metrics.getHitRate() * 100).toFixed(2) + '%');
}, 60 * 60 * 1000); // Каждый час
```

---

## Troubleshooting

### Проблема: "QuotaExceededError"

**Решение**: Очистить старый кэш

```typescript
try {
  await offlineDB.cachedCustomers.put(customer);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Очищаем старый кэш
    await customerCache.cleanupStaleCache();

    // Повторяем попытку
    await offlineDB.cachedCustomers.put(customer);
  }
}
```

---

### Проблема: Медленная очистка кэша

**Решение**: Batch delete с лимитом

```typescript
async cleanupStaleCache(batchSize: number = 50): Promise<number> {
  let cleaned = 0;

  while (true) {
    const batch = await offlineDB.cachedCustomers
      .where('lastUpdated')
      .below(Date.now() - CACHE_TTL)
      .limit(batchSize)
      .toArray();

    if (batch.length === 0) break;

    await offlineDB.cachedCustomers.bulkDelete(batch.map(c => c.id));
    cleaned += batch.length;

    // Даём UI подышать
    await sleep(10);
  }

  return cleaned;
}
```

---

**Версия**: 1.0.0
**Последнее обновление**: 2025-10-24
