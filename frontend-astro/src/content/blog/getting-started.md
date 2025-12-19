---
title: "Начало работы с контентной платформой"
description: "Пошаговое руководство по созданию контентного сайта на базе Astro и Hono"
publishedAt: 2025-01-15
category: "tutorials"
tags: ["astro", "hono", "getting-started"]
featured: true
author:
  name: "Content Team"
  avatar: "/avatars/team.jpg"
image:
  src: "/images/blog/getting-started.jpg"
  alt: "Getting Started"
---

## Введение

Добро пожаловать в документацию контентной платформы! Этот стартовый набор позволяет быстро создавать контентные сайты с поддержкой:

- **Markdown контента** — пишите статьи в MD файлах
- **SQLite базы данных** — храните структурированные данные
- **API backend** — Hono для динамического контента

## Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone <repo-url>
cd project-box
```

### 2. Установите зависимости

```bash
# Frontend
cd frontend-astro && npm install

# Backend
cd ../backend-hono && npm install
```

### 3. Настройте базу данных

```bash
cd backend-hono
npx prisma generate
npx prisma migrate dev
```

### 4. Запустите проект

```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd frontend-astro && npm run dev
```

## Структура контента

```
src/content/
├── blog/           # Статьи блога
│   └── *.md
├── pages/          # Статические страницы
│   └── *.md
└── authors/        # Авторы
    └── *.md
```

## Создание новой статьи

Создайте файл `src/content/blog/my-article.md`:

```markdown
---
title: "Моя статья"
description: "Описание статьи"
publishedAt: 2025-01-20
category: "news"
tags: ["example"]
---

Содержимое статьи...
```

## Следующие шаги

- Изучите [API документацию](/docs/api)
- Настройте [SEO параметры](/docs/seo)
- Добавьте [собственные компоненты](/docs/components)
