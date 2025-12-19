# Phase 2: Implementation Plan

**Дата:** 2025-12-19
**Статус:** Аудит завершён, готов к реализации
**Зависит от:** Phase 1 (завершена)

---

## Результаты аудита

### Недостающие backend endpoints (нужно добавить):

| Endpoint | Файл | Статус |
|----------|------|--------|
| `GET /api/admin/pages/tree` | pages.ts | НУЖНО добавить |
| `PUT /api/admin/pages/:id/tags` | pages.ts | НУЖНО добавить |
| `GET /api/admin/pages/:id/export` | pages.ts | НУЖНО добавить |
| `POST /api/admin/pages/import` | pages.ts | НУЖНО добавить |
| `POST /api/admin/pages/import/batch` | pages.ts | НУЖНО добавить |
| `GET /api/admin/pages/export-all` | pages.ts | НУЖНО добавить |

### Недостающие npm dependencies:

```json
{
  "gray-matter": "^4.0.3",
  "archiver": "^7.0.1",
  "@types/archiver": "^6.0.3"
}
```

### Frontend pages (нужно создать):

| Путь | Статус |
|------|--------|
| `/admin/blocks/` | НУЖНО создать |
| `/admin/blocks/[id]` | НУЖНО создать |
| `/admin/menus/` | НУЖНО создать |
| `/admin/menus/[id]` | НУЖНО создать |
| `/admin/layout` | НУЖНО создать |

---

## Контекст

### Что сделано в Phase 1 (Backend готов)

| Компонент | API Endpoints | Статус |
|-----------|---------------|--------|
| Sites | `/api/admin/sites` CRUD + switch | OK |
| Tags | `/api/admin/tags` CRUD | OK |
| MediaFolders | `/api/admin/media/folders` CRUD + move | OK |
| ReusableBlocks | `/api/admin/blocks` CRUD + usages | OK |
| Menus | `/api/admin/menus` CRUD + public | OK |
| Page Hierarchy | parentId, level, path, order | OK |

### Что нужно сделать в Phase 2

1. **Frontend UI** для всех Phase 1 features (приоритет HIGH)
2. **Export/Import MD** - новый функционал (приоритет HIGH)
3. **Layout improvements** - расширение конфигураций (приоритет MEDIUM)
4. **Editor improvements** - UX улучшения (приоритет LOW)

---

## Block 1: Frontend UI для Phase 1 (приоритет HIGH)

### 1.1 Sites Switcher в Header админки

**Файлы:**
- `frontend-astro/src/layouts/Admin.astro` - добавить компонент
- `frontend-astro/src/components/admin/SiteSwitcher.svelte` - новый компонент

**Функционал:**
- Dropdown со списком сайтов пользователя
- Текущий сайт отображается в header
- Switch сайта → обновление X-Site-ID header во всех запросах
- localStorage для сохранения выбранного siteId

**API используется:**
```
GET  /api/admin/sites
POST /api/admin/sites/:id/switch
```

**Оценка:** ~100 строк Svelte

---

### 1.2 Tags в PageEditor и PagesList

**Файлы:**
- `frontend-astro/src/components/admin/PageEditor.svelte` - добавить секцию тегов
- `frontend-astro/src/components/admin/PagesList.svelte` - добавить фильтр и отображение
- `frontend-astro/src/components/admin/TagSelect.svelte` - новый компонент (multi-select)

**Функционал:**
- **PageEditor:** Multi-select тегов с autocomplete + создание нового тега на лету
- **PagesList:** Chips фильтр по тегам, отображение тегов в списке

**API используется:**
```
GET    /api/admin/tags
POST   /api/admin/tags
PUT    /api/admin/pages/:id/tags
GET    /api/admin/pages?tag=slug
```

**Оценка:** ~200 строк Svelte

---

### 1.3 MediaFolders в MediaGallery

**Файлы:**
- `frontend-astro/src/components/admin/MediaGallery.svelte` - рефакторинг с папками
- `frontend-astro/src/components/admin/FolderTree.svelte` - новый компонент
- `frontend-astro/src/components/admin/MediaPicker.svelte` - обновить с папками

**Функционал:**
- Дерево папок слева (sidebar)
- Breadcrumbs навигация
- Создание/переименование/удаление папок
- Drag-n-drop файлов в папки
- Перемещение файлов между папками

