# Фаза 7: Админка — Исследование и Планирование

**Дата:** 2025-12-17
**Статус:** Исследование завершено, ожидание согласования

---

## 1. Анализ текущего состояния

### 1.1 Что уже реализовано

**Frontend (Astro):**
- ✅ 23 секции для лендингов (Phases 1-6)
- ✅ Дизайн-система (`theme.config.ts`) с CSS переменными
- ✅ Светлая/тёмная тема с toggle
- ✅ Layout система (Header, Footer, Landing.astro)
- ✅ Content Collections для landings, blog, pages, authors
- ✅ Parser для MD → секции (`parser.ts`)
- ✅ Готовый пример лендинга (`home.md`)

**Backend (Hono):**
- ✅ Media API (upload, serve, delete, list)
- ✅ CRUD для users, posts, categories, tags
- ✅ Prisma ORM + SQLite
- ✅ Rate limiting, CORS, secure headers
- ✅ Health check endpoint
- ⚠️ Auth middleware (stub, не реализован)

**База данных (Prisma):**
- ✅ User модель (базовая)
- ❌ Page/Landing модели отсутствуют
- ❌ Settings модель отсутствует
- ❌ Media metadata отсутствует

### 1.2 Структура файлов

```
frontend-astro/
├── src/
│   ├── components/sections/     # 23 секции ✅
│   ├── layouts/Landing.astro    # Layout для лендингов ✅
│   ├── lib/
│   │   ├── theme.config.ts      # Дизайн-система ✅
│   │   ├── parser.ts            # MD парсер ✅
│   │   └── sections.ts          # Реестр секций ✅
│   ├── content/landings/        # MD файлы лендингов
│   └── pages/admin/             # ❌ НЕ СУЩЕСТВУЕТ

backend-hono/
├── src/
│   ├── routes/
│   │   ├── media.ts             # Media API ✅
│   │   └── ...                  # users, posts, etc. ✅
│   ├── middleware/
│   │   └── auth.ts              # ⚠️ STUB
│   └── lib/db.ts                # Prisma client ✅
└── prisma/schema.prisma         # Базовая схема ⚠️
```

---

## 2. Запланированный функционал (из LANDING_BUILDER_PLAN.md)

### 2.1 Dashboard
- Обзор контента
- Статистика страниц

### 2.2 Layout Editor
- Настройка Header (меню, логотип)
- Настройка Footer

### 2.3 Page Builder
- Выбор секций из библиотеки
- Drag-n-drop порядок
- Генерация MD шаблона

### 2.4 Media Manager
- Загрузка файлов
- Галерея загруженных
- Копирование путей

### 2.5 Design System Editor
- Цвета
- Шрифты
- Spacing

### 2.6 Pages List
- Список всех страниц
- Статус (draft/published)
- SSG/SSR настройка

**Требование:** Mobile-friendly (адаптивный интерфейс)

---

## 3. Ключевые архитектурные решения

### 3.1 Где размещать админку?

**Вариант A: Astro SSR страницы (РЕКОМЕНДУЕТСЯ)**
```
/pages/admin/
├── index.astro       # Dashboard
├── pages/
├── media/
└── settings/
```
**Плюсы:**
- Единый проект, общие компоненты
- Переиспользование дизайн-системы
- Нет CORS проблем (один origin)
- Island архитектура для интерактивности

**Минусы:**
- Нужен SSR adapter

**Вариант B: Отдельный SPA (React/Svelte)**
- Сложнее поддерживать
- Дублирование стилей
- CORS настройка

**Решение:** Вариант A — Astro SSR страницы

### 3.2 Аутентификация

**Вариант A: JWT tokens (РЕКОМЕНДУЕТСЯ)**
- Stateless
- Легко масштабировать
- Работает с SSR и клиентом

**Вариант B: Session cookies**
- Проще для SSR
- Сложнее с API

**Решение:** JWT + HTTP-only refresh token cookie

### 3.3 Хранение данных страниц

**Вариант A: MD файлы (текущий подход)**
- Контент в `/content/landings/*.md`
- Админка редактирует файлы
- Git-friendly

**Вариант B: Database (Prisma)**
- Контент в SQLite
- Админка через API
- Нужна миграция

**Вариант C: Гибридный (РЕКОМЕНДУЕТСЯ)**
- Структура/мета в БД
- Контент секций в JSON поле
- При публикации генерирует MD (опционально)

**Решение:** Гибридный подход — БД для управления, опциональный экспорт в MD

### 3.4 Редактирование контента

**Вариант A: JSON Editor**
- Простой, быстрый
- Требует знания структуры

**Вариант B: Visual Form Builder**
- Для каждого типа секции — своя форма
- Удобнее для пользователей
- Больше кода

**Решение:** Visual Form Builder с fallback на JSON

### 3.5 Технологии для интерактивности

**В Astro Islands:**
- **Svelte** — легковесный, отличная DX
- React/Vue — overhead

**Решение:** Svelte для интерактивных компонентов админки

---

## 4. Структура базы данных (расширение Prisma)

