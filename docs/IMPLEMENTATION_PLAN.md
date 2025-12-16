# 🚀 План реализации стартовых заготовок

**Дата создания:** 2025-11-29
**Статус:** Ожидает согласования

---

## 📋 Обзор проекта

Создать **6 production-ready стартовых заготовок** для быстрого развертывания веб-приложений:

### Frontend (3 заготовки)
1. `frontend-sveltekit/`
2. `frontend-astro/`
3. `frontend-qwik-city/`

### Backend (3 заготовки)
4. `backend-expressjs/`
5. `backend-hono/`
6. `backend-fastify/`

### Общие ресурсы
- `/data/db/` - директория для баз данных
- `/docs/` - документация по каждому фреймворку

---

## 🎯 Принципы разработки

✅ **Модульность** - любой frontend + любой backend
✅ **Разумная достаточность** - не over/under-engineering
✅ **Production-ready** - готово к деплою сразу
✅ **TypeScript везде** - type-safety из коробки
✅ **DevSecOps базовый** - security headers, rate limiting, validation
✅ **Docker опционально** - можно запускать с/без Docker

---

## 📐 Общая архитектура

```
project-box-combo/
├── frontend-sveltekit/
├── frontend-astro/
├── frontend-qwik-city/
├── backend-expressjs/
├── backend-hono/
├── backend-fastify/
├── data/
│   └── db/
│       ├── dev.db (SQLite + WAL)
│       └── .gitkeep
├── docs/
│   ├── RESEARCH_RESULTS.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── frontend-sveltekit.md
│   ├── frontend-astro.md
│   ├── frontend-qwik-city.md
│   ├── backend-expressjs.md
│   ├── backend-hono.md
│   └── backend-fastify.md
├── docker-compose.yml
└── README.md
```

---

## 🔄 Стандартизированный API Contract

Все backend'ы реализуют **единый REST API:**

### Endpoints

```
GET    /health              - Health check
GET    /api/users           - Список пользователей
GET    /api/users/:id       - Получить пользователя
POST   /api/users           - Создать пользователя
PUT    /api/users/:id       - Обновить пользователя
DELETE /api/users/:id       - Удалить пользователя

GET    /api/posts           - Список постов
GET    /api/posts/:id       - Получить пост
POST   /api/posts           - Создать пост
PUT    /api/posts/:id       - Обновить пост
DELETE /api/posts/:id       - Удалить пост
```

### Общая структура ответов

**Success:**
```json
{
  "data": { ... },
  "timestamp": "2025-01-29T12:00:00.000Z"
}
```

