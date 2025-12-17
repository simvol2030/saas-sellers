/**
 * Database Seed Script
 * Создает начальные данные для контентной платформы
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==========================================
  // CREATE USERS
  // ==========================================
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      bio: 'Администратор контентной платформы',
    },
  });

  const author = await prisma.user.upsert({
    where: { email: 'author@example.com' },
    update: {},
    create: {
      email: 'author@example.com',
      name: 'John Author',
      role: 'author',
      bio: 'Автор технических статей о веб-разработке',
    },
  });

  console.log('Created users:', { admin: admin.id, author: author.id });

  // ==========================================
  // CREATE CATEGORIES
  // ==========================================
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'tutorials' },
      update: {},
      create: {
        slug: 'tutorials',
        name: 'Tutorials',
        description: 'Пошаговые руководства по веб-разработке',
        color: '#3b82f6',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'news' },
      update: {},
      create: {
        slug: 'news',
        name: 'News',
        description: 'Новости мира веб-разработки',
        color: '#22c55e',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'reviews' },
      update: {},
      create: {
        slug: 'reviews',
        name: 'Reviews',
        description: 'Обзоры технологий и инструментов',
        color: '#f59e0b',
        sortOrder: 3,
      },
    }),
  ]);

  console.log('Created categories:', categories.map((c) => c.slug));

  // ==========================================
  // CREATE TAGS
  // ==========================================
  const tagData = [
    { slug: 'astro', name: 'Astro', color: '#FF5D01' },
    { slug: 'hono', name: 'Hono', color: '#FF6347' },
    { slug: 'typescript', name: 'TypeScript', color: '#3178C6' },
    { slug: 'prisma', name: 'Prisma', color: '#2D3748' },
    { slug: 'sqlite', name: 'SQLite', color: '#003B57' },
    { slug: 'javascript', name: 'JavaScript', color: '#F7DF1E' },
    { slug: 'css', name: 'CSS', color: '#1572B6' },
    { slug: 'nodejs', name: 'Node.js', color: '#339933' },
    { slug: 'getting-started', name: 'Getting Started', color: '#6366F1' },
    { slug: 'performance', name: 'Performance', color: '#EF4444' },
  ];

  const tags = await Promise.all(
    tagData.map((tag) =>
      prisma.tag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: tag,
      })
    )
  );

  console.log('Created tags:', tags.map((t) => t.slug));

  // ==========================================
  // CREATE POSTS
  // ==========================================
  const post1 = await prisma.post.upsert({
    where: { slug: 'welcome-to-content-platform' },
    update: {},
    create: {
      slug: 'welcome-to-content-platform',
      title: 'Добро пожаловать в Content Platform',
      excerpt: 'Начните создавать контент с помощью нашей универсальной платформы на базе Astro и Hono.',
      content: `
# Добро пожаловать!

Это ваша новая контентная платформа. Здесь вы можете:

- Писать статьи в Markdown
- Хранить данные в SQLite
- Использовать мощный API на Hono

## Начало работы

1. Создайте новый MD файл в \`src/content/blog/\`
2. Добавьте frontmatter с метаданными
3. Напишите контент

## Возможности

- **SEO оптимизация** — встроенные мета-теги и Open Graph
- **Типобезопасность** — TypeScript везде
- **Быстрый деплой** — готовность к production
      `.trim(),
      contentType: 'markdown',
      status: 'published',
      featured: true,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: categories[0].id,
    },
  });

  const post2 = await prisma.post.upsert({
    where: { slug: 'astro-content-collections-guide' },
    update: {},
    create: {
      slug: 'astro-content-collections-guide',
      title: 'Полное руководство по Content Collections в Astro',
      excerpt: 'Узнайте, как эффективно использовать Content Collections для управления контентом в Astro.',
      content: `
# Content Collections в Astro

Content Collections — мощная функция Astro для организации и типизации контента.

## Определение коллекции

\`\`\`typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
  }),
});

export const collections = { blog };
\`\`\`

## Использование

\`\`\`typescript
import { getCollection } from 'astro:content';

const posts = await getCollection('blog');
\`\`\`

## Преимущества

1. **Типобезопасность** — Zod валидация
2. **Автодополнение** — TypeScript поддержка
3. **Производительность** — оптимизация сборки
      `.trim(),
      contentType: 'markdown',
      status: 'published',
      featured: false,
      publishedAt: new Date(Date.now() - 86400000), // Yesterday
      authorId: author.id,
      categoryId: categories[0].id,
    },
  });

  const post3 = await prisma.post.upsert({
    where: { slug: 'hono-api-best-practices' },
    update: {},
    create: {
      slug: 'hono-api-best-practices',
      title: 'Best Practices для API на Hono',
      excerpt: 'Советы и рекомендации по созданию production-ready API с использованием Hono.',
      content: `
# API Best Practices с Hono

Hono — ultra-fast web framework для создания современных API.

## Структура проекта

\`\`\`
src/
├── index.ts        # Entry point
├── routes/         # API routes
├── middleware/     # Custom middleware
└── lib/            # Utilities
\`\`\`

## Валидация с Zod

\`\`\`typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

app.post('/users', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  // ...
});
\`\`\`

## Rate Limiting

\`\`\`typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
}));
\`\`\`
      `.trim(),
      contentType: 'markdown',
      status: 'published',
      featured: false,
      publishedAt: new Date(Date.now() - 172800000), // 2 days ago
      authorId: author.id,
      categoryId: categories[0].id,
    },
  });

  console.log('Created posts:', [post1.slug, post2.slug, post3.slug]);

  // ==========================================
  // LINK POSTS TO TAGS
  // ==========================================
  const tagMap = new Map(tags.map((t) => [t.slug, t.id]));

  await Promise.all([
    // Post 1 tags
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post1.id, tagId: tagMap.get('astro')! } },
      update: {},
      create: { postId: post1.id, tagId: tagMap.get('astro')! },
    }),
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post1.id, tagId: tagMap.get('hono')! } },
      update: {},
      create: { postId: post1.id, tagId: tagMap.get('hono')! },
    }),
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post1.id, tagId: tagMap.get('getting-started')! } },
      update: {},
      create: { postId: post1.id, tagId: tagMap.get('getting-started')! },
    }),
    // Post 2 tags
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post2.id, tagId: tagMap.get('astro')! } },
      update: {},
      create: { postId: post2.id, tagId: tagMap.get('astro')! },
    }),
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post2.id, tagId: tagMap.get('typescript')! } },
      update: {},
      create: { postId: post2.id, tagId: tagMap.get('typescript')! },
    }),
    // Post 3 tags
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post3.id, tagId: tagMap.get('hono')! } },
      update: {},
      create: { postId: post3.id, tagId: tagMap.get('hono')! },
    }),
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post3.id, tagId: tagMap.get('nodejs')! } },
      update: {},
      create: { postId: post3.id, tagId: tagMap.get('nodejs')! },
    }),
    prisma.postTag.upsert({
      where: { postId_tagId: { postId: post3.id, tagId: tagMap.get('typescript')! } },
      update: {},
      create: { postId: post3.id, tagId: tagMap.get('typescript')! },
    }),
  ]);

  console.log('Linked posts to tags');

  // ==========================================
  // CREATE MENU ITEMS
  // ==========================================
  await Promise.all([
    prisma.menuItem.upsert({
      where: { id: 1 },
      update: {},
      create: {
        menu: 'main',
        label: 'Главная',
        url: '/',
        sortOrder: 1,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 2 },
      update: {},
      create: {
        menu: 'main',
        label: 'Блог',
        url: '/blog',
        sortOrder: 2,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 3 },
      update: {},
      create: {
        menu: 'main',
        label: 'О проекте',
        url: '/about',
        sortOrder: 3,
      },
    }),
  ]);

  console.log('Created menu items');

  // ==========================================
  // CREATE SETTINGS
  // ==========================================
  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'site_name' },
      update: {},
      create: {
        key: 'site_name',
        value: 'Content Platform',
        type: 'string',
      },
    }),
    prisma.setting.upsert({
      where: { key: 'site_description' },
      update: {},
      create: {
        key: 'site_description',
        value: 'Универсальная контентная платформа на базе Astro и Hono',
        type: 'string',
      },
    }),
    prisma.setting.upsert({
      where: { key: 'posts_per_page' },
      update: {},
      create: {
        key: 'posts_per_page',
        value: '10',
        type: 'number',
      },
    }),
  ]);

  console.log('Created settings');

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