**API используется:**
```
GET    /api/admin/media/folders?tree=true
POST   /api/admin/media/folders
PUT    /api/admin/media/folders/:id
DELETE /api/admin/media/folders/:id
PUT    /api/admin/media/folders/move/:mediaId
GET    /api/admin/media?folderId=:id
```

**Оценка:** ~400 строк Svelte (крупный рефакторинг)

---

### 1.4 ReusableBlocks страница /admin/blocks

**Файлы:**
- `frontend-astro/src/pages/admin/blocks/index.astro` - новая страница
- `frontend-astro/src/pages/admin/blocks/[id].astro` - редактор блока
- `frontend-astro/src/components/admin/BlocksList.svelte` - новый компонент
- `frontend-astro/src/components/admin/BlockEditor.svelte` - новый компонент

**Функционал:**
- Список блоков (название, описание, превью, кол-во использований)
- Редактор блока (тот же SectionEditor, но для блока)
- Просмотр где используется блок

**API используется:**
```
GET    /api/admin/blocks
POST   /api/admin/blocks
GET    /api/admin/blocks/:id
PUT    /api/admin/blocks/:id
DELETE /api/admin/blocks/:id
GET    /api/admin/blocks/:id/usages
```

**Оценка:** ~500 строк Svelte

---

### 1.5 Интеграция блоков в PageEditor

**Файлы:**
- `frontend-astro/src/components/admin/PageEditor.svelte` - добавить "Вставить блок"
- `frontend-astro/src/components/admin/BlockPicker.svelte` - модальное окно выбора

**Функционал:**
- Кнопка "Вставить блок" рядом с "Добавить секцию"
- Модальное окно с превью блоков
- Вставка блока в позицию
- Визуальная индикация "Reusable Block" в списке секций
- Warning при попытке редактировать (изменится везде)

**API используется:**
```
POST   /api/admin/pages/:pageId/blocks
DELETE /api/admin/pages/:pageId/blocks/:usageId
```

**Оценка:** ~150 строк Svelte

---

### 1.6 Menus страница /admin/menus

**Файлы:**
- `frontend-astro/src/pages/admin/menus/index.astro` - новая страница
- `frontend-astro/src/pages/admin/menus/[id].astro` - редактор меню
- `frontend-astro/src/components/admin/MenusList.svelte` - новый компонент
- `frontend-astro/src/components/admin/MenuEditor.svelte` - новый компонент

**Функционал:**
- Список меню (header, footer, custom)
- Редактор меню с drag-n-drop
- Вложенные пункты (до 2 уровней)
- Связь с существующими страницами (pageId → автообновление href)
- Произвольные ссылки
- Иконки для пунктов

**API используется:**
```
GET    /api/admin/menus
POST   /api/admin/menus
GET    /api/admin/menus/:id
PUT    /api/admin/menus/:id
DELETE /api/admin/menus/:id
```

**Оценка:** ~600 строк Svelte

---

### 1.7 Page Hierarchy в PagesList и PageEditor

**Файлы:**
- `frontend-astro/src/components/admin/PagesList.svelte` - отображение иерархии
- `frontend-astro/src/components/admin/PageEditor.svelte` - выбор родительской страницы

**Функционал:**
- **PagesList:**
  - Отображение дерева страниц (indent по level)
  - Фильтр по parentId
  - Expand/collapse дочерних страниц
- **PageEditor:**
  - Dropdown выбора родительской страницы
  - Автоматический расчёт path
  - Валидация уровня вложенности (max 3)

**API используется:**
```
GET /api/admin/pages?parentId=null
GET /api/admin/pages/tree
PUT /api/admin/pages/:id (parentId, level, order)
```

**Оценка:** ~200 строк Svelte

---

## Block 2: Export/Import MD (приоритет HIGH)

### 2.1 Backend: Export endpoint

**Файл:** `backend-hono/src/routes/pages.ts`

```typescript
GET /api/admin/pages/:id/export
→ Content-Type: text/markdown
→ Content-Disposition: attachment; filename="slug.md"
```

