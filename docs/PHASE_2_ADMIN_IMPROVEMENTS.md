# Фаза 2: Доработки админки и отладка компонентов

**Дата создания:** 2025-12-19
**Статус:** Ожидает завершения Фазы 1
**Приоритет:** HIGH — делаем ПОСЛЕ Фазы 1

---

## Контекст для восстановления

### О проекте
Это **Landing Page Builder** (Content Platform) на стеке:
- **Backend:** Hono 4.x + Prisma ORM + SQLite
- **Frontend:** Astro 5.x + Svelte (для админки)
- **Функционал:** Конструктор лендингов из 24 готовых секций с визуальным редактором

### Что сделано в Фазе 1
- Мультисайтовость (Site модель)
- Иерархия страниц (до 3 уровней)
- Теги для страниц
- Группировка медиафайлов (папки)
- Повторяемые секции (ReusableBlock)
- Управление меню

### Что делаем в Фазе 2
Функциональные улучшения админки и отладка всех 24 секций.

---

## 1. Export/Import страниц в Markdown

### 1.1 Формат экспорта

```markdown
---
# Метаданные страницы
title: "Название страницы"
slug: "page-slug"
description: "Описание"
status: published
parentSlug: "parent-page"  # Для иерархии
tags: ["tag1", "tag2"]

# SEO
metaTitle: "Meta Title"
metaDescription: "Meta Description"
ogImage: "/images/og.jpg"
canonicalUrl: "https://example.com/page"
noindex: false

# Layout
hideHeader: false
hideFooter: false
headerConfig: {}
footerConfig: {}

# Секции
sections:
  - type: hero
    id: hero-1
    title: "Заголовок"
    subtitle: "Подзаголовок"
    ctaText: "Кнопка"
    ctaHref: "#"
    align: center
    height: large

  - type: features
    id: features-1
    title: "Преимущества"
    columns: 3
    items:
      - icon: rocket
        title: "Быстро"
        description: "Описание"

  - type: cta
    id: cta-1
    title: "Готовы?"
    buttonText: "Начать"
    buttonHref: "/contact"
---

# Дополнительный контент (опционально)

Этот markdown-контент добавляется после всех секций.
```

### 1.2 Backend API

```
GET  /api/admin/pages/:id/export
     → Content-Type: text/markdown
     → Content-Disposition: attachment; filename="page-slug.md"

POST /api/admin/pages/import
     → Content-Type: multipart/form-data
     → Body: file (MD файл)
     → Response: { page: Page, created: boolean }

POST /api/admin/pages/import/batch
     → Body: files[] (несколько MD файлов)
     → Response: { pages: Page[], errors: Error[] }

GET  /api/admin/pages/export-all
     → Response: ZIP архив со всеми страницами
```

### 1.3 Frontend UI

**В PageEditor.svelte:**
- Кнопка "Экспорт в MD" → скачивает файл

**В PagesList.svelte:**
- Кнопка "Импорт из MD" → открывает модальное окно с drag-n-drop
- Кнопка "Экспорт всех" → скачивает ZIP

### 1.4 Экспорт с иерархией

При экспорте страницы с детьми:
- Создаётся папка с именем slug родителя
- Внутри — MD файлы детей
- Структура сохраняется

```
export/
├── about.md
├── services/
│   ├── _index.md        # Родительская страница
│   ├── web-design.md
│   └── seo.md
└── contact.md
```

---

## 2. Улучшение управления Layout

### 2.1 Расширенные настройки Header

```typescript
interface HeaderConfig {
  // Логотип
  logo: {
    type: 'text' | 'image';
    text?: string;
    image?: string;
    href: string;
  };

  // Навигация
  menuSlug: string;  // Связь с Menu
  showSearch: boolean;
  showThemeToggle: boolean;

  // Стили
  variant: 'default' | 'transparent' | 'sticky' | 'floating';
  backgroundColor?: string;
  textColor?: string;

  // CTA кнопка
  ctaButton?: {
    text: string;
    href: string;
    variant: 'primary' | 'secondary' | 'outline';
  };

  // Топбар (над хедером)
  topBar?: {
    enabled: boolean;
    content: string;  // HTML или текст
    backgroundColor?: string;
    dismissible: boolean;
  };
}
```

### 2.2 Расширенные настройки Footer