**Error:**
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400
  },
  "timestamp": "2025-01-29T12:00:00.000Z"
}
```

---

## 📊 Общая Prisma Schema

Все backend используют одну схему БД:

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  // provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 🛠️ Этапы реализации

### Этап 0: Подготовка инфраструктуры (30 мин)

- [ ] Создать структуру директорий
- [ ] Настроить `/data/db/` для SQLite
- [ ] Создать базовую Prisma схему
- [ ] Создать `.env.example` templates
- [ ] Создать `docker-compose.yml`

---

### Этап 1: Frontend - SvelteKit (2-3 часа)

**1.1. Инициализация**
```bash
npm create svelte@latest frontend-sveltekit
cd frontend-sveltekit
npm install
```

**1.2. Конфигурация TypeScript**
- `tsconfig.json` настройка
- Strict mode enabled
- Path aliases (`$lib/*`)

**1.3. Структура проекта**
```
frontend-sveltekit/
├── src/
│   ├── lib/
│   │   ├── api/           # API client
│   │   ├── components/    # Переиспользуемые компоненты
│   │   ├── stores/        # Svelte stores
│   │   └── types/         # TypeScript types
│   ├── routes/
│   │   ├── +page.svelte          # Home
│   │   ├── +page.server.ts       # Data loading
│   │   ├── api/
│   │   │   └── proxy/+server.ts  # API proxy
│   │   └── users/
│   │       ├── +page.svelte
│   │       └── +page.server.ts
│   └── app.html
├── static/
├── .env.example
├── Dockerfile
└── README.md
```

**1.4. API Client**
```typescript
// src/lib/api/client.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  return response.json()
}
```

**1.5. Environment Variables**
```env
VITE_API_URL=http://localhost:3000
```

**1.6. Проверка**
- [ ] `npm run dev` - запуск dev сервера
- [ ] `npm run build` - production build
- [ ] `npm run preview` - проверка build
- [ ] Проверка в браузере (localhost:5173)

---

### Этап 2: Frontend - Astro (2-3 часа)

**2.1. Инициализация**
```bash
npm create astro@latest frontend-astro
cd frontend-astro
npm install
```

**2.2. Конфигурация**
```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server', // или 'static' для SSG
  adapter: node({
    mode: 'standalone'
  })
})
```

**2.3. Структура проекта**
```
frontend-astro/
├── src/
│   ├── components/     # Astro/React/Vue компоненты
│   ├── layouts/        # Layouts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── users.astro
│   │   └── api/        # API routes
│   ├── lib/
│   │   ├── api.ts      # API client
│   │   └── types.ts
│   └── env.d.ts
├── public/
├── .env.example
├── Dockerfile
└── README.md
```

**2.4. API Client аналогично SvelteKit**

**2.5. Проверка**
- [ ] `npm run dev`
- [ ] `npm run build`
- [ ] Проверка в браузере

---

### Этап 3: Frontend - Qwik City (2-3 часа)

**3.1. Инициализация**
```bash
npm create qwik@latest frontend-qwik-city
cd frontend-qwik-city
npm install
```

**3.2. Структура проекта**
```
frontend-qwik-city/
├── src/
│   ├── components/
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── layout.tsx
│   │   └── users/
│   │       └── index.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── entry.ssr.tsx
├── public/
├── .env.example
├── Dockerfile
└── README.md
```

**3.3. Route Loaders**
```typescript
// src/routes/users/index.tsx
import { routeLoader$ } from '@builder.io/qwik-city'

export const useUsers = routeLoader$(async () => {
  const response = await fetch(`${API_URL}/api/users`)
  return response.json()
})
```

**3.4. Проверка**
- [ ] `npm run dev`
- [ ] `npm run build`
- [ ] Проверка в браузере

---

### Этап 4: Backend - Express.js (3-4 часа)

**4.1. Инициализация**
```bash
mkdir backend-expressjs && cd backend-expressjs
npm init -y
npm install express prisma @prisma/client
npm install -D typescript @types/node @types/express tsx nodemon
npm install helmet cors express-rate-limit zod dotenv
```

**4.2. Структура проекта**
```
backend-expressjs/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app
│   ├── config/
│   │   ├── database.ts       # Prisma client
│   │   └── env.ts            # Environment validation
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── logger.ts
│   │   └── validation.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── users.ts
│   │   └── posts.ts
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   └── posts.controller.ts
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── tsconfig.json
├── Dockerfile
└── README.md
```

**4.3. Express App Setup**
```typescript
// src/app.ts
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler'
import healthRouter from './routes/health'
import usersRouter from './routes/users'
import postsRouter from './routes/posts'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100
})
app.use('/api', limiter)

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/health', healthRouter)
app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)

// Error handling
app.use(errorHandler)

export default app
```

**4.4. Prisma Setup**
```bash
npx prisma init --datasource-provider sqlite
npx prisma migrate dev --name init
npx prisma generate
```

**4.5. Environment Variables**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL="file:../data/db/dev.db?mode=rwc&journal_mode=WAL"
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4321
LOG_LEVEL=info
```

**4.6. Проверка**
- [ ] `npm run dev` - запуск dev сервера
- [ ] `curl http://localhost:3000/health` - проверка health
- [ ] `curl http://localhost:3000/api/users` - проверка API
- [ ] Проверка с frontend

---

### Этап 5: Backend - Hono (2-3 часа)

**5.1. Инициализация**
```bash
mkdir backend-hono && cd backend-hono
npm init -y
npm install hono @hono/node-server @hono/zod-validator prisma @prisma/client
npm install -D typescript tsx nodemon
npm install zod dotenv
```

**5.2. Структура проекта**
```
backend-hono/
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   │   ├── health.ts
│   │   ├── users.ts
│   │   └── posts.ts
│   └── types/
├── prisma/
├── .env.example
└── README.md
```

**5.3. Hono App Setup**
```typescript
// src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import healthRoutes from './routes/health'
import usersRoutes from './routes/users'
import postsRoutes from './routes/posts'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}))

// Routes
app.route('/health', healthRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/posts', postsRoutes)

export default app
```

**5.4. Та же Prisma схема**

**5.5. Проверка аналогично Express**

---

### Этап 6: Backend - Fastify (2-3 часа)

**6.1. Инициализация**
```bash
mkdir backend-fastify && cd backend-fastify
npm init -y
npm install fastify @fastify/cors @fastify/helmet @fastify/rate-limit
npm install prisma @prisma/client
npm install -D typescript @types/node tsx nodemon
npm install zod dotenv
```

**6.2. Структура проекта аналогична Express**

**6.3. Fastify App Setup**
```typescript
// src/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import healthRoutes from './routes/health'
import usersRoutes from './routes/users'
import postsRoutes from './routes/posts'

const app = Fastify({
  logger: true
})

// Security
await app.register(helmet)
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
})

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes'
})

// Routes
await app.register(healthRoutes, { prefix: '/health' })
await app.register(usersRoutes, { prefix: '/api/users' })
await app.register(postsRoutes, { prefix: '/api/posts' })

export default app
```

**6.4. Проверка аналогично Express**

---

### Этап 7: Docker & Deployment (2 часа)

**7.1. Docker Compose**
```yaml
version: '3.8'

services:
  # Frontend examples
  frontend-sveltekit:
    build: ./frontend-sveltekit
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://backend-expressjs:3000
    depends_on:
      - backend-expressjs

  # Backend examples
  backend-expressjs:
    build: ./backend-expressjs
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/data/db/dev.db?mode=rwc&journal_mode=WAL
    volumes:
      - ./data/db:/data/db

  # PostgreSQL (опционально)
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

**7.2. Dockerfile для каждого сервиса**

---

### Этап 8: Документация (2 часа)

Создать детальную документацию для каждого фреймворка:

**8.1. docs/frontend-sveltekit.md**
- Быстрый старт
- Структура проекта
- API интеграция
- Deployment
- Best practices

**8.2. docs/backend-expressjs.md**
- Быстрый старт
- Архитектура
- API endpoints
- Prisma setup
- Security
- Deployment

**... аналогично для всех 6 фреймворков**

---

### Этап 9: Финальная проверка (2-3 часа)

**9.1. Проверка каждой комбинации**
- [ ] SvelteKit + Express.js
- [ ] SvelteKit + Hono
- [ ] SvelteKit + Fastify
- [ ] Astro + Express.js
- [ ] Astro + Hono
- [ ] Astro + Fastify
- [ ] Qwik + Express.js
- [ ] Qwik + Hono
- [ ] Qwik + Fastify

**9.2. Тестирование**
- Запуск в dev режиме
- Production build
- Docker build и запуск
- Проверка в браузере
- API тестирование (Postman/Thunder Client)

**9.3. Security Audit**
- [ ] Helmet headers присутствуют
- [ ] Rate limiting работает
- [ ] CORS настроен
- [ ] Input validation работает
- [ ] Нет exposed secrets в коде

**9.4. Performance Check**
- [ ] Bundle size оптимизирован
- [ ] Lighthouse score > 90
- [ ] API response time < 100ms

---

## ⏱️ Оценка времени

| Этап | Описание | Время |
|------|----------|-------|
| 0 | Подготовка | 30 мин |
| 1 | Frontend - SvelteKit | 2-3 ч |
| 2 | Frontend - Astro | 2-3 ч |
| 3 | Frontend - Qwik | 2-3 ч |
| 4 | Backend - Express.js | 3-4 ч |
| 5 | Backend - Hono | 2-3 ч |
| 6 | Backend - Fastify | 2-3 ч |
| 7 | Docker & Deployment | 2 ч |
| 8 | Документация | 2 ч |
| 9 | Финальная проверка | 2-3 ч |
| **ИТОГО** | | **~20-25 часов** |

---

## 📝 Чеклист готовности

### Общие требования
- [ ] TypeScript во всех проектах
- [ ] `.env.example` в каждой директории
- [ ] README.md с инструкциями
- [ ] Dockerfile (опционально)
- [ ] .gitignore настроен

### Frontend
- [ ] Dev сервер запускается
- [ ] Production build работает
- [ ] API клиент работает
- [ ] Environment variables настроены

### Backend
- [ ] Health endpoint работает
- [ ] CRUD endpoints работают
- [ ] Prisma миграции применены
- [ ] Security middleware настроены
- [ ] Error handling работает
- [ ] Graceful shutdown работает

### Database
- [ ] Prisma schema создана
- [ ] SQLite + WAL настроен
- [ ] PostgreSQL connection строка в .env.example
- [ ] Миграции работают

### DevSecOps
- [ ] Helmet настроен
- [ ] Rate limiting работает
- [ ] CORS настроен
- [ ] Input validation (Zod) работает
- [ ] Logging настроен

### Docker
- [ ] docker-compose.yml работает
- [ ] Все сервисы поднимаются
- [ ] Volumes настроены

### Документация
- [ ] RESEARCH_RESULTS.md создан
- [ ] IMPLEMENTATION_PLAN.md создан
- [ ] Документация по каждому фреймворку
- [ ] README.md в корне проекта

---

## 🚦 Следующие шаги

1. **Согласование плана** - получить подтверждение от владельца проекта
2. **Начать реализацию** - последовательно пройти этапы 0-9
3. **Тестирование** - проверить все комбинации
4. **Документация** - создать полную документацию
5. **Release** - опубликовать готовые заготовки

---

## ❓ Вопросы для согласования

1. Подходит ли выбор фреймворков?
2. Достаточно ли базовых DevSecOps мер?
3. Нужна ли дополнительная функциональность?
4. Подходит ли оценка времени?
5. Начинаем реализацию?
