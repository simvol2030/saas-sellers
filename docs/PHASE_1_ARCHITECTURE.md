# Фаза 1: Архитектурные решения

**Дата создания:** 2025-12-19
**Статус:** Утверждён, ожидает реализации
**Приоритет:** HIGH — делаем ПЕРВЫМ

---

## Контекст для восстановления

### О проекте
Это **Landing Page Builder** (Content Platform) на стеке:
- **Backend:** Hono 4.x + Prisma ORM + SQLite
- **Frontend:** Astro 5.x + Svelte (для админки)
- **Функционал:** Конструктор лендингов из 24 готовых секций с визуальным редактором

### Текущее состояние
- Админка работает (`/admin`)
- 24 секции для лендингов готовы
- API endpoints готовы (auth, pages, media, settings, theme)
- JWT авторизация работает

### Что нужно сделать в Фазе 1
Архитектурные изменения схемы данных, которые влияют на всё остальное.

---

## 1. Мультисайтовость

### 1.1 Модель Site

```prisma
model Site {
  id          Int      @id @default(autoincrement())
  name        String                    // "Мой сайт"
  slug        String   @unique          // "my-site" (для URLs)
  domain      String?  @unique          // "example.com"
  subdomain   String?  @unique          // "site1" (site1.platform.com)

  // Owner
  ownerId     Int
  owner       User     @relation(fields: [ownerId], references: [id])

  // Settings (JSON)
  settings    String   @default("{}")   // Настройки сайта

  // Relations
  pages       Page[]
  media       Media[]
  siteSettings SiteSetting[]
  themeOverrides ThemeOverride[]
  menus       Menu[]
  reusableBlocks ReusableBlock[]

  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("sites")
}
```

### 1.2 Изменения в существующих моделях

Добавить `siteId` во ВСЕ контентные таблицы:

```prisma
model Page {
  // ... существующие поля ...
  siteId      Int
  site        Site     @relation(fields: [siteId], references: [id])

  @@index([siteId])
}

model Media {
  // ... существующие поля ...
  siteId      Int?
  site        Site?    @relation(fields: [siteId], references: [id])

  @@index([siteId])
}

model SiteSetting {
  // ... существующие поля ...
  siteId      Int
  site        Site     @relation(fields: [siteId], references: [id])

  @@unique([siteId, key])  // Уникальность ключа в рамках сайта
}

model ThemeOverride {
  // ... существующие поля ...
  siteId      Int
  site        Site     @relation(fields: [siteId], references: [id])

  @@unique([siteId, name])  // Уникальность имени в рамках сайта
}
```

### 1.3 API изменения

**Новые endpoints:**
```
GET    /api/admin/sites         - Список сайтов пользователя
POST   /api/admin/sites         - Создать сайт
GET    /api/admin/sites/:id     - Получить сайт
PUT    /api/admin/sites/:id     - Обновить сайт
DELETE /api/admin/sites/:id     - Удалить сайт
POST   /api/admin/sites/:id/switch - Переключить текущий сайт
```

**Middleware:**
- Определение текущего сайта по домену/поддомену
- Добавление `siteId` в context для всех запросов
- Фильтрация данных по `siteId` во всех routes

### 1.4 UI изменения

- Переключатель сайтов в шапке админки
- Страница управления сайтами `/admin/sites`

---

## 2. Иерархия страниц (до 3 уровней)

### 2.1 Изменение модели Page

```prisma
model Page {
  // ... существующие поля ...

  // Иерархия
  parentId    Int?
  parent      Page?    @relation("PageHierarchy", fields: [parentId], references: [id])
  children    Page[]   @relation("PageHierarchy")
  order       Int      @default(0)  // Порядок сортировки
  level       Int      @default(0)  // 0, 1, 2 (до 3 уровней)
  path        String?               // "/parent/child/grandchild" для быстрого поиска

  @@index([parentId])
  @@index([path])
}
```

### 2.2 Валидация уровней

В API добавить проверку:
```typescript
if (parentPage && parentPage.level >= 2) {
  return c.json({ error: 'Maximum nesting level is 3' }, 400);
}
```

### 2.3 API изменения

