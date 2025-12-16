# Результаты исследования фреймворков

**Дата:** 2025-11-29
**Статус:** Завершено ✅

---

## 📋 Цель исследования

Определить актуальные, совместимые и production-ready версии фреймворков для создания 6 стартовых заготовок:
- **Frontend:** SvelteKit, Astro, Qwik City
- **Backend:** Express.js, Hono, Fastify
- **ORM:** Prisma (SQLite + PostgreSQL)

---

## 🎯 Frontend фреймворки

### 1. SvelteKit

**Выбранный источник:** `/sveltejs/kit` (79.6 benchmark, 357 code snippets)

**Ключевые возможности:**
- ✅ TypeScript из коробки
- ✅ File-based routing
- ✅ SSR/SSG/ISR из коробки
- ✅ API routes (`+server.js`)
- ✅ Server-side data loading (`+page.server.js`)
- ✅ Адаптеры для всех платформ (Node, Vercel, Cloudflare, Netlify, etc.)
- ✅ Vite под капотом (быстрый HMR)

**Production-ready возможности:**
- Environment variables validation
- Built-in форм и data loading
- SEO-friendly (meta tags, sitemap)
- Progressive enhancement
- Code splitting автоматически

**Версии:**
- Latest: Svelte 5 + SvelteKit latest
- Node.js: 18.x+

---

### 2. Astro

**Выбранный источник:** `/withastro/docs` (92.5 benchmark, 2518 code snippets)

**Ключевые возможности:**
- ✅ TypeScript из коробки
- ✅ Server endpoints (API routes)
- ✅ SSR/SSG режимы на выбор
- ✅ UI-agnostic (можно использовать любые компоненты)
- ✅ Content collections для контента
- ✅ Zero JavaScript by default (Islands Architecture)
- ✅ Адаптеры для деплоя (Node, Vercel, Netlify, Cloudflare)

**Production-ready возможности:**
- Оптимизация изображений
- Built-in SEO support
- Content-focused (идеально для блогов, документации)
- Middleware support
- On-demand rendering

**Версии:**
- Latest: Astro 5.x
- Node.js: 18.x+

---

### 3. Qwik City

**Выбранный источник:** `/qwikdev/qwik` (82.7 benchmark, 1972 code snippets)

**Ключевые возможности:**
- ✅ TypeScript из коробки
- ✅ Directory-based routing
- ✅ Edge-first архитектура
- ✅ Resumability (вместо гидратации)
- ✅ Route loaders для data fetching
- ✅ Actions для мутаций
- ✅ Middleware support
- ✅ Адаптеры для Edge (Cloudflare, Vercel Edge, Deno, Bun, Node)

**Production-ready возможности:**
- Fastest TTI (Time To Interactive)
- Автоматический code splitting
- Server-side валидация (Zod, Valibot)
- URL rewrites для A/B тестирования
- Оптимизация для WebVitals

**Версии:**
- Latest: Qwik 1.x
- Node.js: 18.x+

---

## ⚙️ Backend фреймворки

### 1. Express.js

**Выбранный источник:** `/expressjs/express` (94.2 benchmark, 52 code snippets)

**Ключевые возможности:**
- ✅ Минималистичный и гибкий
- ✅ Огромная экосистема middleware
- ✅ TypeScript support (через @types/express)
- ✅ Middleware-based архитектура
- ✅ Зрелая база (проверено годами)
- ✅ Express 5.x - современная версия

**Production-ready middleware:**
- `helmet` - security headers
- `express-rate-limit` - rate limiting
- `cors` - CORS handling
- `compression` - gzip compression
- `morgan` - HTTP logging
- `express-validator` - input validation

**Версии:**
- Express: 5.x (latest stable)
- Node.js: 18.x+

---

### 2. Hono

**Выбранный источник:** `/honojs/hono` (89.8 benchmark, 1295 code snippets)

**Ключевые возможности:**
- ✅ Multi-runtime (Node, Bun, Deno, Cloudflare Workers, Edge)
- ✅ Web Standards (Request/Response API)
- ✅ Ultra-fast (ultrafast routing)
- ✅ First-class TypeScript support
- ✅ Built-in middleware (JWT, CORS, etc.)
- ✅ Zod integration из коробки
- ✅ Минимальные зависимости

**Production-ready возможности:**
- Built-in security middleware
- Validator middleware (Zod, TypeBox)
- HonoRequest с helper methods
- Context с typed variables
- Error handling middleware

**Версии:**
- Hono: 4.x (latest)
- Node.js: 18.x+

---

### 3. Fastify

**Выбранный источник:** `/fastify/fastify` (62.2 benchmark, 683 code snippets)

