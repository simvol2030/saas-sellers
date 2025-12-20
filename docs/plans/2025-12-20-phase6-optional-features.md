# Phase 6: Optional E-commerce Features

**Дата создания:** 2025-12-20
**Дата аудита:** 2025-12-20
**Статус:** Проверено, готово к реализации
**Приоритет:** Medium-Low

## Обзор

Реализация дополнительных функций e-commerce после завершения Phase 1-5:
1. Admin UI для импорта/экспорта товаров
2. Email уведомления (SMTP)
3. Telegram Bot для уведомлений (частично реализовано)
4. Статистика продаж (Dashboard)
5. Отзывы на товары
6. Избранное (wishlist)

## Результаты аудита

### Что уже реализовано:
- ✅ API импорта/экспорта товаров (`product-import-export.ts`)
- ✅ API настроек уведомлений (`notifications.ts`)
- ✅ Telegram отправка уведомлений (sendOrderNotification, sendPaymentNotification, sendLowStockAlert)
- ✅ Admin UI для настроек уведомлений (`NotificationSettings.svelte`)

### Что нужно доработать:
- ⚠️ Email отправка только симулируется (console.log вместо nodemailer)
- ⚠️ Нет моделей Review и WishlistItem в Prisma
- ⚠️ Нет API для stats, reviews, wishlist
- ⚠️ Нет UI для импорта/экспорта товаров

### SQLite ограничения:
- Prisma enum не поддерживается в SQLite → использовать String для ReviewStatus

---

## Этап 1: Admin UI для импорта/экспорта товаров

### Цель
Добавить UI компонент для импорта/экспорта товаров через существующий API.

### Файлы для создания/изменения
| Файл | Действие | Описание |
|------|----------|----------|
| `frontend-astro/src/components/admin/ProductImportExport.svelte` | CREATE | Компонент с drag-drop для загрузки файлов |
| `frontend-astro/src/pages/admin/products/import.astro` | CREATE | Страница импорта |

### API (уже существует)
- `GET /api/admin/products/export` - Экспорт в JSON/CSV
- `GET /api/admin/products/export/template` - Шаблон для импорта
- `POST /api/admin/products/import` - Импорт из JSON

### Функциональность
- Скачивание экспорта в JSON/CSV
- Скачивание шаблона для импорта
- Drag-drop загрузка файла
- Предпросмотр данных перед импортом
- Выбор режима: create / upsert
- Прогресс-бар импорта
- Отчёт о результатах (created/updated/skipped/errors)

### Риски
- Большие файлы могут зависать браузер → использовать chunked upload
- Валидация на клиенте может отличаться от сервера

### Оценка: 1-2 часа

---

## Этап 2: Email уведомления (SMTP)

### Цель
Добавить реальную отправку email через nodemailer (сейчас только симуляция).

### Текущее состояние
- `notifications.ts` уже имеет структуру настроек SMTP
- Функция отправки email симулируется через console.log (строки 155-158)
- Нужно добавить реальный nodemailer транспорт

### Файлы для создания/изменения
| Файл | Действие | Описание |
|------|----------|----------|
| `backend-hono/src/lib/email/index.ts` | CREATE | Email service с nodemailer |
| `backend-hono/src/lib/email/templates.ts` | CREATE | HTML шаблоны писем |
| `backend-hono/src/routes/notifications.ts` | MODIFY | Заменить console.log на реальную отправку |

