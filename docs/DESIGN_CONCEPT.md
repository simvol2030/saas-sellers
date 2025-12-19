# Концепция: Content Site Starter Kit (Hono + Astro)

**Дата:** 2025-12-19
**Статус:** Ожидает согласования

---

## 1. Цель

Доработать текущий стек **Hono + Astro** до production-ready starter kit для:
- **Контентных сайтов** (лендинги, блоги, корпоративные сайты)
- **С возможностью расширения** до магазина в будущем

---

## 2. Текущее состояние (AS-IS)

### Backend (Hono) — 80% готов
```
✅ Security headers, CORS, Rate limiting
✅ Health check с мониторингом
✅ Prisma ORM (SQLite + WAL)
✅ Zod validation
✅ Graceful shutdown
⚠️  Только CRUD для User (нет контента)
⚠️  Auth middleware — заглушка
```

### Frontend (Astro) — 20% готов
```
✅ Базовые UI компоненты (Button, Card, Input, Alert, Spinner)
⚠️  Нет Layout компонента
⚠️  Нет API интеграции
⚠️  Нет страниц контента
⚠️  Index страница пустая
```

### База данных (Prisma) — 60% готов
```
✅ SQLite + WAL режим
✅ Готовность к PostgreSQL
⚠️  Только модель User
```

---

## 3. Целевое состояние (TO-BE)

### 3.1 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Astro 5.x)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Landing │  │  Blog   │  │ Pages   │  │  Admin  │        │
│  │  Pages  │  │  Posts  │  │ (CMS)   │  │ (опц.)  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       └────────────┴─────┬──────┴────────────┘              │
│                          │                                   │
│                    API Client                                │
└──────────────────────────┼───────────────────────────────────┘
                           │ REST API
┌──────────────────────────┼───────────────────────────────────┐
│                    BACKEND (Hono 4.x)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ /health │  │ /pages  │  │ /posts  │  │ /media  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                          │                                   │
│                    Prisma ORM                                │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    DATABASE                                  │
│           SQLite (dev) / PostgreSQL (prod)                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Схема данных (Prisma)

### Вариант A: Минимальный (рекомендую для начала)

```prisma
// === USERS ===
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts     Post[]
  pages     Page[]

  @@map("users")
}

enum Role {
  USER
  EDITOR
  ADMIN
}

// === PAGES (для лендингов) ===
model Page {
  id          Int        @id @default(autoincrement())
  slug        String     @unique
  title       String
  description String?
  content     String?    // HTML или Markdown
  sections    String?    // JSON для секций лендинга
  metaTitle   String?
  metaDesc    String?
  status      PageStatus @default(DRAFT)
  template    String     @default("default")
  authorId    Int?
  author      User?      @relation(fields: [authorId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  publishedAt DateTime?

  @@index([slug])
  @@index([status])
  @@map("pages")
}

enum PageStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

// === POSTS (для блога) ===
model Post {
  id          Int        @id @default(autoincrement())
  slug        String     @unique
  title       String
  excerpt     String?
  content     String     // Markdown или HTML
  coverImage  String?
  metaTitle   String?
  metaDesc    String?
  status      PageStatus @default(DRAFT)
  authorId    Int
  author      User       @relation(fields: [authorId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  publishedAt DateTime?

  categories  PostCategory[]
  tags        PostTag[]

  @@index([slug])
  @@index([status])
  @@index([authorId])
  @@map("posts")
}

// === CATEGORIES ===
model Category {
  id          Int            @id @default(autoincrement())
  slug        String         @unique
  name        String
  description String?
  parentId    Int?
  parent      Category?      @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[]     @relation("CategoryTree")
  posts       PostCategory[]

  @@map("categories")
}

model PostCategory {
  postId     Int
  categoryId Int
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([postId, categoryId])
  @@map("post_categories")
}

// === TAGS ===
model Tag {
  id    Int       @id @default(autoincrement())
  slug  String    @unique
  name  String
  posts PostTag[]

  @@map("tags")
}

model PostTag {
  postId Int
  tagId  Int
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}

// === MEDIA ===
model Media {
  id        Int      @id @default(autoincrement())
  filename  String
  path      String
  mimeType  String
  size      Int
  alt       String?
  createdAt DateTime @default(now())

  @@map("media")
}

// === SETTINGS ===
model Setting {
  id    Int    @id @default(autoincrement())
  key   String @unique
  value String // JSON

  @@map("settings")
}
```

### Вариант B: С мультисайтовостью (опционально, на будущее)

Добавляется таблица `Site` и `siteId` во все контентные таблицы.

---

## 5. API Endpoints

### 5.1 Публичные (без авторизации)

```
GET  /health                    - Health check

# Pages
GET  /api/pages                 - Список опубликованных страниц
GET  /api/pages/:slug           - Страница по slug

# Posts (Blog)
GET  /api/posts                 - Список постов (с пагинацией)
GET  /api/posts/:slug           - Пост по slug
GET  /api/posts/category/:slug  - Посты по категории
GET  /api/posts/tag/:slug       - Посты по тегу

# Categories & Tags
GET  /api/categories            - Список категорий
GET  /api/tags                  - Список тегов
```

### 5.2 Защищённые (требуют авторизации) — для админки

