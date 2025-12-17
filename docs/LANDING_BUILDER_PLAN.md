# Landing Builder - План реализации

**Дата создания:** 2025-12-17
**Статус:** В работе

---

## Концепция

**Component-Based Landing Builder** — система для быстрого создания лендингов через:
1. Библиотеку переиспользуемых секций (LEGO-блоки)
2. MD файлы как источник данных
3. Админку для управления контентом и дизайн-системой
4. Настраиваемую дизайн-систему (не хардкод)

---

## Дизайн-система

**Стиль:** Строгий деловой, основной цвет — синий
**Управление:** Через `theme.config.ts` + админка
**Темы:** Светлая / Тёмная

---

## Медиа файлы

**Расположение:** `/data/media/`
```
data/media/
├── images/      # Изображения
├── videos/      # Видео файлы
└── documents/   # Документы (PDF и т.д.)
```

**Загрузка:**
- Напрямую через файловый менеджер сервера
- Через админку (upload API)

---

## Фазы реализации

### ФАЗА 1: Инфраструктура и дизайн-система

**Задачи:**
- [x] Дизайн-система (`theme.config.ts`)
  - CSS переменные (цвета, шрифты, spacing, shadows)
  - Управление через конфиг
  - Светлая/тёмная тема
- [x] Layout система
  - Header (двухуровневое меню, логотип)
  - Footer (колонки, соцсети, копирайт)
  - Настройки layout через MD/JSON
- [x] MD Parser для секций
  - Парсинг frontmatter с секциями
  - Динамический рендеринг компонентов
- [x] API для медиа файлов
  - Upload endpoint
  - Serve static files из `/data/media/`

**Результат:** Базовая инфраструктура готова

---

### ФАЗА 2: Базовые секции ✅

**Компоненты:**
- [x] **Hero** — главный баннер (фото/видео фон, заголовок, CTA)
- [x] **HeroMin** — мини-баннер для подстраниц
- [x] **TextBlock** — текстовый блок с Markdown
- [x] **Snippet** — фото + текст (позиция настраивается)
- [x] **CTA** — призыв к действию

**Результат:** Можно собрать простой лендинг

---

### ФАЗА 3: Медиа секции ✅

**Компоненты:**
- [x] **PhotoGallery** — галерея с lightbox и swipe
- [x] **PhotoSlider** — слайдер изображений
- [x] **VideoYouTube** — встроенное YouTube видео
- [x] **VideoLocal** — локальное видео (autoplay on scroll, muted)
- [x] **MediaMix** — Instagram-style (фото + видео + текст expand)

**Результат:** Полная поддержка медиа контента

---

### ФАЗА 4: Конверсионные секции ✅

**Компоненты:**
- [x] **FAQ** — вопросы-ответы (аккордеон)
- [x] **ContactForm** — форма обратной связи
- [x] **Pricing** — таблица тарифов
- [x] **CompareTable** — сравнительная таблица
- [x] **Testimonials** — отзывы (карточки/слайдер)

**Результат:** Элементы для конверсии

---

### ФАЗА 5: Контентные секции ✅

**Компоненты:**
- [x] **Features** — преимущества (grid, иконки)
- [x] **Timeline** — этапы/таймлайн
- [x] **Stats** — статистика с анимацией
- [x] **Team** — команда
- [x] **Partners** — логотипы партнёров

**Результат:** Информационные блоки

---

### ФАЗА 6: Social-style секции ✅

**Компоненты:**
- [x] **InstagramFeed** — лента Instagram-style с lightbox
- [x] **FacebookPost** — пост Facebook-style с reactions
- [x] **Longread** — длинная статья с TOC, progress bar

**Результат:** Social-style контент

---

### ФАЗА 7: Админка (в работе)

**Под-фазы:**

#### 7.1 Инфраструктура ✅
- [x] Расширенная Prisma schema (User, Session, Page, Media, Settings)
- [x] JWT аутентификация (jose + bcryptjs)
- [x] Auth routes (login, refresh, logout, register)
- [x] Astro SSR mode + @astrojs/node adapter
- [x] Svelte 5 интеграция для Islands
- [x] Admin layout (sidebar, theme toggle, user menu)
- [x] Login page + защита admin routes
- [x] Dashboard placeholder + placeholder страницы

#### 7.2 Pages CRUD (следующая)
- [ ] API endpoints для pages
- [ ] Pages List (таблица с фильтрами)
- [ ] Page Editor (базовый)
- [ ] Publish/Unpublish workflow

#### 7.3 Section Editor
- [ ] Visual формы для каждого типа секции
- [ ] Drag-n-drop сортировка секций
- [ ] Preview mode
- [ ] Добавление/удаление секций

#### 7.4 Media Manager
- [ ] Галерея с grid view
- [ ] Upload с progress
- [ ] Редактирование alt/caption
- [ ] Интеграция с Section Editor

#### 7.5 Design System Editor
- [ ] Color picker для theme
- [ ] Font selector
- [ ] Spacing controls
- [ ] Live preview

#### 7.6 Dashboard & Settings
- [ ] Dashboard со статистикой
- [ ] Header/Footer editor
- [ ] Site settings (logo, title, etc.)

**Mobile-friendly:** Адаптивный интерфейс для работы с телефона

**Результат:** Полноценная админка

---

## Структура проекта (целевая)

