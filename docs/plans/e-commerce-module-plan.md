# E-commerce Module Plan

## Статус: СОГЛАСОВАНО ✅

## Обзор

Модуль электронной коммерции для интеграции с существующей CMS. Универсальный функционал для разных типов бизнеса:
- Кафе и рестораны (меню, модификаторы)
- Одежда (размеры, цвета, материалы)
- Продукты питания (вес, свежесть)
- Зоотовары (породы, возраст)
- Хозтовары (размеры, объемы)

---

## Согласованные требования

| Вопрос | Решение |
|--------|---------|
| **Оплата** | Все сразу: YooKassa + Stripe + Telegram Stars |
| **Email** | Nodemailer + SMTP |
| **Telegram уведомления** | Бот отправляет в группу (fake credentials пока) |
| **Варианты товаров** | Универсальные для всех типов бизнеса |
| **1С интеграция** | Заготовка (placeholder) |
| **Multi-currency** | Да: RUB, USD, EUR, CNY, KZT, PLN + возможность добавлять |

---

## Scope: MVP Features

### 1. Каталог товаров
- Товары (Products) с вариантами
- Категории товаров (иерархия до 3 уровней)
- Гибкие атрибуты (размер, цвет, вес и т.д.)
- Изображения товаров (галерея)
- SEO поля
- Multi-currency цены
- Статус: draft / published / archived

### 2. Корзина и Checkout
- Корзина (localStorage + синхронизация с сервером)
- Оформление заказа (гостевой + авторизованный)
- Расчёт доставки (фиксированная / по весу / бесплатная от суммы)
- Промокоды (фиксированная скидка / %)
- Выбор валюты

### 3. Заказы
- Статусы: pending → paid → processing → shipped → delivered / cancelled
- История заказов в админке
- **Email уведомления** (Nodemailer + SMTP)
- **Telegram уведомления** (бот в группу)
- Экспорт заказов (CSV)

### 4. Оплата (все провайдеры)
- **YooKassa** (Россия)
- **Stripe** (международный)
- **Telegram Stars** (Mini Apps)
- Webhook обработка
- Возвраты (refunds)

### 5. Валюты
- RUB (₽) - основная
- USD ($)
- EUR (€)
- CNY (¥)
- KZT (₸)
- PLN (zł)
- Возможность добавлять новые

---

## Database Schema