### Зависимости
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Переменные окружения
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=secret
SMTP_FROM="Магазин <notifications@example.com>"
```

### Шаблоны писем
1. **order_created** - Новый заказ (покупателю)
2. **order_status** - Изменение статуса заказа
3. **low_stock** - Уведомление о низком остатке (админу)
4. **daily_report** - Ежедневный отчёт

### Риски
- SMTP сервер может быть недоступен → очередь с retry
- Спам-фильтры → настроить SPF/DKIM
- Rate limiting SMTP провайдера

### Оценка: 2-3 часа

---

## Этап 3: Telegram Bot для уведомлений

### Цель
Улучшить существующую интеграцию Telegram (добавить inline кнопки).

### Текущее состояние ✅
- Telegram отправка **УЖЕ РЕАЛИЗОВАНА** в `notifications.ts`
- Работают функции:
  - `sendOrderNotification()` - уведомление о новом заказе
  - `sendPaymentNotification()` - уведомление об оплате
  - `sendLowStockAlert()` - уведомление о низком остатке
- Используется fetch к Telegram Bot API

### Что можно улучшить (опционально)
| Файл | Действие | Описание |
|------|----------|----------|
| `backend-hono/src/lib/telegram/bot.ts` | CREATE (опц.) | Wrapper для упрощения кода |
| `backend-hono/src/routes/notifications.ts` | MODIFY (опц.) | Добавить inline кнопки |

### Зависимости
Не требуются - уже используем fetch для Telegram Bot API.

### Переменные окружения
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_CHAT_ID=-1001234567890
```

### Типы уведомлений
1. **Новый заказ** - с кнопками "Подтвердить"/"Отклонить"
2. **Низкий остаток** - список товаров
3. **Ошибка платежа** - с деталями

### Функциональность
- Отправка сообщений с Markdown форматированием
- Inline кнопки для быстрых действий
- Webhook для обработки callback_query (опционально)

### Риски
- Rate limiting Telegram API (30 msg/sec)
- Бот может быть заблокирован пользователем

### Оценка: 0.5 часа (уже реализовано, только мелкие улучшения)

---

## Этап 4: Статистика продаж (Dashboard)

### Цель
Расширить Dashboard статистикой продаж и аналитикой.

### Файлы для создания/изменения
| Файл | Действие | Описание |
|------|----------|----------|
| `backend-hono/src/routes/stats.ts` | CREATE | API статистики |
| `frontend-astro/src/components/admin/SalesStats.svelte` | CREATE | Компонент графиков |
| `frontend-astro/src/components/admin/Dashboard.svelte` | MODIFY | Интегрировать статистику |

### Зависимости (frontend)
```bash
npm install chart.js
```

### API endpoints
```
GET /api/admin/stats/sales
  ?period=day|week|month|year
  &from=2025-01-01
  &to=2025-12-31

GET /api/admin/stats/products/top
  ?limit=10

GET /api/admin/stats/overview
```

### Метрики
1. **Обзор**
   - Общая выручка
   - Количество заказов
   - Средний чек
   - Конверсия (если есть аналитика)

2. **Графики**
   - Продажи по дням/неделям/месяцам
   - Топ товаров
   - Статусы заказов (pie chart)

3. **Таблицы**
   - Последние заказы
   - Товары с низким остатком

### Риски
- Тяжёлые SQL запросы на больших данных → кэширование
- График может быть медленным → lazy loading

### Оценка: 3-4 часа

---

## Этап 5: Отзывы на товары

### Цель
Добавить систему отзывов и рейтингов товаров.

### Файлы для создания/изменения
| Файл | Действие | Описание |
|------|----------|----------|
| `backend-hono/prisma/schema.prisma` | MODIFY | Добавить модель Review |
| `backend-hono/src/routes/reviews.ts` | CREATE | API отзывов |
| `frontend-astro/src/components/shop/ProductReviews.svelte` | CREATE | Отзывы на странице товара |
| `frontend-astro/src/components/admin/ReviewsList.svelte` | CREATE | Модерация отзывов |
| `frontend-astro/src/pages/admin/reviews/index.astro` | CREATE | Страница модерации |

### Prisma Schema
```prisma
// Добавить в Product model:
// reviews Review[]

model Review {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  authorName  String
  authorEmail String
  rating      Int      // 1-5
  title       String?
  content     String

  // SQLite не поддерживает enum - используем String
  status     String   @default("pending") // pending, approved, rejected
  isVerified Boolean  @default(false) // Покупатель подтверждён

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([productId])
  @@index([status])
  @@map("reviews")
}
```

