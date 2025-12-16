---
name: monitoring-error-tracking
description: Production monitoring навык для Telegram Mini App (SvelteKit + Express). Покрывает Sentry error tracking, custom metrics, performance monitoring, uptime checks, Telegram alerting, structured logging с pino, Grafana dashboards. Используется для observability и быстрого реагирования на проблемы в production.
---

# Навык: Monitoring & Error Tracking

## Описание

Экспертный навык для настройки production monitoring и error tracking для Telegram Mini App с покрытием:
- Sentry integration для error tracking (frontend + backend)
- Custom metrics с Prometheus format
- Performance monitoring (Web Vitals, API latency)
- Uptime monitoring с health checks
- Telegram alerting для критичных ошибок
- Structured logging с pino
- Grafana dashboards для визуализации метрик
- Request tracing для debugging

Используется для observability в production, быстрого обнаружения и устранения проблем, мониторинга SLA.

---

## Когда использовать

- Production deployment Telegram Mini App
- Настройка error tracking (Sentry, Rollbar)
- Мониторинг метрик производительности
- Alerting при критичных ошибках
- Uptime monitoring
- Performance optimization (Web Vitals)
- Debugging production issues
- SLA compliance tracking
- Cost optimization (мониторинг usage)

---

## Основные возможности

### 1. Настроить Sentry для error tracking

Интегрировать Sentry для автоматического отслеживания ошибок в frontend и backend.

**Технологии**: @sentry/sveltekit, @sentry/node

**Установка**:
```bash
# Frontend (SvelteKit)
npm install @sentry/sveltekit

# Backend (Express)
npm install @sentry/node @sentry/profiling-node
```

**Frontend integration (SvelteKit)**:
```typescript
// src/hooks.client.ts
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'https://your-dsn@sentry.io/project-id',

  // Environment
  environment: import.meta.env.MODE,

  // Release tracking
  release: import.meta.env.VITE_APP_VERSION,

  // Sample rate (100% в dev, 10% в prod для экономии quota)
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

  // Replay sessions для debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false
    })
  ],

  // Filter out specific errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured'
  ],

  // Add user context
  beforeSend(event, hint) {
    // Telegram user info
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (telegramUser) {
      event.user = {
        id: telegramUser.id.toString(),
        username: telegramUser.username,
        ip_address: '{{auto}}'
      };
    }

    return event;
  }
});
```

**Backend integration (Express)**:
```typescript
// src/index.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,

  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration()
  ],

  beforeSend(event, hint) {
    // Add user context from JWT
    if (event.request?.headers?.authorization) {
      // Parse JWT and add user info
    }

    return event;
  }
});

// Request handler (must be first)
app.use(Sentry.Handlers.requestHandler());

// Tracing handler
app.use(Sentry.Handlers.tracingHandler());

// Routes
app.use('/api', routes);

// Error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

**Использование** - см. scripts/sentry-init.ts для полного setup.

**Best Practices**:
- Используйте низкий sample rate в production (10%) для экономии quota
- Добавляйте user context (Telegram user ID)
- Фильтруйте benign errors (`ignoreErrors`)
- Используйте Session Replay для критичных ошибок
- Группируйте ошибки по release version
- Настройте alerting в Sentry dashboard

---

### 2. Собирать custom metrics

Собирать и экспортировать custom metrics для мониторинга бизнес-логики.

**Технологии**: prom-client (Prometheus format)

**Установка**:
```bash
npm install prom-client
```

**Metrics setup**:
```typescript
// src/monitoring/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Registry
export const register = new Registry();

// Default metrics (CPU, memory, etc)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register });

// Custom metrics

// Counter: монотонно растущее значение
export const transactionsTotal = new Counter({
  name: 'loyalty_transactions_total',
  help: 'Total number of transactions',
  labelNames: ['type', 'status', 'store_id'],
  registers: [register]
});

// Histogram: распределение значений
export const transactionAmount = new Histogram({
  name: 'loyalty_transaction_amount',
  help: 'Transaction amount distribution',
  buckets: [100, 500, 1000, 5000, 10000, 50000],
  labelNames: ['store_id'],
  registers: [register]
});

export const apiLatency = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  buckets: [0.1, 0.5, 1, 2, 5],
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Gauge: значение которое может расти и падать
export const activeConnections = new Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register]
});