```prisma
// ===========================================
// CURRENCIES
// ===========================================

model Currency {
  id          Int       @id @default(autoincrement())
  code        String    @unique  // RUB, USD, EUR, CNY, KZT, PLN
  symbol      String             // ₽, $, €, ¥, ₸, zł
  name        String             // Рубль, Доллар, Евро...
  rate        Decimal   @default(1) // Курс к базовой валюте
  isDefault   Boolean   @default(false)
  isActive    Boolean   @default(true)
  position    Int       @default(0)

  updatedAt   DateTime  @updatedAt

  @@map("currencies")
}

// ===========================================
// PRODUCT CATEGORIES
// ===========================================

model ProductCategory {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String
  description String?
  image       String?

  // Hierarchy
  parentId    Int?
  parent      ProductCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("CategoryHierarchy")
  level       Int       @default(0)

  // Business type hint (для UI)
  businessType String?  // cafe, clothing, food, pet, household, general

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // SEO
  metaTitle       String?
  metaDescription String?

  products    Product[]
  position    Int       @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([siteId, slug])
  @@index([siteId])
  @@index([parentId])
  @@map("product_categories")
}

// ===========================================
// PRODUCTS
// ===========================================

model Product {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String
  description String?   // Rich text / HTML
  shortDesc   String?   // Краткое описание

  // Pricing (в базовой валюте сайта)
  price       Decimal   @default(0)
  comparePrice Decimal? // Старая цена (для скидок)
  costPrice   Decimal?  // Себестоимость

  // Multi-currency prices (JSON)
  // {"USD": 10.99, "EUR": 9.99, "RUB": 999}
  prices      String    @default("{}")

  // Inventory
  sku         String?   // Артикул
  barcode     String?
  stock       Int       @default(0)
  trackStock  Boolean   @default(true)
  lowStockThreshold Int @default(5)

  // Status
  status      String    @default("draft") // draft, published, archived
  featured    Boolean   @default(false)

  // Physical
  weight      Decimal?  // kg
  dimensions  String?   // JSON: {length, width, height}

  // Product type for variant templates
  productType String    @default("general") // general, clothing, food, cafe, pet, household

  // Relations
  categoryId  Int?
  category    ProductCategory? @relation(fields: [categoryId], references: [id])

  images      ProductImage[]
  variants    ProductVariant[]
  attributes  ProductAttribute[]
  modifiers   ProductModifier[]  // Для кафе: добавки, топпинги
  orderItems  OrderItem[]
  cartItems   CartItem[]

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // SEO
  metaTitle       String?
  metaDescription String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([siteId, slug])
  @@index([siteId])
  @@index([categoryId])
  @@index([status])
  @@index([productType])
  @@map("products")
}

model ProductImage {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  url       String
  alt       String?
  position  Int      @default(0)
  isMain    Boolean  @default(false)

  @@index([productId])
  @@map("product_images")
}

// ===========================================
// PRODUCT VARIANTS (Universal)
// ===========================================

model ProductVariant {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // "Красный / XL", "500г", "Большая порция"
  sku       String?
  barcode   String?

  // Pricing
  price       Decimal?  // null = use product price
  comparePrice Decimal?
  prices      String    @default("{}") // Multi-currency

  // Inventory
  stock     Int      @default(0)

  // Image
  imageUrl  String?

  // Flexible options (JSON)
  // Clothing: {"color": "red", "size": "XL", "material": "cotton"}
  // Food: {"weight": "500g", "portion": "large"}
  // Cafe: {"size": "L", "milk": "oat"}
  // Pet: {"breed": "dog", "age": "adult", "weight": "10kg"}
  options   String   @default("{}")

  position  Int      @default(0)
  isActive  Boolean  @default(true)

  cartItems   CartItem[]
  orderItems  OrderItem[]

  @@index([productId])
  @@map("product_variants")
}

// ===========================================
// PRODUCT ATTRIBUTES (Filters)
// ===========================================

model ProductAttribute {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // "Цвет", "Размер", "Вес", "Калории"
  value     String   // "Красный", "XL", "500г", "250"
  group     String?  // Группировка атрибутов

  @@index([productId])
  @@index([name])
  @@map("product_attributes")
}

// ===========================================
// MODIFIERS (Для кафе/ресторанов)
// ===========================================

model ProductModifier {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // "Добавить сироп", "Выбрать молоко"
  type      String   @default("single") // single, multiple
  required  Boolean  @default(false)

  options   String   @default("[]") // JSON array of modifier options
  // [{"name": "Ванильный сироп", "price": 50}, {"name": "Карамельный", "price": 50}]

  position  Int      @default(0)

  @@index([productId])
  @@map("product_modifiers")
}

// ===========================================
// CART
// ===========================================

model Cart {
  id          Int       @id @default(autoincrement())
  sessionId   String    @unique // Для гостей
  userId      Int?      // Для авторизованных

  currencyCode String   @default("RUB") // Выбранная валюта

  items       CartItem[]

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([siteId])
  @@index([userId])
  @@index([expiresAt])
  @@map("carts")
}

model CartItem {
  id        Int      @id @default(autoincrement())
  cartId    Int
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)

  productId Int
  product   Product  @relation(fields: [productId], references: [id])

  variantId Int?
  variant   ProductVariant? @relation(fields: [variantId], references: [id])

  quantity  Int      @default(1)
  price     Decimal  // Зафиксированная цена

  // Modifiers (для кафе)
  modifiers String   @default("[]") // JSON: [{"name": "Сироп", "option": "Ваниль", "price": 50}]

  @@index([cartId])
  @@map("cart_items")
}

// ===========================================
// ORDERS
// ===========================================

model Order {
  id          Int       @id @default(autoincrement())
  orderNumber String    @unique // ORD-2024-00001

  // Customer
  userId      Int?
  email       String
  phone       String?
  customerName String?

  // Currency
  currencyCode String   @default("RUB")
  currencyRate Decimal  @default(1) // Курс на момент заказа

  // Shipping
  shippingAddress String  // JSON
  shippingMethod  String?
  shippingCost    Decimal @default(0)

  // Totals
  subtotal    Decimal
  discount    Decimal   @default(0)
  total       Decimal

  // Promo
  promoCode   String?
  promoDiscount Decimal @default(0)

  // Status
  status      String    @default("pending") // pending, confirmed, paid, processing, shipped, delivered, cancelled, refunded
  paymentStatus String  @default("pending") // pending, paid, failed, refunded
  paymentMethod String? // yookassa, stripe, telegram_stars, cash
  paymentId   String?   // External payment ID

  // Notes
  customerNote String?
  adminNote   String?

  items       OrderItem[]
  statusHistory OrderStatusHistory[]

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // Notifications sent
  emailSent     Boolean @default(false)
  telegramSent  Boolean @default(false)

  paidAt      DateTime?
  shippedAt   DateTime?
  deliveredAt DateTime?
  cancelledAt DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([siteId])
  @@index([status])
  @@index([orderNumber])
  @@index([email])
  @@map("orders")
}

model OrderItem {
  id        Int      @id @default(autoincrement())
  orderId   Int
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId Int
  product   Product  @relation(fields: [productId], references: [id])

  variantId Int?
  variant   ProductVariant? @relation(fields: [variantId], references: [id])

  name      String   // Snapshot
  sku       String?
  price     Decimal
  quantity  Int
  total     Decimal

  // Snapshot of selected options
  options   String   @default("{}") // JSON
  modifiers String   @default("[]") // JSON

  @@index([orderId])
  @@map("order_items")
}

model OrderStatusHistory {
  id        Int      @id @default(autoincrement())
  orderId   Int
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  status    String
  note      String?
  createdBy Int?     // userId

  createdAt DateTime @default(now())

  @@index([orderId])
  @@map("order_status_history")
}

// ===========================================
// PROMO CODES
// ===========================================

model PromoCode {
  id          Int       @id @default(autoincrement())
  code        String
  description String?

  // Discount
  type        String    // fixed, percent
  value       Decimal
  currencyCode String?  // Для fixed - в какой валюте

  // Limits
  minOrderAmount Decimal?
  maxUses     Int?
  usedCount   Int       @default(0)
  maxUsesPerUser Int?

  // Dates
  startsAt    DateTime?
  expiresAt   DateTime?

  isActive    Boolean   @default(true)

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([siteId, code])
  @@index([siteId])
  @@map("promo_codes")
}

// ===========================================
// SHIPPING METHODS
// ===========================================

model ShippingMethod {
  id          Int       @id @default(autoincrement())
  name        String
  description String?

  // Pricing
  type        String    @default("fixed") // fixed, weight, free_above
  price       Decimal   @default(0)
  currencyCode String   @default("RUB")
  freeAbove   Decimal?
  pricePerKg  Decimal?

  // Timing
  minDays     Int?
  maxDays     Int?

  isActive    Boolean   @default(true)
  position    Int       @default(0)

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@index([siteId])
  @@map("shipping_methods")
}

// ===========================================
// PAYMENT PROVIDERS (Configuration)
// ===========================================

model PaymentProvider {
  id          Int       @id @default(autoincrement())
  type        String    // yookassa, stripe, telegram_stars
  name        String    // "YooKassa", "Stripe", "Telegram Stars"

  // Credentials (encrypted or from env)
  config      String    @default("{}") // JSON: {shopId, secretKey, ...}

  isActive    Boolean   @default(false)
  isTest      Boolean   @default(true) // Test mode
  position    Int       @default(0)

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([siteId, type])
  @@index([siteId])
  @@map("payment_providers")
}

// ===========================================
// NOTIFICATION SETTINGS
// ===========================================

model NotificationSettings {
  id          Int       @id @default(autoincrement())

  // Email (SMTP)
  smtpHost    String?
  smtpPort    Int?
  smtpUser    String?
  smtpPass    String?   // Encrypted
  smtpFrom    String?

  // Telegram
  telegramBotToken String? // Encrypted
  telegramChatId   String? // Group chat ID

  // What to notify
  notifyNewOrder      Boolean @default(true)
  notifyPaymentReceived Boolean @default(true)
  notifyLowStock      Boolean @default(true)

  // Multisite
  siteId      Int       @unique
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  updatedAt   DateTime  @updatedAt

  @@map("notification_settings")
}

// ===========================================
// 1C INTEGRATION (Placeholder)
// ===========================================

model Integration1C {
  id          Int       @id @default(autoincrement())

  // Connection
  baseUrl     String?
  username    String?
  password    String?   // Encrypted

  // Sync settings
  syncProducts  Boolean @default(false)
  syncStock     Boolean @default(false)
  syncOrders    Boolean @default(false)
  syncInterval  Int     @default(60) // minutes

  lastSyncAt  DateTime?
  lastError   String?

  isActive    Boolean   @default(false)

  // Multisite
  siteId      Int       @unique
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  updatedAt   DateTime  @updatedAt

  @@map("integrations_1c")
}
```