**Ключевые возможности:**
- ✅ High performance (быстрейший Node.js фреймворк)
- ✅ TypeScript-first
- ✅ Schema-based validation (JSON Schema)
- ✅ Plugin-based архитектура
- ✅ Async/await из коробки
- ✅ Lifecycle hooks
- ✅ Logging через pino (fastest logger)

**Production-ready возможности:**
- Built-in schema validation
- Encapsulation через плагины
- Automatic serialization/deserialization
- Request lifecycle hooks
- Error handling hooks
- Powerful plugin system

**Версии:**
- Fastify: 5.x (latest)
- Node.js: 20.x+ (LTS)

---

## 🗄️ Database & ORM

### Prisma ORM

**Выбранный источник:** `/prisma/prisma` (96.4 benchmark, 115 code snippets)

**Ключевые возможности:**
- ✅ Type-safe query builder
- ✅ Декларативные миграции
- ✅ Prisma Studio (GUI для БД)
- ✅ Multi-database support
- ✅ Connection pooling
- ✅ Prisma Client auto-generation

**Поддержка баз данных:**
- SQLite (для разработки)
- PostgreSQL (для production)
- MySQL, SQL Server, MongoDB, CockroachDB

**SQLite + WAL режим:**
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db?mode=rwc&journal_mode=WAL"
}
```

**PostgreSQL для production:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Connection pooling:**
- PgBouncer для PostgreSQL
- Prisma Accelerate для serverless
- Connection limit через DATABASE_URL

**Версии:**
- Prisma: 6.x (latest)
- Node.js: 18.x+

---

## 🔒 Security & DevSecOps

### 1. Helmet.js

**Security headers из коробки:**
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-Permitted-Cross-Domain-Policies

**Базовая конфигурация для production:**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

---

### 2. Rate Limiting

**express-rate-limit:**
```typescript
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  limit: 100, // 100 запросов на IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ipv6Subnet: 56
})

app.use('/api', limiter)
```

---

### 3. CORS Configuration

**Для всех backend:**
```typescript
import cors from 'cors'

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}))
```

---

### 4. Input Validation

**Zod для TypeScript:**
```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(50),
  age: z.number().int().positive().optional()
})

// В Hono
app.post('/users', zValidator('json', userSchema), async (c) => {
  const data = c.req.valid('json')
  // ...
})
```

---

### 5. Environment Variables

**Базовая структура .env:**
```env
# Server
NODE_ENV=production
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL="file:./data/db/dev.db?mode=rwc&journal_mode=WAL"
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# Security
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret

# Logging
LOG_LEVEL=info
```

---

### 6. Graceful Shutdown

**Для всех backend:**
```typescript
async function shutdown() {
  console.log('Shutting down gracefully...')
  await prisma.$disconnect()
  await server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

---

### 7. Health Checks

**Endpoint для мониторинга:**
```typescript
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message })
  }
})
```

---

## 📦 Docker Support

**docker-compose.yml структура:**
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend-sveltekit
    ports:
      - "5173:5173"
    environment:
      - API_URL=http://backend:3000
    depends_on:
      - backend

  backend:
    build: ./backend-expressjs
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/data/db/dev.db?mode=rwc&journal_mode=WAL
    volumes:
      - ./data/db:/data/db

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 🎯 Рекомендуемые версии (актуальные на 2025-01-29)

### Frontend
- **SvelteKit:** Latest (Svelte 5 + SvelteKit)
- **Astro:** 5.x
- **Qwik:** 1.x

### Backend
- **Express.js:** 5.x
- **Hono:** 4.x
- **Fastify:** 5.x

### Database & Tools
- **Prisma:** 6.x
- **Node.js:** 20.x LTS
- **TypeScript:** 5.x
- **PostgreSQL:** 16.x
- **SQLite:** 3.x (with WAL mode)

### Security & Utilities
- **Helmet:** 8.x
- **express-rate-limit:** 7.x
- **Zod:** 3.x
- **CORS:** 2.x
- **dotenv:** 16.x

---

## ✅ Выводы

1. **Все 6 фреймворков production-ready** и активно поддерживаются
2. **TypeScript из коробки** во всех решениях
3. **Prisma ORM** идеально подходит для обоих сценариев (SQLite → PostgreSQL)
4. **Модульная архитектура** позволяет комбинировать любой frontend с любым backend
5. **DevSecOps базовые меры** легко интегрируются во все фреймворки
6. **Docker support** для всех платформ

---

## 📚 Источники

- Context7 MCP Server - актуальная документация на 2025-01-29
- SvelteKit: https://kit.svelte.dev
- Astro: https://astro.build
- Qwik: https://qwik.builder.io
- Express.js: https://expressjs.com
- Hono: https://hono.dev
- Fastify: https://fastify.dev
- Prisma: https://prisma.io