**Формат MD:**
```markdown
---
title: "Page Title"
slug: "page-slug"
description: "Description"
status: published
parentSlug: "parent-page"
tags: ["tag1", "tag2"]
metaTitle: "SEO Title"
metaDescription: "SEO Description"
ogImage: "/images/og.jpg"
canonicalUrl: "https://example.com/page"
noindex: false
hideHeader: false
hideFooter: false
sections:
  - type: hero
    id: hero-1
    title: "Heading"
    # ... all section fields
---
```

**Оценка:** ~100 строк TypeScript

---

### 2.2 Backend: Import endpoint

**Файл:** `backend-hono/src/routes/pages.ts`

```typescript
POST /api/admin/pages/import
→ Content-Type: multipart/form-data
→ Body: file (MD file)
→ Response: { page: Page, created: boolean }
```

**Логика:**
1. Парсинг frontmatter (gray-matter)
2. Резолв parentSlug → parentId
3. Резолв tags slugs → tag IDs (создать если не существуют)
4. Upsert страницы по slug (update если exists)
5. Возврат результата

**Оценка:** ~150 строк TypeScript

---

### 2.3 Backend: Batch import

**Файл:** `backend-hono/src/routes/pages.ts`

```typescript
POST /api/admin/pages/import/batch
→ Body: files[] (multiple MD files)
→ Response: { pages: Page[], errors: Error[] }
```

**Оценка:** ~50 строк TypeScript

---

### 2.4 Backend: Export all (ZIP)

**Файл:** `backend-hono/src/routes/pages.ts`

```typescript
GET /api/admin/pages/export-all
→ Content-Type: application/zip
→ Response: ZIP archive with folder structure
```

**Структура ZIP:**
```
export/
├── about.md
├── services/
│   ├── _index.md        # Родительская страница
│   ├── web-design.md
│   └── seo.md
└── contact.md
```

**Зависимости:** `archiver` (npm)

**Оценка:** ~100 строк TypeScript

---

### 2.5 Frontend: Export/Import UI

**Файлы:**
- `frontend-astro/src/components/admin/PageEditor.svelte` - кнопка "Экспорт в MD"
- `frontend-astro/src/components/admin/PagesList.svelte` - кнопки "Импорт" и "Экспорт всех"
- `frontend-astro/src/components/admin/ImportModal.svelte` - модальное окно импорта

**Функционал:**
- Drag-n-drop зона для MD файлов
- Превью импортируемых страниц
- Выбор: создать новые / обновить существующие
- Progress bar для batch операций

**Оценка:** ~300 строк Svelte

---

## Block 3: Layout Improvements (приоритет MEDIUM)

### 3.1 Extended HeaderConfig

**Файлы:**
- `backend-hono/src/routes/settings.ts` - валидация расширенного формата
- `frontend-astro/src/components/admin/LayoutSettings.svelte` - новый компонент
- `frontend-astro/src/pages/admin/layout.astro` - новая страница

**HeaderConfig расширение:**
```typescript
interface HeaderConfig {
  logo: { type: 'text' | 'image'; text?: string; image?: string; href: string };
  menuSlug: string;
  showSearch: boolean;
  showThemeToggle: boolean;
  variant: 'default' | 'transparent' | 'sticky' | 'floating';
  backgroundColor?: string;
  textColor?: string;
  ctaButton?: { text: string; href: string; variant: string };
  topBar?: { enabled: boolean; content: string; backgroundColor?: string; dismissible: boolean };
}
```

**Оценка:** ~400 строк Svelte

---

### 3.2 Extended FooterConfig

**FooterConfig расширение:**
```typescript
interface FooterConfig {
  columns: Array<{ title: string; menuSlug?: string; content?: string; type: 'menu' | 'text' | 'contact' | 'social' }>;
  bottomBar: { copyright: string; links: Array<{ label: string; href: string }> };
  variant: 'default' | 'dark' | 'minimal';
  backgroundColor?: string;
  newsletter?: { enabled: boolean; title: string; placeholder: string; buttonText: string; endpoint: string };
  socialLinks?: Array<{ platform: string; url: string }>;
}
```

**Оценка:** ~300 строк Svelte

---

## Block 4: Editor Improvements (приоритет LOW)

### 4.1 Improved Drag-n-Drop

**Файл:** `frontend-astro/src/components/admin/SectionEditor.svelte`

- Визуальная индикация места вставки (drop indicator)
- Анимация перемещения
- Группировка секций (collapse/expand)
- Copy on drag with Alt key

