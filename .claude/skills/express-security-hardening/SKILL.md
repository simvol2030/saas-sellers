---
name: express-security-hardening
description: Production security навык для Express.js REST API. Покрывает helmet middleware, rate limiting, CORS, input validation, SQL injection защита, JWT authentication, HTTPS, error handling, audit logging, dependency scanning. OWASP Top 10 compliance для Telegram Mini App backend.
---

# Навык: Express.js Security Hardening

## Описание

Экспертный навык для защиты Express.js REST API в production с покрытием OWASP Top 10:
- Helmet middleware для security headers
- Rate limiting и DDoS защита
- CORS конфигурация для Telegram WebApp
- Input validation и sanitization (Zod, express-validator)
- SQL injection защита (Drizzle ORM, parameterized queries)
- JWT authentication best practices
- HTTPS enforcement
- Error handling без утечки информации
- Audit logging для критичных операций
- Dependency security scanning (npm audit, Snyk)

Используется для защиты backend Telegram Mini App от атак, соответствие PCI DSS и GDPR требованиям.

---

## Когда использовать

- Production deployment Express.js REST API
- Защита backend Telegram Mini App
- Compliance с OWASP Top 10
- PCI DSS требования (платёжные данные)
- GDPR compliance (персональные данные)
- Security audit preparation
- Rate limiting API endpoints
- Защита от SQL injection, XSS, CSRF
- JWT token management
- Audit logging для безопасности

---

## Основные возможности

### 1. Настроить Helmet middleware

Защитить приложение от известных web-уязвимостей через HTTP headers.

**Технологии**: helmet

**Установка**:
```bash
npm install helmet
```

**Конфигурация**:
```typescript
// src/middleware/security.ts
import helmet from 'helmet';
import { Express } from 'express';

export function setupSecurityMiddleware(app: Express) {
  // Helmet с production настройками
  app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://telegram.org"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.telegram.org"],
        frameSrc: ["https://web.telegram.org"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },

    // X-Frame-Options (защита от clickjacking)
    frameguard: {
      action: 'deny'  // Запретить iframe
    },

    // X-Content-Type-Options
    noSniff: true,

    // Strict-Transport-Security (HSTS)
    hsts: {
      maxAge: 31536000,  // 1 год
      includeSubDomains: true,
      preload: true
    },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // X-Download-Options
    ieNoOpen: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },

    // Hide X-Powered-By
    hidePoweredBy: true
  }));
}
```

**Best Practices**:
- Всегда используйте HSTS с `preload: true`
- Настройте CSP под ваш Telegram bot
- Скройте `X-Powered-By` header
- Используйте `frameguard: deny` если не нужны iframes

---

### 2. Настроить rate limiting

Защита от DDoS и брутфорса с разными лимитами для разных endpoints.

**Технологии**: express-rate-limit, rate-limit-redis

**Установка**:
```bash
npm install express-rate-limit rate-limit-redis ioredis
```

**Конфигурация**:
```typescript
// src/middleware/rateLimiting.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

// General API rate limit (100 req/15min)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  store: new RedisStore({
    client: redis,
    prefix: 'rl:general:'
  })
});

// Auth endpoints (5 req/15min - строгий лимит)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,  // Не считаем успешные логины
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:'
  })
});

// POS endpoints (500 req/15min - высокая нагрузка)
export const posLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'POS rate limit exceeded',
  keyGenerator: (req) => {
    // Используем cashier ID вместо IP для POS
    return req.headers['x-cashier-id'] as string || req.ip;
  },
  store: new RedisStore({
    client: redis,
    prefix: 'rl:pos:'
  })
});

// Payment endpoints (10 req/hour - критичные операции)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many payment requests',
  store: new RedisStore({
    client: redis,
    prefix: 'rl:payment:'
  })
});
```