export const queueSize = new Gauge({
  name: 'offline_sync_queue_size',
  help: 'Number of pending offline transactions',
  labelNames: ['store_id'],
  registers: [register]
});
```

**Middleware для API latency**:
```typescript
// src/middleware/metrics.ts
import { Request, Response, NextFunction } from 'express';
import { apiLatency } from '../monitoring/metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // seconds

    apiLatency
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });

  next();
};
```

**Metrics endpoint**:
```typescript
// src/routes/metrics.ts
import { Router } from 'express';
import { register } from '../monitoring/metrics';

const router = Router();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
```

**Использование в бизнес-логике**:
```typescript
import { transactionsTotal, transactionAmount } from '../monitoring/metrics';

async function createTransaction(params) {
  const result = await db.transaction(async (tx) => {
    // ... transaction logic
  });

  // Record metrics
  transactionsTotal
    .labels(params.type, 'success', params.storeId)
    .inc();

  transactionAmount
    .labels(params.storeId)
    .observe(params.amount);

  return result;
}
```

**Best Practices**:
- Используйте Counter для монотонно растущих значений (total transactions)
- Используйте Histogram для распределений (latency, amount)
- Используйте Gauge для текущих значений (queue size, connections)
- Добавляйте labels для группировки (store_id, type, status)
- Не создавайте слишком много unique label combinations (cardinality explosion)
- Экспортируйте metrics на `/metrics` endpoint для Prometheus

---

### 3. Мониторить performance

Отслеживать Web Vitals на frontend и API latency на backend.

**Технологии**: web-vitals

**Frontend (Web Vitals)**:
```typescript
// src/lib/monitoring/webVitals.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';
import * as Sentry from '@sentry/sveltekit';

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function sendToAnalytics(metric: Metric) {
  // Send to Sentry
  Sentry.metrics.distribution(metric.name, metric.value, {
    tags: { rating: metric.rating }
  });

  // Send to custom backend
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: window.location.pathname,
      userAgent: navigator.userAgent
    })
  }).catch(console.error);
}

// Track Web Vitals
export function initWebVitals() {
  onCLS(sendToAnalytics);  // Cumulative Layout Shift
  onFID(sendToAnalytics);  // First Input Delay
  onFCP(sendToAnalytics);  // First Contentful Paint
  onLCP(sendToAnalytics);  // Largest Contentful Paint
  onTTFB(sendToAnalytics); // Time to First Byte
}
```

**Использование**:
```typescript
// src/routes/+layout.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { initWebVitals } from '$lib/monitoring/webVitals';

  onMount(() => {
    initWebVitals();
  });
</script>
```

**Backend (API Performance)**:
```typescript
// Уже покрыто через apiLatency histogram в capability #2
// Дополнительно можно логировать slow requests:

import { logger } from '../utils/logger';

export const slowRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests (>2 seconds)
    if (duration > 2000) {
      logger.warn({
        duration,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      }, 'Slow request detected');
    }
  });

  next();
};
```

**Best Practices**:
- Мониторьте все Core Web Vitals (CLS, FID, FCP, LCP, TTFB)
- Отправляйте метрики в Sentry и custom backend
- Логируйте slow requests (>2s)
- Группируйте по URL path для анализа
- Настройте alerting на degradation

---

### 4. Настроить uptime monitoring

Health checks для мониторинга доступности приложения.

**Health check endpoint** (уже создан в sveltekit-telegram-deployment skill):
```typescript
// src/routes/health/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: false,
      redis: false
    }
  };

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    health.checks.database = true;
  } catch (error) {
    health.status = 'degraded';
  }

  // Redis check (if used)
  try {
    await redis.ping();
    health.checks.redis = true;
  } catch (error) {
    health.status = 'degraded';
  }

  const status = health.status === 'ok' ? 200 : 503;
  return json(health, { status });
};
```

**External monitoring services**:

1. **UptimeRobot** (бесплатный):
   - URL: `https://yourdomain.com/health`
   - Interval: 5 минут
   - Alert: Email/Telegram при downtime

2. **Better Uptime** (платный):
   - Advanced health checks
   - Multi-region monitoring
   - Incident management