```typescript
interface FooterConfig {
  // Колонки
  columns: Array<{
    title: string;
    menuSlug?: string;  // Связь с Menu
    content?: string;   // Произвольный HTML
    type: 'menu' | 'text' | 'contact' | 'social';
  }>;

  // Нижняя строка
  bottomBar: {
    copyright: string;
    links: Array<{ label: string; href: string }>;
  };

  // Стили
  variant: 'default' | 'dark' | 'minimal';
  backgroundColor?: string;

  // Newsletter
  newsletter?: {
    enabled: boolean;
    title: string;
    placeholder: string;
    buttonText: string;
    endpoint: string;
  };

  // Social links
  socialLinks?: Array<{
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'telegram';
    url: string;
  }>;
}
```

### 2.3 UI для настройки Layout

**Новая страница `/admin/layout`:**
- Вкладка "Header"
- Вкладка "Footer"
- Предпросмотр в реальном времени

---

## 3. Улучшение редактора секций

### 3.1 Drag-n-Drop улучшения

**Текущее состояние:** Базовый drag-n-drop работает

**Улучшения:**
- Визуальная индикация места вставки
- Анимация перемещения
- Группировка секций (collapse/expand)
- Копирование секции drag-ом с зажатым Alt

### 3.2 Preview режим

**В SectionEditor.svelte:**
- Кнопка "Предпросмотр" → открывает секцию в iframe
- Режимы: Desktop / Tablet / Mobile
- Синхронизация изменений в реальном времени

### 3.3 Undo/Redo

- История изменений (последние 50 действий)
- Ctrl+Z / Ctrl+Y
- Панель истории изменений

---

## 4. Отладка всех 24 секций

### 4.1 Чек-лист тестирования каждой секции

Для каждой секции проверить:

- [ ] Рендеринг с минимальными данными
- [ ] Рендеринг со всеми полями
- [ ] Адаптивность (mobile/tablet/desktop)
- [ ] Тёмная тема
- [ ] Accessibility (aria-labels, keyboard navigation)
- [ ] Анимации (если есть)
- [ ] Производительность (lazy loading изображений)
- [ ] SEO (alt тексты, semantic HTML)

### 4.2 Список секций для отладки

**Hero секции (2):**
- [ ] `Hero` — главный баннер
- [ ] `HeroMin` — мини-баннер

**Content секции (3):**
- [ ] `TextBlock` — текстовый блок
- [ ] `Snippet` — фото + текст
- [ ] `Longread` — длинная статья с TOC

**Media секции (5):**
- [ ] `PhotoGallery` — галерея с lightbox
- [ ] `PhotoSlider` — слайдер изображений
- [ ] `VideoYouTube` — YouTube embed
- [ ] `VideoLocal` — локальное видео
- [ ] `MediaMix` — Instagram-style лента

**Conversion секции (6):**
- [ ] `CTA` — призыв к действию
- [ ] `FAQ` — аккордеон вопросов
- [ ] `ContactForm` — форма обратной связи
- [ ] `Pricing` — таблица тарифов
- [ ] `CompareTable` — сравнительная таблица
- [ ] `Testimonials` — отзывы

**Info секции (5):**
- [ ] `Features` — преимущества
- [ ] `Timeline` — этапы/история
- [ ] `Stats` — числа с анимацией
- [ ] `Team` — команда
- [ ] `Partners` — логотипы партнёров

**Social секции (3):**
- [ ] `InstagramFeed` — лента Instagram
- [ ] `FacebookPost` — пост Facebook

### 4.3 Известные проблемы для исправления

*(Заполняется по мере тестирования)*

| # | Секция | Проблема | Статус |
|---|--------|----------|--------|
| 1 | - | - | - |

---

## 5. UI для тегов страниц

### 5.1 В PageEditor.svelte

- Поле выбора тегов (multi-select с автокомплитом)
- Создание нового тега на лету
- Цветовые метки тегов

### 5.2 В PagesList.svelte

- Фильтр по тегам (chips)
- Отображение тегов в списке страниц
- Bulk операции (добавить/удалить тег у нескольких страниц)

---

## 6. UI для папок медиа

### 6.1 В MediaGallery.svelte

- Древовидная структура папок слева
- Breadcrumbs для навигации
- Drag-n-drop файлов в папки
- Создание/переименование/удаление папок
- Перемещение файлов между папками

### 6.2 В MediaPicker.svelte

