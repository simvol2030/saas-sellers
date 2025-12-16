# Hono Backend Starter Box

Production-ready Hono REST API starter with Prisma ORM, Zod validation, security middleware, and Web Standards API.

## Tech Stack

- **Framework**: Hono 4.x (Web Standards API)
- **ORM**: Prisma (SQLite/PostgreSQL)
- **Validation**: Zod + @hono/zod-validator
- **Security**: Secure Headers, CORS, Rate Limiting
- **Logging**: Built-in logger middleware
- **Runtime**: Node.js with TypeScript (compatible with Cloudflare Workers, Deno, Bun)

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Project Structure

```
src/
├── routes/
│   └── users.ts          # User CRUD endpoints
├── middleware/
│   └── errorHandler.ts   # Global error handler
└── index.ts              # App entry point
```

## Available Endpoints

### Health Check
- `GET /health` - Database connection status

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user

## How to Extend

### 1. Add a New Resource

**Step 1**: Create route file `src/routes/products.ts`:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../index';

const products = new Hono();

// Validation schema
const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive()
});

// GET /api/products
products.get('/', async (c) => {
  try {
    const allProducts = await prisma.product.findMany();
    return c.json(allProducts);
  } catch (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// POST /api/products
products.post('/', zValidator('json', createProductSchema), async (c) => {
  try {
    const validated = c.req.valid('json');
    const product = await prisma.product.create({
      data: validated
    });
    return c.json(product, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

export default products;
```

**Step 2**: Register route in `src/index.ts`:

```typescript
import products from './routes/products';
// ...
app.route('/api/products', products);
```

**Step 3**: Add model to `../prisma/schema.prisma`:

```prisma
model Product {
  id        Int      @id @default(autoincrement())
  name      String
  price     Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("products")
}
```

**Step 4**: Run migration:

```bash
npm run prisma:migrate
```

### 2. Add Custom Middleware

Create `src/middleware/auth.ts`:

```typescript
import { Context, Next } from 'hono';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Verify token logic here
  await next();
};
```

Use in routes:

```typescript
import { authMiddleware } from '../middleware/auth';
products.post('/', authMiddleware, zValidator('json', schema), async (c) => {
  // Protected route
});
```

### 3. Environment Variables

Create `.env` file (see `.env.example`):

```env
DATABASE_URL="file:../data/db/app.db"
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
```

## Security Features

- **Secure Headers**: XSS, CSRF, and other security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes
- **Input Validation**: Zod schemas with automatic error responses
- **Error Handling**: Custom error handler middleware

## Database

Switch to PostgreSQL:

1. Update `../prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Update `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

3. Run migration:
```bash
npm run prisma:migrate
```

## Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# List users
curl http://localhost:3001/api/users

# Create user
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
```

## Production Deployment

```bash
npm run build
NODE_ENV=production npm start
```

### Deploy to Cloudflare Workers

Hono is edge-ready! Deploy to Cloudflare Workers:

1. Install Wrangler:
```bash
npm install -g wrangler
```

2. Create `wrangler.toml`:
```toml
name = "hono-api"
main = "src/index.ts"
compatibility_date = "2023-12-01"

[vars]
DATABASE_URL = "..."
```

3. Deploy:
```bash
wrangler publish
```

## Common Patterns

### Pagination
```typescript
products.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const skip = (page - 1) * limit;

  const products = await prisma.product.findMany({
    skip,
    take: limit
  });
  return c.json(products);
});
```

### Nested Routes
```typescript
const api = new Hono();
api.route('/users', users);
api.route('/products', products);

app.route('/api', api);
// Creates: /api/users, /api/products
```

### Context Variables
```typescript
// Set variable
app.use('*', async (c, next) => {
  c.set('userId', 123);
  await next();
});

// Get variable
products.get('/', async (c) => {
  const userId = c.get('userId');
  // Use userId
});
```

### File Uploads
```typescript
products.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] as File;
  // Process file
});
```

## Why Hono?

- **Fast**: Optimized router, minimal overhead
- **Lightweight**: ~12KB core, tree-shakeable
- **Standards**: Web Standards API (Request/Response)
- **Multi-runtime**: Node.js, Cloudflare Workers, Deno, Bun
- **Type-safe**: Full TypeScript support
- **Middleware**: Rich ecosystem

## License

MIT