3. **Custom monitoring script**:
```typescript
// scripts/uptime-monitor.ts
import fetch from 'node-fetch';
import { sendTelegramAlert } from './telegram';

const HEALTH_URL = 'https://yourdomain.com/health';
const CHECK_INTERVAL = 60000; // 1 минута

let consecutiveFailures = 0;

async function checkHealth() {
  try {
    const response = await fetch(HEALTH_URL, { timeout: 5000 });

    if (response.ok) {
      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`Health check degraded: ${JSON.stringify(data.checks)}`);
      }

      consecutiveFailures = 0;
      console.log('Health check passed');

    } else {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }

  } catch (error) {
    consecutiveFailures++;
    console.error('Health check error:', error);

    // Alert after 3 consecutive failures
    if (consecutiveFailures >= 3) {
      await sendTelegramAlert(
        `🚨 Service DOWN!\n\nConsecutive failures: ${consecutiveFailures}\nError: ${error.message}`
      );
    }
  }
}

// Run check every minute
setInterval(checkHealth, CHECK_INTERVAL);
checkHealth(); // Initial check
```

**Best Practices**:
- Health check должен проверять все критичные зависимости (DB, Redis)
- Используйте external monitoring (не на том же сервере)
- Настройте alerting после N consecutive failures (не первой ошибки)
- Мониторьте не только HTTP 200, но и response content
- Добавьте timeout для health check (5 секунд)

---

### 5. Настроить Telegram alerting

Отправка уведомлений в Telegram при критичных ошибках.

**Telegram bot setup**:
```typescript
// src/monitoring/telegram.ts
interface TelegramAlertConfig {
  botToken: string;
  chatId: string;
}

const config: TelegramAlertConfig = {
  botToken: process.env.TELEGRAM_ALERT_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_ALERT_CHAT_ID!
};

export async function sendTelegramAlert(message: string) {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      console.error('Telegram alert failed:', await response.text());
    }

  } catch (error) {
    console.error('Telegram alert error:', error);
  }
}

// Alert templates
export function formatErrorAlert(error: Error, context?: any) {
  return `
🚨 <b>Production Error</b>

<b>Error:</b> ${error.message}

<b>Stack:</b>
<code>${error.stack?.split('\n').slice(0, 5).join('\n')}</code>

<b>Context:</b> ${JSON.stringify(context, null, 2)}

<b>Time:</b> ${new Date().toISOString()}
  `.trim();
}

export function formatMetricAlert(metric: string, value: number, threshold: number) {
  return `
⚠️ <b>Metric Alert</b>

<b>Metric:</b> ${metric}
<b>Current:</b> ${value}
<b>Threshold:</b> ${threshold}

<b>Time:</b> ${new Date().toISOString()}
  `.trim();
}
```

**Integration с error handler**:
```typescript
// src/middleware/errorHandler.ts
import { sendTelegramAlert, formatErrorAlert } from '../monitoring/telegram';

export const errorHandler = async (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error
  logger.error({ err }, 'Request error');

  // Send alert для критичных ошибок
  if (shouldAlert(err)) {
    await sendTelegramAlert(formatErrorAlert(err, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId
    }));
  }

  // Response
  res.status(500).json({ error: 'Internal server error' });
};

function shouldAlert(err: Error): boolean {
  // Alert только для критичных ошибок
  const criticalErrors = [
    'DatabaseError',
    'PaymentError',
    'AuthenticationError'
  ];

  return criticalErrors.some(type => err.name.includes(type));
}
```

**Metrics alerting**:
```typescript
// src/monitoring/alerts.ts
import { sendTelegramAlert, formatMetricAlert } from './telegram';
import { queueSize } from './metrics';

// Check metrics periodically
setInterval(async () => {
  const metrics = await register.getMetricsAsJSON();

  // Check offline queue size
  const queueMetric = metrics.find(m => m.name === 'offline_sync_queue_size');
  if (queueMetric) {
    const maxValue = Math.max(...queueMetric.values.map(v => v.value));

    if (maxValue > 100) {
      await sendTelegramAlert(
        formatMetricAlert('offline_sync_queue_size', maxValue, 100)
      );
    }
  }

  // Check error rate
  // ...

}, 5 * 60 * 1000); // Every 5 minutes
```

**Best Practices**:
- Создайте отдельный bot для alerting
- Используйте private Telegram channel для alerts
- Фильтруйте alerts (только критичные ошибки)
- Добавляйте context в alerts (user, endpoint, time)
- Группируйте похожие alerts (rate limiting)
- Используйте HTML formatting для читаемости

---

### 6. Настроить structured logging

Structured logging с pino для удобного парсинга и анализа.

**Logger setup** (уже создан в express-security-hardening skill):
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
      'req.body.cardNumber'
    ],
    censor: '***REDACTED***'
  }
});
```

**Request logging**:
```typescript
// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info({
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        remoteAddress: req.ip
      },
      res: {
        statusCode: res.statusCode
      },
      duration,
      userId: req.user?.userId
    }, 'HTTP request');
  });

  next();
};
```

**Contextual logging**:
```typescript
// Add request ID для трассировки
import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