```
GET /api/admin/pages?parentId=null  - Корневые страницы
GET /api/admin/pages?parentId=5     - Дочерние страницы
GET /api/admin/pages/tree           - Дерево страниц (новый endpoint)
```

---

## 3. Теги для страниц

### 3.1 Новые модели

```prisma
model Tag {
  id        Int       @id @default(autoincrement())
  name      String
  slug      String
  color     String?   // Цвет для UI
  siteId    Int
  site      Site      @relation(fields: [siteId], references: [id])
  pages     PageTag[]

  @@unique([siteId, slug])
  @@map("tags")
}

model PageTag {
  pageId    Int
  tagId     Int
  page      Page      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  tag       Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([pageId, tagId])
  @@map("page_tags")
}
```

### 3.2 Изменение модели Page

```prisma
model Page {
  // ... существующие поля ...
  tags        PageTag[]
}
```

### 3.3 API

```
GET    /api/admin/tags           - Список тегов
POST   /api/admin/tags           - Создать тег
PUT    /api/admin/tags/:id       - Обновить тег
DELETE /api/admin/tags/:id       - Удалить тег

PUT    /api/admin/pages/:id/tags - Обновить теги страницы
GET    /api/admin/pages?tag=slug - Фильтр страниц по тегу
```

---

## 4. Группировка медиафайлов

### 4.1 Новая модель MediaFolder

```prisma
model MediaFolder {
  id        Int      @id @default(autoincrement())
  name      String
  slug      String
  parentId  Int?
  parent    MediaFolder? @relation("FolderHierarchy", fields: [parentId], references: [id])
  children  MediaFolder[] @relation("FolderHierarchy")
  siteId    Int
  site      Site     @relation(fields: [siteId], references: [id])
  media     Media[]

  @@unique([siteId, parentId, slug])
  @@map("media_folders")
}
```

### 4.2 Изменение модели Media

```prisma
model Media {
  // ... существующие поля ...
  folderId    Int?
  folder      MediaFolder? @relation(fields: [folderId], references: [id])

  @@index([folderId])
}
```

### 4.3 API

```
GET    /api/admin/media/folders           - Список папок
POST   /api/admin/media/folders           - Создать папку
PUT    /api/admin/media/folders/:id       - Переименовать папку
DELETE /api/admin/media/folders/:id       - Удалить папку
PUT    /api/admin/media/:id/move          - Переместить файл в папку
GET    /api/admin/media?folderId=5        - Файлы в папке
```

---

## 5. Повторяемые секции (Reusable Blocks)

### 5.1 Концепция

**Вариант A (утверждён):** Блок = набор секций

Блок может содержать несколько секций (например: Hero + Features + CTA).
При вставке блока в страницу — вставляются все его секции.
При редактировании блока — изменения применяются везде, где он используется.

### 5.2 Модели

```prisma
model ReusableBlock {
  id          Int      @id @default(autoincrement())
  name        String                    // "Hero + Features комбо"
  slug        String
  description String?
  sections    String   @default("[]")   // JSON массив секций
  category    String?                   // Категория блока
  thumbnail   String?                   // Превью изображение

  siteId      Int
  site        Site     @relation(fields: [siteId], references: [id])
  authorId    Int
  author      User     @relation(fields: [authorId], references: [id])

  // Использование
  usages      BlockUsage[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([siteId, slug])
  @@map("reusable_blocks")
}

model BlockUsage {
  id          Int      @id @default(autoincrement())
  blockId     Int
  block       ReusableBlock @relation(fields: [blockId], references: [id], onDelete: Cascade)
  pageId      Int
  page        Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  position    Int      // Позиция в странице (после какой секции)

  @@unique([pageId, position])
  @@map("block_usages")
}
```

### 5.3 Изменение модели Page

```prisma
model Page {
  // ... существующие поля ...
  blockUsages BlockUsage[]
}
```

### 5.4 API

```
GET    /api/admin/blocks           - Список блоков
POST   /api/admin/blocks           - Создать блок
GET    /api/admin/blocks/:id       - Получить блок
PUT    /api/admin/blocks/:id       - Обновить блок (применится везде!)
DELETE /api/admin/blocks/:id       - Удалить блок
GET    /api/admin/blocks/:id/usages - Где используется блок

POST   /api/admin/pages/:id/insert-block - Вставить блок в страницу
DELETE /api/admin/pages/:id/remove-block/:usageId - Удалить блок из страницы
```

