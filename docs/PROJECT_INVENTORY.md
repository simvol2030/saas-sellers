# Инвентаризация проекта: Landing Builder (Content Platform)

**Дата:** 2025-12-19
**Ветка:** dev
**Статус:** Документ для согласования

---

## Раздел 1: Фиксация того, что уже есть и работает

### 1.1 Backend (Hono) — ГОТОВО

#### Prisma Schema (6 моделей)

| Модель | Назначение | Поля |
|--------|------------|------|
| `User` | Пользователи | id, email, password (bcrypt), name, role (admin/editor/viewer) |
| `Session` | JWT refresh tokens | id, userId, refreshToken, userAgent, ipAddress, expiresAt |
| `Page` | Страницы лендингов | id, slug, title, description, sections (JSON), SEO поля, status |
| `Media` | Медиафайлы | id, filename, path, url, type, mimeType, size, alt, caption |
| `SiteSetting` | Настройки сайта | id, key, value (JSON), group |
| `ThemeOverride` | Кастомизация темы | id, name, value (CSS), isActive |

#### API Endpoints — ВСЕ РАБОТАЮТ

**Auth (`/api/auth`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| POST | `/login` | Логин (email + password) | - |
| POST | `/register` | Регистрация (первый пользователь = admin) | Admin* |
| POST | `/refresh` | Обновление access token | - |
| POST | `/logout` | Выход (удаление session) | - |
| GET | `/me` | Текущий пользователь | JWT |
| POST | `/change-password` | Смена пароля | JWT |

**Pages Admin (`/api/admin/pages`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| GET | `/` | Список страниц (пагинация, фильтры, поиск) | Editor+ |
| POST | `/` | Создать страницу | Editor+ |
| GET | `/:id` | Получить страницу | Editor+ |
| PUT | `/:id` | Обновить страницу | Editor+ |
| DELETE | `/:id` | Удалить страницу | Editor+ |
| POST | `/:id/publish` | Опубликовать | Editor+ |
| POST | `/:id/unpublish` | Снять с публикации | Editor+ |
| POST | `/:id/duplicate` | Дублировать | Editor+ |

**Pages Public (`/api/pages`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| GET | `/` | Список опубликованных страниц | - |
| GET | `/:slug` | Страница по slug | - |

**Media (`/api/media`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| GET | `/` | Список медиафайлов | Editor+ |
| POST | `/upload` | Загрузка файла (до 50MB) | Editor+ |
| GET | `/:type/:filename` | Раздача файла (public) | - |
| DELETE | `/:type/:filename` | Удаление файла | Editor+ |
| GET | `/info/:type/:filename` | Информация о файле | - |

**Settings (`/api/admin/settings`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| GET | `/` | Все настройки (grouped) | JWT |
| GET | `/:group` | Настройки по группе | JWT |
| PUT | `/:key` | Обновить настройку | JWT |
| POST | `/bulk` | Bulk update | JWT |
| DELETE | `/:key` | Удалить настройку | JWT |

**Theme (`/api/admin/theme`)**
| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| GET | `/` | Все theme overrides | JWT |
| GET | `/css` | Сгенерированный CSS | JWT |
| POST | `/` | Создать override | JWT |
| PUT | `/:id` | Обновить override | JWT |
| DELETE | `/:id` | Удалить override | JWT |
| POST | `/bulk` | Bulk upsert | JWT |
| POST | `/reset` | Сбросить все | JWT |

---

### 1.2 Frontend (Astro) — ГОТОВО

#### Layouts (4 штуки)

| Layout | Назначение | Файл |
|--------|------------|------|
| `Base.astro` | Базовый layout (HTML, head, SEO) | `layouts/Base.astro` |
| `Landing.astro` | Layout для лендингов с динамическими секциями | `layouts/Landing.astro` |
| `Post.astro` | Layout для блог-постов | `layouts/Post.astro` |
| `Admin.astro` | Layout для админки | `layouts/Admin.astro` |

#### Секции для лендингов (24 штуки) — ВСЕ ГОТОВЫ

| Категория | Секции |
|-----------|--------|
| **Hero (2)** | `Hero`, `HeroMin` |
| **Content (3)** | `TextBlock`, `Snippet`, `Longread` |
| **Media (5)** | `PhotoGallery`, `PhotoSlider`, `VideoYouTube`, `VideoLocal`, `MediaMix` |
| **Conversion (5)** | `CTA`, `FAQ`, `ContactForm`, `Pricing`, `CompareTable`, `Testimonials` |
| **Info (5)** | `Features`, `Timeline`, `Stats`, `Team`, `Partners` |
| **Social (2)** | `InstagramFeed`, `FacebookPost` |

#### Content Collections (MD) — РАБОТАЮТ

| Collection | Путь | Назначение |
|------------|------|------------|
| `blog` | `content/blog/*.md` | Блог посты |
| `pages` | `content/pages/*.md` | Статические страницы |
| `landings` | `content/landings/*.md` | Лендинги с секциями (YAML frontmatter) |
| `authors` | `content/authors/*.md` | Авторы |

#### Публичные страницы

| Страница | Путь | Описание |
|----------|------|----------|
| Главная | `/` | index.astro (Hero, Featured, Categories, Latest, CTA) |
| О нас | `/about` | about.astro |
| Блог | `/blog` | blog/index.astro |
| Пост | `/blog/[slug]` | blog/[...slug].astro |
| Категория | `/blog/category/[category]` | blog/category/[category].astro |
| Тег | `/blog/tag/[tag]` | blog/tag/[tag].astro |
| Динамическая | `/[slug]` | [slug].astro (лендинги) |
| 404 | `/404` | 404.astro |

#### Компоненты UI

| Компонент | Назначение |
|-----------|------------|
| `Header.astro` | Шапка сайта с навигацией |
| `Footer.astro` | Подвал сайта |
| `PostCard.astro` | Карточка поста |
| `PostList.astro` | Список постов |
| `PostMeta.astro` | Мета-информация поста |
| `TagList.astro` | Список тегов |
| `SEO.astro` | SEO meta tags |
| `TableOfContents.astro` | Оглавление |
| `Alert.astro` | Уведомления |
| `Button.astro` | Кнопка |
| `Card.astro` | Карточка |
| `Input.astro` | Поле ввода |
| `Spinner.astro` | Индикатор загрузки |

---

### 1.3 Админка (Astro + Svelte) — ГОТОВА

#### Страницы админки

| Страница | Путь | Компонент |
|----------|------|-----------|
| Dashboard | `/admin` | `Dashboard.svelte` |
| Login | `/admin/login` | login.astro |
| Список страниц | `/admin/pages` | `PagesList.svelte` |
| Новая страница | `/admin/pages/new` | `PageEditor.svelte` |
| Редактор страницы | `/admin/pages/[id]` | `PageEditor.svelte` |
| Редактор секции | `/admin/pages/[id]/sections/[index]` | `SectionEditor.svelte` |
| Медиа-галерея | `/admin/media` | `MediaGallery.svelte` |
| Настройки | `/admin/settings` | `SiteSettings.svelte` |
| Темы | `/admin/theme` | `ThemeEditor.svelte` |

#### Svelte компоненты админки (8 штук)

| Компонент | Размер | Назначение |
|-----------|--------|------------|
| `Dashboard.svelte` | 14KB | Главная админки, статистика |
| `PagesList.svelte` | 18KB | Список страниц с фильтрами |
| `PageEditor.svelte` | 36KB | Редактор страницы (основные данные) |
| `SectionEditor.svelte` | 51KB | Редактор секций (визуальный) |
| `MediaGallery.svelte` | 22KB | Галерея медиафайлов |
| `MediaPicker.svelte` | 8KB | Выбор медиа в редакторе |
| `SiteSettings.svelte` | 21KB | Настройки сайта |
| `ThemeEditor.svelte` | 23KB | Редактор темы (цвета, шрифты) |

---

### 1.4 Lib (библиотеки) — ГОТОВО

| Файл | Назначение |
|------|------------|
| `content.ts` | Unified content provider (MD + API) |
| `api.ts` | API client для frontend |
| `parser.ts` | Парсер секций (TypeScript types) |
| `sections.ts` | Registry секций (metadata) |
| `theme.config.ts` | Конфигурация темы |

---

### 1.5 DevSecOps — ГОТОВО

| Компонент | Статус |
|-----------|--------|
| Security Headers | ✅ `secureHeaders()` |
| CORS | ✅ configurable через env |
| Rate Limiting | ✅ 1000 req/15 min |
| JWT Authentication | ✅ access + refresh tokens |
| Password Hashing | ✅ bcrypt (12 rounds) |
| Input Validation | ✅ Zod schemas везде |
| SQL Injection | ✅ Prisma ORM |
| Path Traversal | ✅ проверка в media routes |

---

## Раздел 2: План доработки существующего (уточнения)

> Мелкие улучшения, которые не меняют архитектуру

### 2.1 Backend

| # | Задача | Файл | Приоритет |
|---|--------|------|-----------|
| 2.1.1 | Добавить пагинацию в `/api/media` | `routes/media.ts` | LOW |
| 2.1.2 | Добавить поиск по filename в медиа | `routes/media.ts` | LOW |
| 2.1.3 | Добавить сортировку в public pages | `routes/public-pages.ts` | LOW |
| 2.1.4 | Улучшить error messages (i18n ready) | все routes | LOW |

### 2.2 Frontend

| # | Задача | Файл | Приоритет |
|---|--------|------|-----------|
| 2.2.1 | Добавить loading states в секции | `components/sections/*` | LOW |
| 2.2.2 | Улучшить accessibility (aria-labels) | все компоненты | MEDIUM |
| 2.2.3 | Добавить print styles | `styles/global.css` | LOW |

### 2.3 Админка

| # | Задача | Файл | Приоритет |
|---|--------|------|-----------|
| 2.3.1 | Улучшить UX drag-n-drop секций | `SectionEditor.svelte` | MEDIUM |
| 2.3.2 | Добавить preview режим | `PageEditor.svelte` | MEDIUM |
| 2.3.3 | Добавить undo/redo | `PageEditor.svelte` | LOW |
| 2.3.4 | Улучшить mobile UI админки | `Admin.astro` | LOW |

---

## Раздел 3: План существенных доработок

> Новый функционал, расширение архитектуры

### 3.1 Export/Import MD (ваш workflow)

**Цель:** Создать шаблон → экспортировать в MD → масштабировать → импортировать обратно

| # | Задача | Описание | Приоритет |
|---|--------|----------|-----------|
| 3.1.1 | `GET /api/admin/pages/:id/export` | Экспорт страницы в MD (frontmatter + sections YAML) | HIGH |
| 3.1.2 | `POST /api/admin/pages/import` | Импорт MD файла → создание/обновление страницы | HIGH |
| 3.1.3 | `POST /api/admin/pages/import/batch` | Batch импорт нескольких MD файлов | MEDIUM |
| 3.1.4 | UI: кнопка "Экспорт в MD" | В `PageEditor.svelte` | HIGH |
| 3.1.5 | UI: кнопка "Импорт из MD" | В `PagesList.svelte` | HIGH |
| 3.1.6 | UI: batch экспорт всех страниц | В `PagesList.svelte` | LOW |

### 3.2 Переключатель источника данных

**Цель:** Возможность читать контент из MD файлов, SQLite, или обоих

| # | Задача | Описание | Приоритет |
|---|--------|----------|-----------|
| 3.2.1 | Env переменная `CONTENT_SOURCE` | `db` / `md` / `hybrid` | HIGH |
| 3.2.2 | Adapter для MD source | Читать из `content/landings/` напрямую | MEDIUM |
| 3.2.3 | Adapter для DB source | Текущая логика | READY |
| 3.2.4 | Hybrid mode | DB для админки, MD для версионирования | LOW |
| 3.2.5 | Sync: MD → DB | При старте синхронизировать MD в DB | LOW |

### 3.3 Мультисайтовость

**Цель:** Один инстанс → несколько сайтов (домены/поддомены)

| # | Задача | Описание | Приоритет |
|---|--------|----------|-----------|
| 3.3.1 | Модель `Site` в Prisma | domain, subdomain, name, ownerId, settings, theme | HIGH |
| 3.3.2 | Добавить `siteId` в Page | FK + индекс | HIGH |
| 3.3.3 | Добавить `siteId` в Media | FK + индекс | HIGH |
| 3.3.4 | Добавить `siteId` в SiteSetting | FK + индекс | HIGH |
| 3.3.5 | Добавить `siteId` в ThemeOverride | FK + индекс | HIGH |
| 3.3.6 | Middleware определения сайта | По домену/поддомену | HIGH |
| 3.3.7 | Изоляция данных в API | Фильтрация по siteId | HIGH |
| 3.3.8 | UI переключения сайтов | В админке | MEDIUM |
| 3.3.9 | API: CRUD для Sites | `/api/admin/sites` | HIGH |

### 3.4 Иерархические категории (для блога)

| # | Задача | Описание | Приоритет |
|---|--------|----------|-----------|
| 3.4.1 | Модель `Category` в Prisma | id, slug, name, parentId, description | LOW |
| 3.4.2 | Связь Post ↔ Category | many-to-many | LOW |
| 3.4.3 | API: CRUD категорий | `/api/admin/categories` | LOW |
| 3.4.4 | UI: управление категориями | В админке | LOW |

---

## Резюме

### Что НЕ трогаем (уже работает)
- 24 секции для лендингов
- Админка (8 Svelte компонентов)
- API endpoints (auth, pages, media, settings, theme)
- Content Collections (blog, pages, landings, authors)
- JWT авторизация
- DevSecOps (headers, CORS, rate limiting)

### Приоритеты для согласования

| Приоритет | Задача | Раздел |
|-----------|--------|--------|
| **HIGH** | Export/Import MD | 3.1 |
| **HIGH** | Мультисайтовость | 3.3 |
| **MEDIUM** | Переключатель CONTENT_SOURCE | 3.2 |
| **LOW** | Иерархические категории | 3.4 |
| **LOW** | Мелкие улучшения | 2.* |

---

**Жду согласования по приоритетам и порядку реализации.**