// Use request ID в логах
logger.info({ requestId: req.id, userId }, 'Processing transaction');
```

**Log levels**:
```typescript
// Fatal - процесс должен завершиться
logger.fatal({ err }, 'Database connection lost');

// Error - ошибка обработана, но требует внимания
logger.error({ err, userId }, 'Payment failed');

// Warn - потенциальная проблема
logger.warn({ duration }, 'Slow query detected');

// Info - важная информация
logger.info({ userId, amount }, 'Transaction created');

// Debug - детали для debugging
logger.debug({ query }, 'Database query executed');

// Trace - очень детальная информация
logger.trace({ headers }, 'Request headers');
```

**Best Practices**:
- Используйте JSON format для structured logs
- Добавляйте request ID для трассировки
- Редактируйте чувствительные данные (пароли, карты)
- Используйте правильные log levels
- Добавляйте context (userId, requestId, duration)
- Используйте child loggers для модулей

---

### 7. Создать Grafana dashboards

Визуализация метрик с Grafana для мониторинга в реальном времени.

**Grafana setup**:
1. Install Grafana
2. Add Prometheus data source (URL: http://localhost:9090)
3. Import dashboard JSON (см. assets/grafana-dashboard.json)

**Key panels для Telegram Mini App**:

1. **Transactions Overview**:
   - Query: `rate(loyalty_transactions_total[5m])`
   - Type: Graph
   - Panel: Transactions per second (grouped by type)

2. **Transaction Amount Distribution**:
   - Query: `histogram_quantile(0.95, loyalty_transaction_amount)`
   - Type: Stat
   - Panel: 95th percentile transaction amount

3. **API Latency**:
   - Query: `histogram_quantile(0.95, http_request_duration_seconds_bucket)`
   - Type: Heatmap
   - Panel: Request latency by endpoint

4. **Error Rate**:
   - Query: `rate(loyalty_transactions_total{status="error"}[5m])`
   - Type: Graph
   - Panel: Errors per second

5. **Offline Queue Size**:
   - Query: `offline_sync_queue_size`
   - Type: Gauge
   - Panel: Current queue size by store

6. **System Resources**:
   - Query: `process_cpu_percent`, `process_memory_usage_bytes`
   - Type: Graph
   - Panel: CPU/Memory usage

**Alert rules**:
```yaml
# grafana-alerts.yaml
groups:
  - name: loyalty-app
    interval: 1m
    rules:
      - alert: HighErrorRate
        expr: rate(loyalty_transactions_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected

      - alert: HighAPILatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High API latency (p95 > 2s)

      - alert: LargeOfflineQueue
        expr: offline_sync_queue_size > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Large offline sync queue
```

**Best Practices**:
- Группируйте панели по функциональности (Transactions, API, System)
- Используйте правильные visualizations (Graph, Gauge, Heatmap)
- Настройте alerts для критичных метрик
- Добавляйте annotations для deployments
- Используйте template variables для filtering (store_id)

---

## Monitoring Checklist

### Error Tracking
- [ ] Sentry настроен (frontend + backend)
- [ ] User context добавлен
- [ ] Sample rate настроен (10% в production)
- [ ] Session Replay включен для критичных ошибок
- [ ] Alerting настроен в Sentry

### Metrics
- [ ] Custom metrics определены
- [ ] Metrics endpoint (/metrics) создан
- [ ] Prometheus scraping настроен
- [ ] Labels используются правильно (без cardinality explosion)

### Performance
- [ ] Web Vitals отслеживаются
- [ ] API latency мониторится
- [ ] Slow requests логируются

### Uptime
- [ ] Health check endpoint создан
- [ ] External monitoring настроен (UptimeRobot)
- [ ] Alerting при downtime настроен

### Alerting
- [ ] Telegram bot создан
- [ ] Critical errors отправляют alerts
- [ ] Metric alerts настроены
- [ ] Alert grouping настроен

### Logging
- [ ] Structured logging (JSON) используется
- [ ] Request ID добавлен
- [ ] Sensitive data редактируется
- [ ] Log levels используются правильно

### Dashboards
- [ ] Grafana настроена
- [ ] Dashboard создан
- [ ] Alert rules настроены
- [ ] Annotations для deployments добавлены

---

**Версия навыка**: 1.0.0
**Последнее обновление**: 2025-10-24