**Использование**:
```typescript
// src/index.ts
import { generalLimiter, authLimiter, posLimiter, paymentLimiter } from './middleware/rateLimiting';

// Global rate limit
app.use('/api', generalLimiter);

// Auth endpoints
app.use('/api/auth', authLimiter);

// POS endpoints
app.use('/api/pos', posLimiter);

// Payment endpoints
app.use('/api/payments', paymentLimiter);
```

**Best Practices**:
- Используйте Redis store для distributed rate limiting
- Разные лимиты для разных endpoints (auth < general < pos)
- `skipSuccessfulRequests: true` для auth (не наказываем успешные логины)
- Используйте `keyGenerator` для custom идентификаторов (cashier ID)
- Логируйте превышения лимитов для анализа

---

### 3. Настроить CORS

Правильная конфигурация CORS для Telegram WebApp.

**Технологии**: cors

**Установка**:
```bash
npm install cors
npm install -D @types/cors
```

**Конфигурация**:
```typescript
// src/middleware/cors.ts
import cors from 'cors';

// Whitelist доменов
const allowedOrigins = [
  'https://web.telegram.org',
  process.env.FRONTEND_URL || 'https://yourdomain.com'
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://localhost:3000');
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Cashier-Id',
    'X-Store-Id'
  ],

  // Exposed headers
  exposedHeaders: [
    'X-Total-Count',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  ],

  // Preflight cache
  maxAge: 86400  // 24 hours
};
```

**Использование**:
```typescript
import cors from 'cors';
import { corsOptions } from './middleware/cors';

app.use(cors(corsOptions));
```

**Best Practices**:
- Всегда используйте whitelist origins (не `'*'`)
- Включайте `credentials: true` для JWT cookies
- Ограничивайте `allowedHeaders` только необходимыми
- Кэшируйте preflight с `maxAge`
- Разные настройки для dev/production

---

### 4. Настроить input validation

Валидация входных данных для защиты от инъекций и bad data.

**Технологии**: Zod

**Установка**:
```bash
npm install zod
```

**Schemas**:
```typescript
// src/validation/schemas.ts
import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  telegramInitData: z.string().min(1),
  telegramUserId: z.number().int().positive()
});

// Customer schemas
export const createCustomerSchema = z.object({
  telegramId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),  // E.164 format
  email: z.string().email().optional()
});

// Transaction schemas
export const createTransactionSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(1000000),  // Макс 1M
  pointsToRedeem: z.number().int().min(0).default(0),
  paymentType: z.enum(['cash', 'card', 'points']),
  storeId: z.string().uuid(),
  cashierId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })).min(1).max(100)  // От 1 до 100 товаров
});

// QR code schemas
export const validateQRSchema = z.object({
  qrData: z.string().min(1).max(1000),
  maxAge: z.number().int().positive().default(300)
});
```

**Middleware**:
```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }

      next(error);
    }
  };
};
```

**Использование**:
```typescript
import { validate } from './middleware/validation';
import { createTransactionSchema } from './validation/schemas';

app.post('/api/transactions',
  validate(createTransactionSchema),
  async (req, res) => {
    // req.body уже провалидирован и типизирован
    const { customerId, amount, items } = req.body;
    // ...
  }
);
```

**Best Practices**:
- Валидируйте ВСЕ входные данные (body, query, params)
- Используйте `.max()` для предотвращения overflow
- Санитизируйте строки (trim, lowercase для email)
- Валидируйте форматы (email, phone, UUID)
- Возвращайте понятные ошибки валидации

---

### 5. Защититься от SQL injection

Используйте Drizzle ORM с parameterized queries.

**Технологии**: Drizzle ORM