```prisma
// Расширенная схема для админки

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   // bcrypt hash
  name      String?
  role      String   @default("editor") // admin, editor, viewer
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  pages     Page[]   // созданные страницы

  @@map("users")
}

model Page {
  id          Int      @id @default(autoincrement())
  slug        String   @unique
  title       String
  description String?

  // Секции как JSON
  sections    String   // JSON array of sections

  // Layout config
  headerConfig String? // JSON
  footerConfig String? // JSON

  // SEO
  metaTitle       String?
  metaDescription String?
  ogImage         String?
  canonicalUrl    String?
  noindex         Boolean @default(false)

  // Publishing
  status      String   @default("draft") // draft, published
  publishedAt DateTime?

  // Options
  hideHeader  Boolean  @default(false)
  hideFooter  Boolean  @default(false)
  prerender   Boolean  @default(true)

  // Relations
  authorId    Int
  author      User     @relation(fields: [authorId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("pages")
}

model Media {
  id        Int      @id @default(autoincrement())
  filename  String
  path      String
  type      String   // image, video, document
  mimeType  String
  size      Int
  alt       String?
  caption   String?

  uploadedById Int?
  uploadedBy   User? @relation(fields: [uploadedById], references: [id])

  createdAt DateTime @default(now())

  @@map("media")
}

model SiteSettings {
  id          Int    @id @default(autoincrement())
  key         String @unique
  value       String // JSON value

  @@map("site_settings")
}
```

---

## 5. API Endpoints (backend-hono)

```
POST   /api/auth/login          # JWT login
POST   /api/auth/refresh        # Refresh token
POST   /api/auth/logout         # Invalidate refresh token

GET    /api/admin/pages         # List pages (with pagination)
POST   /api/admin/pages         # Create page
GET    /api/admin/pages/:id     # Get page
PUT    /api/admin/pages/:id     # Update page
DELETE /api/admin/pages/:id     # Delete page
POST   /api/admin/pages/:id/publish   # Publish page
POST   /api/admin/pages/:id/unpublish # Unpublish page

GET    /api/admin/media         # List media (with filters)
POST   /api/admin/media         # Upload (existing endpoint)
PUT    /api/admin/media/:id     # Update metadata
DELETE /api/admin/media/:id     # Delete

GET    /api/admin/settings      # Get all settings
PUT    /api/admin/settings/:key # Update setting

GET    /api/admin/theme         # Get theme config
PUT    /api/admin/theme         # Update theme config
```

---

## 6. Предлагаемые под-фазы

### Фаза 7.1: Инфраструктура (база)
- [ ] Расширить Prisma schema (Page, Media, SiteSettings)
- [ ] Реализовать JWT auth middleware
- [ ] Создать Admin layout (Astro SSR)
- [ ] Настроить Astro adapter-node для SSR
- [ ] Базовая защита admin routes

### Фаза 7.2: Pages CRUD
- [ ] API endpoints для pages
- [ ] Pages List (таблица с фильтрами)
- [ ] Page Editor (базовый)
- [ ] Publish/Unpublish workflow

### Фаза 7.3: Section Editor
- [ ] Visual формы для каждого типа секции
- [ ] Drag-n-drop сортировка секций
- [ ] Preview mode
- [ ] Добавление/удаление секций

### Фаза 7.4: Media Manager
- [ ] Галерея с grid view
- [ ] Upload с progress
- [ ] Редактирование alt/caption
- [ ] Интеграция с Section Editor

### Фаза 7.5: Design System Editor
- [ ] Color picker для theme
- [ ] Font selector
- [ ] Spacing controls
- [ ] Live preview

### Фаза 7.6: Dashboard & Settings
- [ ] Dashboard с статистикой
- [ ] Header/Footer editor
- [ ] Site settings (logo, title, etc.)

---

## 7. Вопросы для согласования

1. **Аутентификация:** JWT подход устраивает? Или предпочтительнее session?

2. **Хранение страниц:** Гибридный подход (БД + опциональный MD экспорт) или только MD файлы?

3. **Интерактивность:** Svelte для Islands? Или другой фреймворк?

4. **Порядок под-фаз:** Начать с 7.1 (инфраструктура) или сразу с конкретной функции (Media Manager)?

5. **Scope первой итерации:** Полный функционал или MVP (только Pages + Media)?

6. **UI библиотека:** Писать компоненты с нуля (используя дизайн-систему) или взять готовую UI библиотеку?

---

## 8. Рекомендуемый план действий

**MVP Подход (быстрый старт):**

1. **Фаза 7.1** — Инфраструктура + Auth
2. **Фаза 7.4** — Media Manager (уже есть API)
3. **Фаза 7.2** — Pages CRUD
4. **Фаза 7.3** — Section Editor
5. **Фаза 7.5** — Design System Editor
6. **Фаза 7.6** — Dashboard & Settings

**Оценка объёма:** ~15-20 компонентов, ~10 API endpoints

---

## 9. Технический стек для админки

| Компонент | Технология |
|-----------|------------|
| Backend | Hono (существующий) |
| Auth | JWT + bcrypt |
| Database | Prisma + SQLite |
| Frontend | Astro SSR |
| Islands | Svelte 5 |
| Forms | Native + validation |
| Drag-n-drop | @dnd-kit/core |
| Rich text | TipTap (опционально) |
| File upload | Native FormData |
| Styling | Существующая дизайн-система |

---

## Следующий шаг

После согласования вопросов из раздела 7 будет создан детальный план реализации с конкретными файлами и задачами для каждой под-фазы.