---

## API Endpoints

### Products (Admin)
```
GET    /api/admin/products           - List with filters, pagination
POST   /api/admin/products           - Create
GET    /api/admin/products/:id       - Get
PUT    /api/admin/products/:id       - Update
DELETE /api/admin/products/:id       - Delete
POST   /api/admin/products/:id/images - Upload images
DELETE /api/admin/products/:id/images/:imageId - Delete image
POST   /api/admin/products/import    - Import CSV
GET    /api/admin/products/export    - Export CSV
```

### Categories (Admin)
```
GET    /api/admin/categories         - List
POST   /api/admin/categories         - Create
PUT    /api/admin/categories/:id     - Update
DELETE /api/admin/categories/:id     - Delete
```

### Orders (Admin)
```
GET    /api/admin/orders             - List
GET    /api/admin/orders/:id         - Get
PUT    /api/admin/orders/:id/status  - Update status
POST   /api/admin/orders/:id/refund  - Refund
GET    /api/admin/orders/export      - Export CSV
```

### Currencies (Admin)
```
GET    /api/admin/currencies         - List
POST   /api/admin/currencies         - Create
PUT    /api/admin/currencies/:id     - Update
POST   /api/admin/currencies/:id/rates - Update rates
```

### Payment Providers (Admin)
```
GET    /api/admin/payments/providers - List
PUT    /api/admin/payments/providers/:type - Configure
```