**Безопасные паттерны**:
```typescript
// ✅ БЕЗОПАСНО - Parameterized queries
const customer = await db
  .select()
  .from(customers)
  .where(eq(customers.id, customerId))  // Параметризованный запрос
  .then(rows => rows[0]);

// ✅ БЕЗОПАСНО - Transactions
await db.transaction(async (tx) => {
  await tx
    .update(users)
    .set({ balance: sql`${users.balance} - ${points}` })  // SQL template literal
    .where(eq(users.id, userId));
});

// ❌ ОПАСНО - НЕ ДЕЛАЙТЕ ТАК!
// const unsafeQuery = `SELECT * FROM users WHERE id = ${userId}`;
// await db.execute(unsafeQuery);  // SQL injection!
```

**Raw SQL (когда нужен)**:
```typescript
// Если нужен raw SQL, используйте параметры
const result = await db.execute(
  sql`SELECT * FROM users WHERE email = ${email}`  // Безопасно с параметрами
);

// ❌ ОПАСНО:
// const unsafe = sql.raw(`SELECT * FROM users WHERE email = '${email}'`);
```

**Best Practices**:
- Всегда используйте ORM methods или parameterized queries
- НЕ используйте string concatenation для SQL
- НЕ используйте `sql.raw()` с пользовательским вводом
- Используйте prepared statements для повторяющихся запросов
- Логируйте все SQL queries в dev для проверки

---

### 6. Настроить JWT authentication

Безопасное управление JWT tokens для API.

**Технологии**: jsonwebtoken

**Конфигурация**:
```typescript
// src/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '24h';
const JWT_REFRESH_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  telegramId: number;
  role: 'customer' | 'cashier' | 'manager' | 'admin';
  storeId?: string;
}

// Generate access token
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'loyalty-app',
    audience: 'api'
  });
}

// Generate refresh token
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'loyalty-app',
      audience: 'refresh'
    }
  );
}

// Verify token
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'loyalty-app',
    audience: 'api'
  }) as JWTPayload;
}

// Verify refresh token
export function verifyRefreshToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET, {
    issuer: 'loyalty-app',
    audience: 'refresh'
  }) as any;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  return { userId: payload.userId };
}
```

**Auth middleware**:
```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../auth/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(error);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};
```

**Использование**:
```typescript
import { requireAuth, requireRole } from './middleware/auth';

// Protected route (любой авторизованный пользователь)
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Admin only
app.get('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  // Только admin
});

// Cashier or Manager
app.post('/api/pos/transactions', requireAuth, requireRole('cashier', 'manager'), (req, res) => {
  // Только cashier или manager
});
```

**Best Practices**:
- Используйте сильный `JWT_SECRET` (min 256 bits)
- Короткий TTL для access tokens (1-24 часа)
- Refresh tokens для продления сессии
- Храните refresh tokens в httpOnly cookies
- Проверяйте `iss` и `aud` claims
- НЕ храните чувствительные данные в JWT payload

---

### 7. Настроить HTTPS enforcement

Принудительное использование HTTPS в production.

**Middleware**:
```typescript
// src/middleware/https.ts
import { Request, Response, NextFunction } from 'express';

export const requireHTTPS = (req: Request, res: Response, next: NextFunction) => {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect to HTTPS
  res.redirect(301, `https://${req.headers.host}${req.url}`);
};
```

**Использование**:
```typescript
// Применяется ПЕРЕД всеми routes
app.use(requireHTTPS);
```

**Best Practices**:
- Всегда используйте HTTPS в production (требование Telegram)
- Проверяйте `x-forwarded-proto` для reverse proxy (nginx)
- Используйте 301 redirect (permanent)
- Комбинируйте с HSTS header

---

### 8. Настроить error handling

Безопасная обработка ошибок без утечки информации.

**Error handler**:
```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Логируем полную ошибку
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  }, 'Request error');

  // В production НЕ возвращаем stack trace
  const isDev = process.env.NODE_ENV === 'development';

  // Generic error response
  const response: any = {
    error: err.message || 'Internal server error'
  };

  // Stack trace только в dev
  if (isDev) {
    response.stack = err.stack;
  }

  // HTTP status из ошибки или 500
  const status = (err as any).status || (err as any).statusCode || 500;

  res.status(status).json(response);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.url
  });
};
```

**Использование**:
```typescript
// src/index.ts