### 5.5 Логика рендеринга

При рендеринге страницы:
1. Получаем секции страницы
2. Находим BlockUsage для этой страницы
3. В нужных позициях вставляем секции из ReusableBlock
4. Рендерим всё вместе

---

## 6. Управление меню

### 6.1 Модели

```prisma
model Menu {
  id        Int        @id @default(autoincrement())
  name      String                    // "Главное меню", "Footer меню"
  slug      String                    // "main", "footer"
  location  String     @default("header") // header, footer, sidebar
  items     String     @default("[]")   // JSON массив MenuItem

  siteId    Int
  site      Site       @relation(fields: [siteId], references: [id])

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([siteId, slug])
  @@map("menus")
}
```

### 6.2 Структура items (JSON)

```typescript
interface MenuItem {
  id: string;
  label: string;
  href: string;
  target?: '_blank' | '_self';
  icon?: string;
  children?: MenuItem[];  // Вложенное меню
  pageId?: number;        // Связь со страницей (для авто-обновления URL)
}
```

### 6.3 API

```
GET    /api/admin/menus           - Список меню
POST   /api/admin/menus           - Создать меню
GET    /api/admin/menus/:id       - Получить меню
PUT    /api/admin/menus/:id       - Обновить меню
DELETE /api/admin/menus/:id       - Удалить меню

GET    /api/menus/:slug           - Публичный endpoint для получения меню
```

---

## 7. Итоговая Prisma Schema (новые и изменённые модели)

После реализации Фазы 1 будут добавлены/изменены:

### Новые модели (6):
1. `Site` — мультисайтовость
2. `Tag` — теги
3. `PageTag` — связь страница↔тег
4. `MediaFolder` — папки для медиа
5. `ReusableBlock` — повторяемые блоки
6. `BlockUsage` — использование блоков
7. `Menu` — меню сайта

### Изменённые модели (4):
1. `Page` — добавлены: siteId, parentId, level, path, order, tags, blockUsages
2. `Media` — добавлены: siteId, folderId
3. `SiteSetting` — добавлен: siteId
4. `ThemeOverride` — добавлен: siteId

---

## 8. Порядок реализации

1. **Site + siteId везде** — основа мультисайтовости
2. **Page hierarchy** — parentId, level, path
3. **Tag + PageTag** — теги для страниц
4. **MediaFolder** — папки для медиа
5. **ReusableBlock + BlockUsage** — повторяемые секции
6. **Menu** — управление меню

---

## 9. Миграция данных

При первом запуске миграции:
1. Создать дефолтный Site для существующих данных
2. Присвоить siteId=1 всем существующим записям
3. Создать дефолтные Menu (header, footer)

---

## 10. Чек-лист реализации

- [ ] 1.1 Создать модель Site
- [ ] 1.2 Добавить siteId в Page, Media, SiteSetting, ThemeOverride
- [ ] 1.3 Создать API для Sites
- [ ] 1.4 Добавить middleware определения сайта
- [ ] 1.5 UI переключатель сайтов в админке
- [ ] 2.1 Добавить parentId, level, path в Page
- [ ] 2.2 API для дерева страниц
- [ ] 2.3 UI иерархии в PagesList
- [ ] 3.1 Создать модели Tag, PageTag
- [ ] 3.2 API для тегов
- [ ] 3.3 UI тегов в PageEditor
- [ ] 4.1 Создать модель MediaFolder
- [ ] 4.2 Добавить folderId в Media
- [ ] 4.3 API для папок
- [ ] 4.4 UI папок в MediaGallery
- [ ] 5.1 Создать модели ReusableBlock, BlockUsage
- [ ] 5.2 API для блоков
- [ ] 5.3 UI раздел /admin/blocks
- [ ] 5.4 Интеграция блоков в PageEditor
- [ ] 6.1 Создать модель Menu
- [ ] 6.2 API для меню
- [ ] 6.3 UI раздел /admin/menus
- [ ] 7.0 Миграция существующих данных

---

**После завершения Фазы 1 переходим к Фазе 2 (PHASE_2_ADMIN_IMPROVEMENTS.md)**
