# E-commerce Module Plan

## Обзор

Модуль электронной коммерции для интеграции с существующей CMS. Минимально необходимый функционал для запуска интернет-магазина.

---

## Scope: MVP Features

### 1. Каталог товаров
- Товары (Products) с вариантами (размер, цвет)
- Категории товаров (иерархия до 3 уровней)
- Атрибуты (фильтры): цвет, размер, материал и т.д.
- Изображения товаров (галерея)
- SEO поля для товаров
- Статус: draft / published / archived

### 2. Корзина и Checkout
- Корзина (localStorage + синхронизация с сервером)
- Оформление заказа (гостевой + авторизованный)
- Расчёт доставки (фиксированная / по весу / бесплатная от суммы)
- Промокоды (фиксированная скидка / %)
- Формы: контакты, адрес доставки, комментарий

### 3. Заказы
- Статусы заказа: pending → paid → processing → shipped → delivered / cancelled
- История заказов в админке
- Email уведомления (создание, оплата, отправка)
- Экспорт заказов (CSV)

### 4. Оплата
- Интеграция с платёжными системами:
  - YooKassa (Россия)
  - Stripe (международный)
  - Telegram Stars (Mini Apps)
- Webhook обработка статусов оплаты
- Возвраты (refunds)

### 5. Склад и остатки
- Количество товара на складе
- Резервирование при добавлении в корзину
- Уведомления о низком остатке
- Импорт/экспорт остатков (CSV)

---

## Database Schema

```prisma
// ===========================================
// PRODUCTS
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

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // SEO
  metaTitle       String?
  metaDescription String?

  products    Product[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([siteId, slug])
  @@index([siteId])
  @@index([parentId])
  @@map("product_categories")
}

model Product {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String
  description String?   // Rich text / HTML
  shortDesc   String?   // Краткое описание

  // Pricing
  price       Decimal   @default(0)
  comparePrice Decimal? // Старая цена (для скидок)
  costPrice   Decimal?  // Себестоимость

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

  // Relations
  categoryId  Int?
  category    ProductCategory? @relation(fields: [categoryId], references: [id])

  images      ProductImage[]
  variants    ProductVariant[]
  attributes  ProductAttribute[]
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

model ProductVariant {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // "Красный / XL"
  sku       String?
  price     Decimal?  // null = use product price
  stock     Int      @default(0)

  options   String   @default("{}") // JSON: {"color": "red", "size": "XL"}

  cartItems   CartItem[]
  orderItems  OrderItem[]

  @@index([productId])
  @@map("product_variants")
}

model ProductAttribute {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // "Цвет", "Размер", "Материал"
  value     String   // "Красный", "XL", "Хлопок"

  @@index([productId])
  @@map("product_attributes")
}

// ===========================================
// CART
// ===========================================

model Cart {
  id          Int       @id @default(autoincrement())
  sessionId   String    @unique // Для гостей
  userId      Int?      // Для авторизованных

  items       CartItem[]

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  expiresAt   DateTime  // Автоочистка старых корзин
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
  price     Decimal  // Зафиксированная цена на момент добавления

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
  status      String    @default("pending") // pending, paid, processing, shipped, delivered, cancelled, refunded
  paymentStatus String  @default("pending") // pending, paid, failed, refunded
  paymentMethod String? // yookassa, stripe, telegram_stars
  paymentId   String?   // External payment ID

  // Notes
  customerNote String?
  adminNote   String?

  items       OrderItem[]
  statusHistory OrderStatusHistory[]

  // Multisite
  siteId      Int
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)

  paidAt      DateTime?
  shippedAt   DateTime?
  deliveredAt DateTime?
  cancelledAt DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([siteId])
  @@index([status])
  @@index([orderNumber])
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

  // Limits
  minOrderAmount Decimal? // Минимальная сумма заказа
  maxUses     Int?       // Макс. использований
  usedCount   Int       @default(0)
  maxUsesPerUser Int?   // Макс. на пользователя

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
// SHIPPING
// ===========================================

model ShippingMethod {
  id          Int       @id @default(autoincrement())
  name        String    // "Курьер", "Почта России", "Самовывоз"
  description String?

  // Pricing
  type        String    @default("fixed") // fixed, weight, free_above
  price       Decimal   @default(0)
  freeAbove   Decimal?  // Бесплатно от суммы
  pricePerKg  Decimal?  // Для type=weight

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
```