// Routes
app.use('/api', apiRoutes);

// 404 handler (ПОСЛЕ всех routes)
app.use(notFoundHandler);

// Error handler (САМЫЙ ПОСЛЕДНИЙ)
app.use(errorHandler);
```

**Best Practices**:
- НЕ возвращайте stack traces в production
- Логируйте полные ошибки для debugging
- Используйте generic error messages для клиента
- Разные error handlers для разных типов ошибок
- Возвращайте правильные HTTP status codes

---

### 9. Настроить audit logging

Логирование критичных операций для безопасности.

**Технологии**: pino, pino-pretty

**Logger setup**:
```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.cardNumber',
      'req.body.cvv'
    ],
    censor: '***REDACTED***'
  }
});
```

**Audit logging**:
```typescript
// src/middleware/auditLog.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../db';
import { auditLogs } from '../db/schema';

export const auditLog = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture response
    const oldSend = res.send;
    let responseBody: any;

    res.send = function(data) {
      responseBody = data;
      return oldSend.apply(res, arguments as any);
    } as any;

    // Продолжаем request
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      // Логируем в БД (асинхронно)
      try {
        await db.insert(auditLogs).values({
          userId: req.user?.userId,
          action,
          method: req.method,
          path: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          requestBody: JSON.stringify(req.body),
          responseStatus: res.statusCode,
          createdAt: new Date()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to write audit log');
      }

      // Логируем в файл
      logger.info({
        action,
        userId: req.user?.userId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      }, 'Audit log');
    });

    next();
  };
};
```

**Использование**:
```typescript
// Критичные операции
app.post('/api/auth/login',
  auditLog('auth:login'),
  loginHandler
);

app.post('/api/transactions',
  requireAuth,
  auditLog('transaction:create'),
  createTransactionHandler
);

app.delete('/api/customers/:id',
  requireAuth,
  requireRole('admin'),
  auditLog('customer:delete'),
  deleteCustomerHandler
);
```

**Best Practices**:
- Логируйте ВСЕ критичные операции (auth, payments, delete)
- Сохраняйте audit logs в отдельную таблицу БД
- Редактируйте чувствительные данные (пароли, карты)
- Логируйте duration для performance анализа
- Храните audit logs минимум 90 дней (compliance)

---

## Security Checklist

### OWASP Top 10 Compliance

- [ ] A01: Broken Access Control → JWT + RBAC (capability #6)
- [ ] A02: Cryptographic Failures → HTTPS + helmet (capability #1, #7)
- [ ] A03: Injection → Input validation + ORM (capability #4, #5)
- [ ] A04: Insecure Design → Rate limiting + audit logs (capability #2, #9)
- [ ] A05: Security Misconfiguration → Helmet + CORS (capability #1, #3)
- [ ] A06: Vulnerable Components → npm audit (scripts/audit.sh)
- [ ] A07: Identification Failures → JWT best practices (capability #6)
- [ ] A08: Data Integrity Failures → Input validation (capability #4)
- [ ] A09: Logging Failures → Audit logging (capability #9)
- [ ] A10: SSRF → Input validation + whitelist (capability #4)

### Production Checklist

- [ ] Helmet middleware настроен
- [ ] Rate limiting включен
- [ ] CORS whitelist настроен
- [ ] Input validation на всех endpoints
- [ ] SQL injection защита (ORM)
- [ ] JWT authentication работает
- [ ] HTTPS enforcement включен
- [ ] Error handling не показывает stack traces
- [ ] Audit logging настроен
- [ ] npm audit 0 vulnerabilities
- [ ] Environment variables защищены
- [ ] Secrets не в git

---

**Версия навыка**: 1.0.0
**Последнее обновление**: 2025-10-24