- Та же древовидная структура
- Быстрый поиск по всем папкам

---

## 7. UI для повторяемых секций

### 7.1 Новая страница `/admin/blocks`

**Список блоков:**
- Превью блока (thumbnail)
- Название и описание
- Количество использований
- Дата создания/обновления

**Редактор блока:**
- Тот же SectionEditor, но для блока
- Preview
- Список страниц, где используется

### 7.2 Интеграция в PageEditor

- Кнопка "Вставить блок" рядом с "Добавить секцию"
- Модальное окно выбора блока
- Блок отображается с пометкой "Reusable Block"
- При клике — переход в редактор блока (с предупреждением что изменится везде)

---

## 8. UI для меню

### 8.1 Новая страница `/admin/menus`

**Список меню:**
- Header menu
- Footer menu
- Custom menus

**Редактор меню:**
- Drag-n-drop для изменения порядка
- Вложенные пункты (до 2 уровней)
- Связь с существующими страницами
- Произвольные ссылки
- Иконки для пунктов

---

## 9. Улучшение производительности админки

### 9.1 Проблема
> "Админка немножко тормозит, данные подгружаются с задержкой"

### 9.2 Решения

**Frontend:**
- Skeleton loading для всех списков
- Оптимистичные обновления (UI обновляется до ответа сервера)
- Кэширование данных (SWR паттерн)
- Lazy loading компонентов

**Backend:**
- Pagination везде
- Индексы в БД (уже есть, проверить)
- Кэширование частых запросов

---

## 10. Чек-лист Фазы 2

### Export/Import MD
- [ ] 1.1 Backend: GET /api/admin/pages/:id/export
- [ ] 1.2 Backend: POST /api/admin/pages/import
- [ ] 1.3 Backend: POST /api/admin/pages/import/batch
- [ ] 1.4 Backend: GET /api/admin/pages/export-all
- [ ] 1.5 UI: Кнопка "Экспорт в MD" в PageEditor
- [ ] 1.6 UI: Модальное окно импорта в PagesList

### Улучшение Layout
- [ ] 2.1 Расширить HeaderConfig
- [ ] 2.2 Расширить FooterConfig
- [ ] 2.3 UI: Страница /admin/layout

### Редактор секций
- [ ] 3.1 Улучшить drag-n-drop
- [ ] 3.2 Добавить Preview режим
- [ ] 3.3 Добавить Undo/Redo

### Отладка секций
- [ ] 4.1 Протестировать все 24 секции
- [ ] 4.2 Исправить найденные баги
- [ ] 4.3 Улучшить accessibility

### UI для тегов
- [ ] 5.1 Добавить теги в PageEditor
- [ ] 5.2 Добавить фильтр по тегам в PagesList

### UI для папок медиа
- [ ] 6.1 Добавить дерево папок в MediaGallery
- [ ] 6.2 Drag-n-drop файлов в папки

### UI для блоков
- [ ] 7.1 Создать страницу /admin/blocks
- [ ] 7.2 Интегрировать блоки в PageEditor

### UI для меню
- [ ] 8.1 Создать страницу /admin/menus
- [ ] 8.2 Редактор меню с drag-n-drop

### Производительность
- [ ] 9.1 Добавить skeleton loading
- [ ] 9.2 Оптимизировать запросы

---

## 11. Порядок реализации Фазы 2

1. **Export/Import MD** — ключевой workflow
2. **UI для тегов** — зависит от Фазы 1
3. **UI для папок медиа** — зависит от Фазы 1
4. **UI для блоков** — зависит от Фазы 1
5. **UI для меню** — зависит от Фазы 1
6. **Улучшение Layout** — расширение существующего
7. **Редактор секций** — улучшения UX
8. **Отладка секций** — в конце
9. **Производительность** — параллельно с остальным

---

**После завершения Фазы 2 проект будет готов к production использованию.**

---

## Отложенные задачи (Фаза 3+)

Эти задачи НЕ входят в текущий план:

- [ ] CONTENT_SOURCE переключатель (db/md/hybrid)
- [ ] Иерархические категории для блога
- [ ] Версионирование страниц
- [ ] A/B тестирование
- [ ] Аналитика
- [ ] Комментарии
- [ ] Полнотекстовый поиск (Algolia/Meilisearch)
- [ ] i18n (мультиязычность)
