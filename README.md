# 🚀 Project Box - Hono + Astro Starter Kit

**Production-ready starter kit** for rapid deployment of modern web applications using Hono and Astro.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Hono](https://img.shields.io/badge/Hono-4.x-FF6347.svg)](https://hono.dev/)
[![Astro](https://img.shields.io/badge/Astro-5.x-FF5D01.svg)](https://astro.build/)

---

## 📦 What's Inside

### Frontend
- **Astro 5.x** - Islands Architecture, Multi-framework support, SSR/SSG, Content Collections

### Backend
- **Hono 4.x** - Ultra-fast, Multi-runtime (Node.js, Bun, Deno, Workers), Web Standards API

### Shared Features
- **TypeScript** everywhere
- **Prisma ORM** - SQLite (dev) → PostgreSQL (prod)
- **Modular Architecture** - Decoupled frontend and backend
- **DevSecOps** - Security headers, rate limiting, CORS, validation
- **Docker Ready** - Full docker-compose setup with hot-reload
- **Production-Ready** - Ready to deploy

---

## 🎯 Architecture

### Modular Design

Frontend and backend are completely decoupled and communicate via REST API:

```
frontend-astro  ──→  backend-hono  ──→  Prisma  ──→  SQLite/PostgreSQL
   (Port 4321)       (Port 3001)
```

**Key Benefits:**
- Independent deployment
- Technology flexibility
- Easy scaling
- Clear separation of concerns

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repo-url>
cd project-box-combo-2
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env as needed
```

### 3. Choose Your Setup

**Option A: Without Docker (Recommended for Development)**

```bash
# Terminal 1 - Backend (Hono)
cd backend-hono
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Terminal 2 - Frontend (Astro)
cd frontend-astro
npm install
npm run dev
```

Open http://localhost:4321

**Option B: With Docker**

```bash
# Start both services
docker-compose --profile frontend --profile backend up

# Or run in background
docker-compose --profile frontend --profile backend up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 📁 Project Structure

```
project-box-combo-2/
├── frontend-astro/         # Astro frontend application
│   ├── src/
│   │   ├── pages/         # Route pages
│   │   ├── components/    # Reusable components
│   │   └── layouts/       # Page layouts
│   ├── public/            # Static assets
│   └── package.json
│
├── backend-hono/          # Hono backend API
│   ├── src/
│   │   ├── index.ts      # Entry point
│   │   ├── routes/       # API routes
│   │   └── middleware/   # Custom middleware
│   ├── Dockerfile
│   └── package.json
│
├── data/
│   └── db/               # SQLite databases (git-ignored)
│
├── prisma/
│   └── schema.prisma     # Shared Prisma schema
│
├── docs/                 # Framework documentation
├── docker-compose.yml    # Docker orchestration
├── .env.example         # Environment variables template
└── README.md
```

---

## 🗄️ Database

### SQLite (Default for Development)

```env
DATABASE_URL="file:./data/db/dev.db?mode=rwc&journal_mode=WAL"
```

- No external dependencies
- WAL mode for better performance
- Perfect for development and testing
- File-based, portable

### PostgreSQL (For Production)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Run migrations:

```bash
npx prisma migrate dev
```

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (GUI)
npx prisma studio

# Reset database
npx prisma migrate reset
```

---

## 🔒 Security

Built-in security features in Hono backend:

- **Helmet-like Headers** - CSP, HSTS, X-Frame-Options, etc.
- **Rate Limiting** - DDoS and brute-force protection
- **CORS** - Configurable CORS policies
- **Input Validation** - Zod schema validation
- **Error Handling** - Secure error responses
- **Graceful Shutdown** - Proper cleanup on exit

---

## 📊 API Endpoints

REST API implemented in Hono backend:

```
GET    /health              - Health check
GET    /api/users           - List users
GET    /api/users/:id       - Get user by ID
POST   /api/users           - Create user
PUT    /api/users/:id       - Update user
DELETE /api/users/:id       - Delete user
GET    /api/posts           - List posts
GET    /api/posts/:id       - Get post by ID
POST   /api/posts           - Create post
PUT    /api/posts/:id       - Update post
DELETE /api/posts/:id       - Delete post
```

---

## 🛠️ Technology Stack

### Frontend
- **Astro** - 5.x
- **TypeScript** - 5.x
- **Vite** - Latest

### Backend
- **Hono** - 4.x
- **Node.js** - 20.x LTS
- **TypeScript** - 5.x

### Database & ORM
- **Prisma** - 6.x
- **SQLite** - 3.x (development)
- **PostgreSQL** - 16.x (production)

### DevSecOps
- **Zod** - 3.x (validation)
- **CORS** - Built-in
- **Docker** - Containerization

---

## 📚 Documentation

Detailed framework documentation:

- [Astro Guide](./docs/frontend-astro.md)
- [Hono Guide](./docs/backend-hono.md)

---

## 🎯 Use Cases

Perfect for:

- **Content Sites** - Blogs, news portals, documentation
- **E-commerce** - Online stores, marketplaces
- **Aggregators** - Data aggregation platforms
- **Telegram Mini Apps** - Web apps inside Telegram
- **SaaS** - Small to medium SaaS products
- **Portfolios** - Personal websites, landing pages

---

## 🐳 Docker Commands

### Development

```bash
# Start backend only
docker-compose --profile backend up

# Start frontend only
docker-compose --profile frontend up

# Start both
docker-compose --profile frontend --profile backend up

# With PostgreSQL
docker-compose --profile frontend --profile backend --profile database up

# Background mode
docker-compose --profile frontend --profile backend up -d

# View logs
docker-compose logs -f

# Rebuild containers
docker-compose up --build

# Stop all
docker-compose down

# Remove volumes
docker-compose down -v
```

---

## 🔧 Development

### Requirements

- Node.js 20.x+
- npm/pnpm/yarn
- Docker (optional)

### Local Development (No Docker)

Each framework is a separate project:

```bash
# Backend
cd backend-hono
npm install
npm run dev

# Frontend
cd frontend-astro
npm install
npm run dev
```

### Hot Reload

Both frontend and backend support hot-reload in development:
- **Astro** - Instant HMR for components
- **Hono** - Auto-restart on file changes (with nodemon/tsx)

---

## 🚀 Deployment

### Deployment Targets

**Astro Frontend:**
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Any static hosting

**Hono Backend:**
- Cloudflare Workers
- Vercel Edge Functions
- Deno Deploy
- Fly.io
- Railway
- Render
- VPS (with PM2/systemd)

### Production Build

```bash
# Frontend
cd frontend-astro
npm run build
npm run preview  # Test production build locally

# Backend
cd backend-hono
npm run build
npm start
```

### Environment Variables

Production environment variables:

```env
# Backend
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=https://yourdomain.com

# Frontend
PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage
```

---

## 📝 License

MIT

---

## 🤝 Contributing

Contributions welcome! Please create issues and pull requests.

---

## 📧 Contact

Questions? Create an issue in the repository.

---

**Built with ❤️ for rapid project development**