**Оценка:** ~200 строк (рефакторинг существующего)

---

### 4.2 Preview Mode

**Файлы:**
- `frontend-astro/src/components/admin/SectionPreview.svelte` - новый компонент
- `frontend-astro/src/components/admin/PageEditor.svelte` - интеграция

**Функционал:**
- Режимы: Desktop (1200px) / Tablet (768px) / Mobile (375px)
- Iframe с live-синхронизацией
- Toggle между Edit и Preview

**Оценка:** ~250 строк Svelte

---

### 4.3 Undo/Redo

**Файл:** `frontend-astro/src/components/admin/PageEditor.svelte`

- История изменений (последние 50 действий)
- Ctrl+Z / Ctrl+Y горячие клавиши
- UI индикатор (можно undo/redo)

**Оценка:** ~100 строк Svelte

---

## Block 5: Section Testing (отдельная задача)

Тестирование и отладка 24 секций — выполняется после реализации основного UI.

---

## Порядок реализации (пересмотренный после аудита)

### Этап 1: Backend дополнения
1. [ ] Добавить `GET /api/admin/pages/tree` в pages.ts
2. [ ] Добавить `PUT /api/admin/pages/:id/tags` в pages.ts
3. [ ] Установить gray-matter, archiver dependencies

### Этап 2: Core Phase 1 UI
4. [ ] 1.1 Sites Switcher (SiteSwitcher.svelte + Admin.astro)
5. [ ] 1.7 Page Hierarchy UI (PagesList.svelte + PageEditor.svelte)
6. [ ] 1.2 Tags UI (TagSelect.svelte + интеграция)
7. [ ] 1.3 MediaFolders UI (FolderTree.svelte + MediaGallery рефакторинг)

### Этап 3: Blocks & Menus pages
8. [ ] Создать /admin/blocks/ (BlocksList.svelte)
9. [ ] Создать /admin/blocks/[id] (BlockEditor.svelte)
10. [ ] 1.5 Blocks in PageEditor (BlockPicker.svelte)
11. [ ] Создать /admin/menus/ (MenusList.svelte)
12. [ ] Создать /admin/menus/[id] (MenuEditor.svelte)

### Этап 4: Export/Import
13. [ ] 2.1-2.4 Backend export/import endpoints
14. [ ] 2.5 Import/Export UI (ImportModal.svelte)

### Этап 5: Layout & UX (опционально)
15. [ ] Создать /admin/layout (LayoutSettings.svelte)
16. [ ] 4.1 Improved drag-n-drop
17. [ ] 4.2 Preview mode
18. [ ] 4.3 Undo/Redo

### Этап 6: Testing
19. [ ] Section testing (отдельная задача)

---

## Зависимости (npm)

**Backend:**
```json
{
  "gray-matter": "^4.0.3",   // MD frontmatter parsing
  "archiver": "^7.0.1",      // ZIP creation
  "@types/archiver": "^6.0.3"
}
```

**Frontend:**
- Нет новых зависимостей (используем существующие)

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| MediaGallery рефакторинг сломает существующий UI | MEDIUM | Инкрементальный подход, тесты |
| Export MD формат несовместим с импортом | LOW | Единая схема, unit tests |
| Undo/Redo замедлит редактор | LOW | Debounce, оптимизация |

---

## Acceptance Criteria

### Block 1: Phase 1 UI
- [ ] Можно переключать сайты в header админки
- [ ] Можно добавлять/удалять теги к страницам
- [ ] Можно создавать папки и перемещать медиа
- [ ] Можно создавать и редактировать reusable blocks
- [ ] Можно вставлять блоки в страницы
- [ ] Можно создавать и редактировать меню
- [ ] Страницы отображаются с иерархией

### Block 2: Export/Import
- [ ] Экспорт страницы в MD файл
- [ ] Импорт MD файла создаёт/обновляет страницу
- [ ] Batch импорт нескольких файлов
- [ ] Export all создаёт ZIP с правильной структурой

### Block 3: Layout
- [ ] Настройки Header (logo, menu, CTA, topbar)
- [ ] Настройки Footer (columns, newsletter, social)

### Block 4: UX
- [ ] Drag-n-drop с визуальной индикацией
- [ ] Preview в разных размерах экрана
- [ ] Undo/Redo работает

---

**Готово к аудиту.**
