---
title: "Работа с Content Collections в Astro"
description: "Полное руководство по использованию Content Collections для организации контента"
publishedAt: 2025-01-10
category: "tutorials"
tags: ["astro", "content", "markdown"]
author:
  name: "Content Team"
image:
  src: "/images/blog/content-collections.jpg"
  alt: "Content Collections"
---

## Что такое Content Collections?

Content Collections — это встроенная функция Astro для организации и типизации контента. Она позволяет:

- Валидировать frontmatter с помощью Zod
- Получать типобезопасный доступ к контенту
- Автоматически генерировать TypeScript типы

## Определение коллекций

Создайте файл `src/content/config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  blog: blogCollection,
};
```

## Получение контента

### Все записи коллекции

```typescript
import { getCollection } from 'astro:content';

const allPosts = await getCollection('blog');
const publishedPosts = await getCollection('blog', ({ data }) => {
  return data.draft !== true;
});
```

### Одна запись

```typescript
import { getEntry } from 'astro:content';

const post = await getEntry('blog', 'my-article');
```

## Рендеринг контента

```astro
---
import { getEntry } from 'astro:content';

const post = await getEntry('blog', 'my-article');
const { Content } = await post.render();
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

## Советы

1. **Используйте .default()** для опциональных полей
2. **Применяйте z.coerce.date()** для автоматического парсинга дат
3. **Создавайте отдельные коллекции** для разных типов контента