```
frontend-astro/
├── src/
│   ├── components/
│   │   ├── sections/           # Секции (LEGO-блоки)
│   │   │   ├── Hero.astro
│   │   │   ├── HeroMin.astro
│   │   │   ├── Snippet.astro
│   │   │   ├── FAQ.astro
│   │   │   ├── PhotoGallery.astro
│   │   │   ├── VideoLocal.astro
│   │   │   └── ...
│   │   ├── ui/                 # UI компоненты
│   │   │   ├── Button.astro
│   │   │   ├── Input.astro
│   │   │   └── ...
│   │   └── admin/              # Компоненты админки
│   │       ├── Sidebar.astro
│   │       ├── MediaUploader.astro
│   │       └── ...
│   ├── layouts/
│   │   ├── Base.astro          # Базовый layout
│   │   ├── Landing.astro       # Layout для лендингов
│   │   └── Admin.astro         # Layout для админки
│   ├── pages/
│   │   ├── index.astro
│   │   ├── [...slug].astro     # Динамические страницы
│   │   └── admin/              # Админка
│   │       ├── index.astro
│   │       ├── pages/
│   │       ├── media/
│   │       └── settings/
│   ├── content/
│   │   └── landings/           # MD файлы лендингов
│   ├── lib/
│   │   ├── theme.config.ts     # Дизайн-система
│   │   ├── sections.ts         # Реестр секций
│   │   └── parser.ts           # MD парсер
│   └── styles/
│       ├── theme.css           # CSS переменные
│       └── global.css
│
├── data/
│   ├── db/                     # SQLite база
│   ├── media/                  # Медиа файлы
│   │   ├── images/
│   │   ├── videos/
│   │   └── documents/
│   └── logs/
│
└── backend-hono/
    └── src/
        └── routes/
            ├── media.ts        # Upload/serve медиа
            ├── pages.ts        # CRUD страниц
            └── settings.ts     # Настройки сайта
```

---

## Приоритеты

1. **ФАЗА 1** — без неё ничего не работает
2. **ФАЗА 2** — минимальный функционал
3. **ФАЗА 3** — медиа критично для лендингов
4. **ФАЗА 7** (частично) — базовая админка для удобства
5. **ФАЗА 4-6** — расширение библиотеки

---

## Текущий статус

**Активная фаза:** ФАЗА 7.2 (Pages CRUD)
**Прогресс:** ~90% (Фазы 1-6 + 7.1 завершены)

### Что сделано:

**Фаза 1 (Инфраструктура):**
- `theme.config.ts` - полная дизайн-система с CSS переменными
- `theme.css` - стили для светлой/тёмной темы
- `Header.astro` - двухуровневое меню с theme toggle
- `Footer.astro` - колонки, соцсети, newsletter
- `parser.ts` - парсер MD с секциями
- `sections.ts` - реестр всех секций
- `Landing.astro` - layout для лендингов
- `media.ts` - API для upload/serve медиа
- Content Collection `landings` - схема для MD файлов
- Пример лендинга `home.md`

**Фаза 2 (Базовые секции):**
- `Hero.astro` - баннер с фото/видео фоном, overlay, CTA
- `HeroMin.astro` - мини-баннер с breadcrumbs
- `TextBlock.astro` - текст с Markdown, prose стили
- `Snippet.astro` - фото + текст с позиционированием
- `CTA.astro` - призыв к действию (3 варианта)

**Фаза 3 (Медиа секции):**
- `PhotoGallery.astro` - галерея с lightbox, keyboard nav, swipe
- `PhotoSlider.astro` - слайдер с autoplay, progress bar, swipe
- `VideoYouTube.astro` - privacy-enhanced embed, lazy loading
- `VideoLocal.astro` - autoplay on scroll, sound toggle, progress
- `MediaMix.astro` - Instagram-style grid с expand modal

**Фаза 4 (Конверсионные секции):**
- `FAQ.astro` - аккордеон с ARIA, keyboard nav, Schema.org
- `ContactForm.astro` - динамические поля, валидация, состояния
- `Pricing.astro` - карточки тарифов, highlighted план
- `CompareTable.astro` - адаптивная таблица, sticky колонка
- `Testimonials.astro` - grid/slider layouts, рейтинг звёздами

**Фаза 5 (Контентные секции):**
- `Features.astro` - grid 2-4 колонки, icons, hover effects
- `Timeline.astro` - вертикальный таймлайн, scroll animation
- `Stats.astro` - animated counters, 3 варианта оформления
- `Team.astro` - карточки с аватарами, соцсети
- `Partners.astro` - логотипы с grayscale режимом

**Фаза 6 (Social-style секции):**
- `InstagramFeed.astro` - grid лента, lightbox, лайки
- `FacebookPost.astro` - пост с реакциями, комментариями
- `Longread.astro` - длинная статья с TOC, прогресс чтения

**Фаза 7.1 (Инфраструктура админки):**
- Prisma schema: User, Session, Page, Media, SiteSetting, ThemeOverride
- JWT auth: login, refresh, logout, register, change-password
- Astro SSR mode + @astrojs/node adapter
- Svelte 5 интеграция для интерактивных компонентов
- Admin layout: sidebar, theme toggle, user menu, responsive
- Login page с JWT token storage
- Dashboard + placeholder страницы (Pages, Media, Theme, Settings)

---

## Заметки

- SSG/SSR настраивается в frontmatter каждой страницы
- Все компоненты адаптивны (mobile-first)
- Все компоненты поддерживают светлую/тёмную тему
- Дизайн-система управляется централизованно