---

## API Endpoints

### Products (Admin)
```
GET    /api/admin/products           - List products (with filters, pagination)
POST   /api/admin/products           - Create product
GET    /api/admin/products/:id       - Get product
PUT    /api/admin/products/:id       - Update product
DELETE /api/admin/products/:id       - Delete product
POST   /api/admin/products/:id/images - Upload images
DELETE /api/admin/products/:id/images/:imageId - Delete image
POST   /api/admin/products/import    - Import from CSV
GET    /api/admin/products/export    - Export to CSV
```

### Products (Public)
```
GET    /api/products                 - List published products
GET    /api/products/:slug           - Get product by slug
GET    /api/products/category/:slug  - Get by category
GET    /api/products/search          - Search products
```

### Categories (Admin)
```
GET    /api/admin/categories         - List categories
POST   /api/admin/categories         - Create
PUT    /api/admin/categories/:id     - Update
DELETE /api/admin/categories/:id     - Delete
```

### Cart (Public)
```
GET    /api/cart                     - Get cart
POST   /api/cart/items               - Add item
PUT    /api/cart/items/:id           - Update quantity
DELETE /api/cart/items/:id           - Remove item
POST   /api/cart/promo               - Apply promo code
DELETE /api/cart/promo               - Remove promo code
```

### Orders (Admin)
```
GET    /api/admin/orders             - List orders
GET    /api/admin/orders/:id         - Get order
PUT    /api/admin/orders/:id/status  - Update status
POST   /api/admin/orders/:id/refund  - Process refund
GET    /api/admin/orders/export      - Export CSV
```

### Checkout (Public)
```
POST   /api/checkout                 - Create order
GET    /api/checkout/shipping        - Get shipping methods
POST   /api/checkout/payment         - Initialize payment
POST   /api/checkout/payment/webhook - Payment webhook
```

### Promo Codes (Admin)
```
GET    /api/admin/promo-codes        - List
POST   /api/admin/promo-codes        - Create
PUT    /api/admin/promo-codes/:id    - Update
DELETE /api/admin/promo-codes/:id    - Delete
```

---

## Frontend Pages

### Admin
- `/admin/products` - Список товаров
- `/admin/products/new` - Создание товара
- `/admin/products/[id]` - Редактирование товара
- `/admin/categories` - Категории
- `/admin/orders` - Заказы
- `/admin/orders/[id]` - Детали заказа
- `/admin/promo-codes` - Промокоды
- `/admin/shipping` - Способы доставки

### Public
- `/products` - Каталог
- `/products/[category]` - Категория
- `/products/[category]/[slug]` - Товар
- `/cart` - Корзина
- `/checkout` - Оформление заказа
- `/checkout/success` - Успешный заказ
- `/orders/[id]` - Статус заказа (по ссылке из email)

---

## Этапы реализации

### Phase 1: Каталог (2-3 дня)
1. Prisma schema для Products, Categories
2. API routes для CRUD
3. Admin UI: ProductsList, ProductEditor, CategoryManager
4. Public UI: ProductCard, ProductGallery, CategoryFilter

### Phase 2: Корзина и Checkout (2-3 дня)
1. Cart schema и API
2. Cart UI (Svelte store + localStorage)
3. Checkout form и validation
4. Shipping methods

### Phase 3: Заказы (1-2 дня)
1. Order schema и API
2. Admin: OrdersList, OrderDetails
3. Email notifications (nodemailer)
4. Status history

### Phase 4: Оплата (2-3 дня)
1. YooKassa интеграция
2. Webhook обработка
3. Stripe (опционально)
4. Telegram Stars (опционально)

### Phase 5: Дополнительно (1-2 дня)
1. Промокоды
2. Import/Export CSV
3. Уведомления о низком остатке
4. SEO оптимизация

---

## Итого: ~10-12 дней на MVP

## Решения для согласования

1. **Оплата**: Начинаем с YooKassa? Или нужен Stripe/Telegram Stars сразу?
2. **Email**: Nodemailer + SMTP? Или сервис (Sendgrid, Mailgun)?
3. **Варианты товаров**: Нужна матрица вариантов (цвет × размер) или простые варианты?
4. **Склад**: Нужна интеграция с внешним складом (1С)?
5. **Multi-currency**: Нужна поддержка нескольких валют?