```
# Pages CRUD
POST   /api/admin/pages         - Создать страницу
PUT    /api/admin/pages/:id     - Обновить страницу
DELETE /api/admin/pages/:id     - Удалить страницу

# Posts CRUD
POST   /api/admin/posts         - Создать пост
PUT    /api/admin/posts/:id     - Обновить пост
DELETE /api/admin/posts/:id     - Удалить пост

# Media
POST   /api/admin/media         - Загрузить файл
DELETE /api/admin/media/:id     - Удалить файл

# Export/Import (из ваших набросков)
GET    /api/admin/pages/:id/export  - Экспорт страницы в MD
POST   /api/admin/pages/import      - Импорт из MD файла

# Settings
GET    /api/admin/settings          - Получить настройки
PUT    /api/admin/settings          - Обновить настройки
```

---

## 6. Frontend структура (Astro)

```
frontend-astro/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.astro      # ✅ есть
│   │   │   ├── Card.astro        # ✅ есть
│   │   │   ├── Input.astro       # ✅ есть
│   │   │   ├── Alert.astro       # ✅ есть
│   │   │   └── Spinner.astro     # ✅ есть
│   │   ├── layout/
│   │   │   ├── Header.astro      # 🆕 добавить
│   │   │   ├── Footer.astro      # 🆕 добавить
│   │   │   └── Navigation.astro  # 🆕 добавить
│   │   ├── sections/             # 🆕 секции для лендингов
│   │   │   ├── Hero.astro
│   │   │   ├── Features.astro
│   │   │   ├── CTA.astro
│   │   │   └── Testimonials.astro
│   │   └── blog/                 # 🆕 компоненты блога
│   │       ├── PostCard.astro
│   │       ├── PostList.astro
│   │       └── Pagination.astro
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro      # 🆕 базовый layout
│   │   ├── PageLayout.astro      # 🆕 для страниц
│   │   └── BlogLayout.astro      # 🆕 для блога
│   │
│   ├── pages/
│   │   ├── index.astro           # Главная (лендинг)
│   │   ├── [...slug].astro       # 🆕 динамические страницы
│   │   ├── blog/
│   │   │   ├── index.astro       # 🆕 список постов
│   │   │   └── [slug].astro      # 🆕 пост
│   │   └── components.astro      # ✅ демо компонентов
│   │
│   ├── lib/
│   │   ├── api.ts                # 🆕 API client
│   │   └── types.ts              # 🆕 TypeScript types
│   │
│   └── styles/
│       └── global.css            # 🆕 глобальные стили
│
├── public/
│   └── favicon.svg
│
└── .env.example                  # 🆕 с PUBLIC_API_URL
```

---

## 7. Этапы реализации

### Этап 1: База (Backend) — приоритет HIGH
1. Расширить Prisma schema (Page, Post, Category, Tag, Media, Setting)
2. Создать миграции
3. Реализовать публичные API endpoints
4. Добавить seed данные для демо

### Этап 2: База (Frontend) — приоритет HIGH
1. Создать Layout компоненты (Header, Footer, BaseLayout)
2. Создать API client
3. Реализовать главную страницу (лендинг)
4. Реализовать блог (список + пост)
5. Реализовать динамические страницы

### Этап 3: Админка (опционально) — приоритет MEDIUM
1. Защищённые endpoints
2. Простая авторизация (JWT или session)
3. UI для создания/редактирования контента

### Этап 4: Export/Import MD — приоритет LOW
1. Экспорт страницы в MD (frontmatter + content)
2. Импорт MD файлов
3. Переключатель CONTENT_SOURCE (db/md/hybrid)

---

## 8. Вопросы для согласования

### 8.1 Схема данных
- [ ] **Вариант A (минимальный)** или **Вариант B (с мультисайтовостью)**?
- [ ] Нужны ли **категории с вложенностью** (parentId) или достаточно плоских?

### 8.2 Авторизация
- [ ] Нужна ли **админка** в этом starter kit?
- [ ] Если да — какой тип авторизации: **JWT** или **session-based**?

### 8.3 Контент
- [ ] Формат контента страниц: **Markdown**, **HTML**, или **JSON-секции**?
- [ ] Нужен ли **визуальный редактор** (WYSIWYG)?

### 8.4 Приоритеты
- [ ] Начать с **Этапа 1+2** (без админки)?
- [ ] Или сразу включить **Этап 3** (с авторизацией)?

### 8.5 Export/Import
- [ ] Реализовать **сразу** или **отложить** на потом?
- [ ] Какой режим по умолчанию: `db`, `md`, или `hybrid`?

---

## 9. Что НЕ входит (out of scope)

Чтобы соблюсти принцип разумной достаточности:

- ❌ Мультисайтовость (можно добавить позже)
- ❌ Полноценная CMS админка с rich editor
- ❌ Комментарии к постам
- ❌ Поиск (можно добавить Algolia/Meilisearch позже)
- ❌ Интернационализация (i18n)
- ❌ A/B тестирование
- ❌ Аналитика

---

## 10. Резюме

**Минимальный scope для контентного сайта:**

| Компонент | Описание |
|-----------|----------|
| Backend | CRUD для Pages, Posts, Categories, Tags, Media |
| Frontend | Layout, Landing page, Blog, Dynamic pages |
| Database | Prisma schema с 8 таблицами |
| DevSecOps | Уже есть (headers, rate limiting, CORS) |

**Ожидаемый результат:**
- Готовый starter kit для контентных сайтов
- Копируешь → настраиваешь → деплоишь
- Расширяемый для магазина в будущем

---

**Жду ваших ответов на вопросы в разделе 8 для продолжения.**