### Notifications (Admin)
```
GET    /api/admin/notifications/settings - Get
PUT    /api/admin/notifications/settings - Update
POST   /api/admin/notifications/test     - Send test
```

### Products (Public)
```
GET    /api/products                 - List published
GET    /api/products/:slug           - Get by slug
GET    /api/products/category/:slug  - By category
GET    /api/products/search          - Search
```

### Cart (Public)
```
GET    /api/cart                     - Get cart
POST   /api/cart/items               - Add item
PUT    /api/cart/items/:id           - Update
DELETE /api/cart/items/:id           - Remove
PUT    /api/cart/currency            - Change currency
POST   /api/cart/promo               - Apply promo
```

### Checkout (Public)
```
POST   /api/checkout                 - Create order
GET    /api/checkout/shipping        - Shipping methods
POST   /api/checkout/payment         - Init payment
POST   /api/webhooks/yookassa        - YooKassa webhook
POST   /api/webhooks/stripe          - Stripe webhook
POST   /api/webhooks/telegram        - Telegram webhook
```

---

## Frontend Pages

### Admin
- `/admin/products` - Список товаров
- `/admin/products/new` - Создание
- `/admin/products/[id]` - Редактирование
- `/admin/categories` - Категории
- `/admin/orders` - Заказы
- `/admin/orders/[id]` - Детали заказа
- `/admin/promo-codes` - Промокоды
- `/admin/shipping` - Доставка
- `/admin/currencies` - Валюты
- `/admin/payments` - Платёжные системы
- `/admin/notifications` - Уведомления

### Public
- `/products` - Каталог
- `/products/[category]` - Категория
- `/products/[category]/[slug]` - Товар
- `/cart` - Корзина
- `/checkout` - Оформление
- `/checkout/success` - Успех
- `/orders/[orderNumber]` - Статус заказа

---

## Этапы реализации

### Phase 1: Каталог (День 1-3)
1. ✅ Prisma schema для всех моделей
2. Currency, ProductCategory, Product API
3. Admin UI: Products, Categories
4. Public UI: Catalog, ProductCard

### Phase 2: Корзина + Checkout (День 4-6)
1. Cart API + Svelte store
2. Checkout form + validation
3. Shipping methods
4. Multi-currency cart

### Phase 3: Заказы + Уведомления (День 7-8)
1. Order creation + management
2. Nodemailer + SMTP
3. Telegram bot notifications
4. Order status history

### Phase 4: Оплата (День 9-11)
1. YooKassa integration
2. Stripe integration
3. Telegram Stars
4. Webhooks

### Phase 5: Дополнительно (День 12-13)
1. Промокоды
2. Import/Export CSV
3. 1C placeholder
4. Low stock alerts

---

## Итого: ~13 дней на MVP