### API endpoints
```
GET  /api/products/:id/reviews     - Публичные отзывы
POST /api/products/:id/reviews     - Создать отзыв
GET  /api/admin/reviews            - Все отзывы (модерация)
PUT  /api/admin/reviews/:id        - Обновить статус
DELETE /api/admin/reviews/:id      - Удалить
```

### Функциональность
- Звёздочный рейтинг (1-5)
- Заголовок + текст отзыва
- Модерация (pending → approved/rejected)
- Средний рейтинг на карточке товара
- Сортировка по дате/рейтингу
- Проверка: покупал ли пользователь товар

### Риски
- Спам отзывов → captcha или email verification
- Fake reviews → модерация

### Оценка: 3-4 часа

---

## Этап 6: Избранное (Wishlist)

### Цель
Сохранение товаров в избранное для зарегистрированных пользователей.

### Файлы для создания/изменения
| Файл | Действие | Описание |
|------|----------|----------|
| `backend-hono/prisma/schema.prisma` | MODIFY | Добавить модель Wishlist |
| `backend-hono/src/routes/wishlist.ts` | CREATE | API избранного |
| `frontend-astro/src/stores/wishlist.svelte.ts` | CREATE | Store для избранного |
| `frontend-astro/src/components/shop/WishlistButton.svelte` | CREATE | Кнопка "В избранное" |
| `frontend-astro/src/pages/wishlist.astro` | CREATE | Страница избранного |

### Prisma Schema
```prisma
// Добавить в User model:
// wishlistItems WishlistItem[]

// Добавить в Product model:
// wishlistItems WishlistItem[]

model WishlistItem {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, productId])
  @@index([userId])
  @@index([productId])
  @@map("wishlist_items")
}
```

### API endpoints
```
GET    /api/wishlist           - Список избранного
POST   /api/wishlist/:productId - Добавить в избранное
DELETE /api/wishlist/:productId - Удалить из избранного
```

### Функциональность
- Кнопка ❤️ на карточке товара
- Анимация при добавлении/удалении
- Количество в избранном в header
- Страница со списком избранного
- "Добавить всё в корзину"

### Edge Cases
- Неавторизованный пользователь → показать модалку "Войдите"
- Товар удалён/скрыт → автоматически удалить из избранного
- Товар закончился → показать "Нет в наличии"

### Оценка: 2-3 часа

---

## План выполнения (скорректированный)

| # | Этап | Приоритет | Время | Зависимости | Статус |
|---|------|-----------|-------|-------------|--------|
| 1 | Admin UI импорт/экспорт | Low | 1-2ч | - | Нужен UI |
| 2 | Email уведомления | Medium | 2-3ч | nodemailer | Симуляция→реальная |
| 3 | Telegram уведомления | Medium | 0.5ч | - | ✅ Готово |
| 4 | Статистика Dashboard | Medium | 3-4ч | chart.js | Новый |
| 5 | Отзывы на товары | Low | 3-4ч | Prisma migration | Новый |
| 6 | Избранное | Low | 2-3ч | Prisma migration, Auth | Новый |

**Общая оценка: 12-16 часов** (сокращено благодаря уже реализованному Telegram)

---

## Порядок коммитов

1. `feat(admin): add product import/export UI`
2. `feat(notifications): add SMTP email sending`
3. `feat(notifications): add Telegram bot notifications`
4. `feat(admin): add sales statistics dashboard`
5. `feat(reviews): add product reviews and ratings`
6. `feat(wishlist): add wishlist functionality`

---

## Критерии готовности

- [ ] Все API endpoints работают
- [ ] Admin UI компоненты отображаются
- [ ] TypeScript компилируется без ошибок
- [ ] Frontend собирается без ошибок
- [ ] Базовое тестирование в браузере

---

## Примечания

1. **Email/Telegram** можно реализовать параллельно
2. **Отзывы/Wishlist** требуют миграции БД - лучше делать последовательно
3. **Dashboard статистика** - самостоятельный модуль
4. Все этапы можно делать независимо друг от друга
