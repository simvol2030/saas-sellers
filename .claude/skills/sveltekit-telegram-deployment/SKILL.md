---
name: sveltekit-telegram-deployment
description: Production deployment навык для SvelteKit Telegram Mini Apps. Покрывает nginx reverse proxy, SSL/TLS с Let's Encrypt, PM2 process management, adapter-node, переменные окружения, мониторинг, кэширование, security headers, health checks, zero-downtime deployment. Используется для публикации Telegram WebApp в production.
---

# Навык: Production Deployment для SvelteKit Telegram Mini App

## Описание

Экспертный навык для развёртывания SvelteKit Telegram Mini App в production с поддержкой:
- nginx reverse proxy с SSL/TLS (Let's Encrypt)
- PM2 process manager с автозапуском и кластеризацией
- SvelteKit adapter-node для production build
- Безопасное управление переменными окружения
- Мониторинг логов и метрик (PM2, nginx)
- Performance optimization (Gzip, Brotli, HTTP/2)
- Security headers (CSP, HSTS, X-Frame-Options)
- Health checks и graceful shutdown
- Zero-downtime deployment с автоматическими откатами

Используется для публикации Telegram WebApp на VPS (Ubuntu/Debian) с доменом и SSL сертификатом.

---

## Когда использовать

- Production deployment SvelteKit Telegram Mini App
- Настройка nginx как reverse proxy для Node.js
- Установка SSL сертификатов Let's Encrypt
- PM2 для управления процессами Node.js
- Автозапуск приложения при перезагрузке сервера
- Мониторинг логов и метрик в production
- Performance оптимизация (кэширование, сжатие)
- Security hardening (headers, rate limiting)
- CI/CD deployment с GitHub Actions

---

## Основные возможности

### 1. Настроить SvelteKit с adapter-node

Подготовить SvelteKit приложение для production deployment с Node.js адаптером.

**Технологии**: SvelteKit, adapter-node, vite

**Шаги**:

#### 1.1 Установка adapter-node

```bash
npm install -D @sveltejs/adapter-node
```

#### 1.2 Конфигурация svelte.config.js

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      // Путь к output директории
      out: 'build',

      // Precompress assets (Gzip + Brotli)
      precompress: true,

      // Environment variables prefix (по умолчанию '')
      envPrefix: '',

      // Polyfills для Node.js
      polyfill: true
    }),

    // CSP для безопасности
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline', 'https://telegram.org'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https:'],
        'connect-src': ['self', 'https://api.telegram.org'],
        'frame-ancestors': ['https://web.telegram.org']
      }
    }
  }
};

export default config;
```

#### 1.3 Build script в package.json

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build/index.js",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  }
}
```

#### 1.4 Переменные окружения

```bash
# .env.production
PUBLIC_TELEGRAM_BOT_USERNAME=your_bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
DATABASE_URL=postgresql://user:pass@localhost:5432/loyalty_db
JWT_SECRET=super-secret-change-in-production
QR_SECRET_KEY=qr-encryption-key-32-bytes-min
ORIGIN=https://yourdomain.com
PORT=3000
HOST=127.0.0.1
```

**ВАЖНО**: Никогда не коммитьте `.env.production` в git!

#### 1.5 Production build

```bash
npm run build
```

Результат:
- `build/` директория с скомпилированным Node.js сервером
- `build/client/` - статические assets (CSS, JS, images)
- `build/server/` - серверный код
- `build/index.js` - entry point

**Best Practices**:
- Используйте `precompress: true` для Gzip/Brotli сжатия assets
- Настройте CSP директивы под ваш Telegram bot
- Отделяйте PUBLIC_ переменные (доступны в браузере) от серверных
- Проверяйте build локально: `npm run build && npm run start`

---

### 2. Установить и настроить PM2

Управление Node.js процессами с автозапуском, мониторингом и кластеризацией.

**Технологии**: PM2, ecosystem.config.js

**Шаги**:

#### 2.1 Установка PM2 глобально

```bash
npm install -g pm2
```

#### 2.2 Конфигурация ecosystem.config.js

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'loyalty-telegram-app',
    script: './build/index.js',

    // Автозапуск
    autorestart: true,

    // Остановка при превышении памяти
    max_memory_restart: '500M',

    // Environment
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '127.0.0.1'
    },

    // Cluster mode (используем все CPU ядра)
    instances: 'max',
    exec_mode: 'cluster',

    // Graceful shutdown (время на завершение запросов)
    kill_timeout: 5000,

    // Логи
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Ротация логов (опционально, требует pm2-logrotate)
    merge_logs: true,
    max_restarts: 10,

    // Wait ready signal from app
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

#### 2.3 Graceful shutdown в SvelteKit

```javascript
// build/index.js (после адаптации)
import { handler } from './handler.js';
import express from 'express';

const app = express();
app.use(handler);

const server = app.listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1', () => {
  console.log('Server listening on', process.env.PORT);

  // Сигнал PM2 о готовности
  if (process.send) {
    process.send('ready');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 5 seconds
  setTimeout(() => {
    console.error('Force shutdown after timeout');
    process.exit(1);
  }, 5000);
});
```

#### 2.4 Запуск с PM2

```bash
# Первый запуск
pm2 start ecosystem.config.js --env production

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save

# Мониторинг
pm2 monit

# Логи
pm2 logs loyalty-telegram-app

# Остановка
pm2 stop loyalty-telegram-app

# Перезапуск (zero-downtime)
pm2 reload loyalty-telegram-app

# Удаление
pm2 delete loyalty-telegram-app
```

**Best Practices**:
- Используйте `instances: 'max'` для cluster mode (максимум производительности)
- Настройте `max_memory_restart` для предотвращения memory leaks
- Реализуйте graceful shutdown для предотвращения потери запросов
- Используйте `pm2 reload` вместо `pm2 restart` для zero-downtime
- Настройте автозапуск: `pm2 startup` + `pm2 save`

---

### 3. Настроить nginx как reverse proxy

Настроить nginx для проксирования запросов к Node.js серверу с SSL/TLS.

**Технологии**: nginx, Let's Encrypt, certbot

**Шаги**:

#### 3.1 Установка nginx

```bash
sudo apt update
sudo apt install nginx
```

#### 3.2 Базовая конфигурация без SSL

```nginx
# /etc/nginx/sites-available/loyalty-app
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Лимиты
    client_max_body_size 10M;

    # Логи
    access_log /var/log/nginx/loyalty-app-access.log;
    error_log /var/log/nginx/loyalty-app-error.log;

    # Reverse proxy к Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support (если нужен)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
    }
}
```

#### 3.3 Активация конфигурации

```bash
# Создаём symlink
sudo ln -s /etc/nginx/sites-available/loyalty-app /etc/nginx/sites-enabled/

# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем nginx
sudo systemctl reload nginx
```

#### 3.4 Установка SSL сертификата (Let's Encrypt)

```bash
# Установка certbot
sudo apt install certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автообновление (тестируем)
sudo certbot renew --dry-run
```

Certbot автоматически:
- Получает SSL сертификат
- Обновляет nginx конфигурацию
- Настраивает HTTPS редирект
- Добавляет cron job для автообновления

#### 3.5 Полная конфигурация с SSL (после certbot)

```nginx
# /etc/nginx/sites-available/loyalty-app
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # ACME challenge для Let's Encrypt
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (добавлено certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Лимиты
    client_max_body_size 10M;

    # Логи
    access_log /var/log/nginx/loyalty-app-ssl-access.log;
    error_log /var/log/nginx/loyalty-app-ssl-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript image/svg+xml;

    # Brotli compression (если установлен модуль)
    # brotli on;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript image/svg+xml;

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API routes (без кэша)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }

    # Все остальные запросы
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
```

**Best Practices**:
- Всегда используйте HTTPS для Telegram WebApp (требование Telegram)
- Настройте HTTP/2 (`listen 443 ssl http2`)
- Включите Gzip/Brotli compression
- Настройте кэширование статических файлов (`expires 1y`)
- Добавьте security headers (HSTS, X-Frame-Options)
- Отключите кэш для API routes (`proxy_cache_bypass`)
- Настройте автообновление SSL сертификатов (certbot делает автоматически)

---

### 4. Настроить переменные окружения

Безопасное управление секретами и конфигурацией для production.

**Технологии**: dotenv, PM2 env, systemd EnvironmentFile

**Варианты**:

#### 4.1 PM2 ecosystem.config.js (рекомендуется)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'loyalty-app',
    script: './build/index.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '127.0.0.1',
      // НЕ храните секреты здесь! Используйте env file
    },
    env_file: '/var/www/loyalty-app/.env.production'
  }]
};
```

#### 4.2 .env.production file (безопасное хранение)

```bash
# /var/www/loyalty-app/.env.production
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# Telegram
PUBLIC_TELEGRAM_BOT_USERNAME=YourBot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Database
DATABASE_URL=postgresql://loyalty_user:strong_password@localhost:5432/loyalty_production

# Secrets
JWT_SECRET=change-this-to-random-64-char-string-in-production-abc123xyz
QR_SECRET_KEY=another-random-key-for-qr-encryption-min-32-bytes-long

# App
ORIGIN=https://yourdomain.com
PUBLIC_APP_NAME=Loyalty System
```

**Безопасность**:

```bash
# Установка правильных прав доступа
sudo chown www-data:www-data /var/www/loyalty-app/.env.production
sudo chmod 600 /var/www/loyalty-app/.env.production

# .env.production НЕ должен быть в git!
echo ".env.production" >> .gitignore
```

#### 4.3 Использование в SvelteKit

```typescript
// src/lib/server/config.ts
import { env } from '$env/dynamic/private';

export const config = {
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN!,
    botUsername: env.PUBLIC_TELEGRAM_BOT_USERNAME!
  },
  database: {
    url: env.DATABASE_URL!
  },
  jwt: {
    secret: env.JWT_SECRET!
  },
  qr: {
    secretKey: env.QR_SECRET_KEY!
  },
  app: {
    origin: env.ORIGIN!,
    port: parseInt(env.PORT || '3000'),
    host: env.HOST || '127.0.0.1'
  }
};

// Валидация при старте
function validateConfig() {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'DATABASE_URL',
    'JWT_SECRET',
    'QR_SECRET_KEY',
    'ORIGIN'
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

validateConfig();
```

**Best Practices**:
- Никогда не коммитьте `.env.production` в git
- Используйте сильные случайные ключи (min 32 символа)
- Храните `.env` файл с правами 600 (`-rw-------`)
- Валидируйте переменные при старте приложения
- Различайте PUBLIC_ переменные (доступны клиенту) и приватные
- Используйте разные значения для dev/staging/production

---

### 5. Настроить мониторинг и логи

Отслеживание работы приложения, ошибок и метрик производительности.

**Технологии**: PM2 monitoring, nginx logs, logrotate

**Компоненты**:

#### 5.1 PM2 Monitoring

```bash
# Real-time monitoring dashboard
pm2 monit

# CPU/Memory stats
pm2 list

# Логи в реальном времени
pm2 logs loyalty-app

# Логи с фильтром ошибок
pm2 logs loyalty-app --err

# Очистка старых логов
pm2 flush
```

#### 5.2 PM2 Log Rotation

```bash
# Установка pm2-logrotate
pm2 install pm2-logrotate

# Конфигурация
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
```

#### 5.3 nginx Logrotate

```nginx
# /etc/logrotate.d/loyalty-app
/var/log/nginx/loyalty-app-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

#### 5.4 Structured Logging в приложении

```typescript
// src/lib/server/logger.ts
import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.app.env === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password'],
    censor: '***REDACTED***'
  }
});

// Использование
logger.info({ userId: 123, action: 'purchase' }, 'Purchase completed');
logger.error({ error: err }, 'Payment failed');
```

#### 5.5 Health Check Endpoint

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
      memory: false
    }
  };

  // Database check
  try {
    await db.raw('SELECT 1');
    health.checks.database = true;
  } catch (error) {
    health.status = 'degraded';
  }

  // Memory check
  const used = process.memoryUsage();
  const maxMemory = 500 * 1024 * 1024; // 500MB
  health.checks.memory = used.heapUsed < maxMemory;

  if (!health.checks.memory) {
    health.status = 'degraded';
  }

  const status = health.status === 'ok' ? 200 : 503;

  return json(health, { status });
};
```

**Best Practices**:
- Используйте PM2 monitoring для real-time метрик
- Настройте log rotation для предотвращения переполнения диска
- Используйте structured logging (JSON format) для удобного парсинга
- Создайте health check endpoint для мониторинга извне
- Редактируйте чувствительные данные в логах (пароли, токены)
- Мониторьте disk space для логов: `df -h /var/log`

---

### 6. Настроить zero-downtime deployment

Обновление приложения без остановки обслуживания пользователей.

**Технологии**: PM2 reload, GitHub Actions, deployment script

**Стратегия**:

#### 6.1 Deployment Script

```bash
#!/bin/bash
# /var/www/loyalty-app/deploy.sh

set -e  # Exit on error

APP_DIR="/var/www/loyalty-app"
APP_NAME="loyalty-app"

echo "🚀 Starting deployment..."

cd $APP_DIR

# 1. Backup current version
echo "📦 Creating backup..."
BACKUP_DIR="/var/backups/loyalty-app/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r build $BACKUP_DIR/
cp package.json package-lock.json $BACKUP_DIR/

# 2. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 3. Install dependencies
echo "📚 Installing dependencies..."
npm ci --production

# 4. Build application
echo "🔨 Building application..."
npm run build

# 5. Run database migrations (если используются)
echo "🗄️  Running database migrations..."
# npm run migrate

# 6. Reload PM2 (zero-downtime)
echo "🔄 Reloading PM2..."
pm2 reload ecosystem.config.js --env production

# 7. Wait for health check
echo "🏥 Waiting for health check..."
sleep 5

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ $HEALTH_CHECK -eq 200 ]; then
  echo "✅ Deployment successful!"

  # Cleanup old backups (keep last 5)
  cd /var/backups/loyalty-app
  ls -t | tail -n +6 | xargs rm -rf

else
  echo "❌ Health check failed! Rolling back..."

  # Rollback
  rm -rf $APP_DIR/build
  cp -r $BACKUP_DIR/build $APP_DIR/
  pm2 reload $APP_NAME

  echo "⏪ Rollback complete"
  exit 1
fi

echo "🎉 Deployment complete!"
```

Права:
```bash
chmod +x /var/www/loyalty-app/deploy.sh
```

#### 6.2 GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/loyalty-app
            ./deploy.sh
```

Secrets в GitHub:
- `VPS_HOST`: IP адрес сервера
- `VPS_USER`: SSH пользователь
- `VPS_SSH_KEY`: Приватный SSH ключ

#### 6.3 PM2 Reload vs Restart

```bash
# ❌ Restart - есть downtime (пользователи получат ошибки)
pm2 restart loyalty-app

# ✅ Reload - zero downtime (cluster mode)
pm2 reload loyalty-app

# ✅ Graceful reload с timeout
pm2 reload loyalty-app --update-env
```

**Как работает PM2 reload**:
1. Запускает новый процесс с обновлённым кодом
2. Ждёт `ready` сигнал от нового процесса
3. Останавливает старые процессы (graceful shutdown)
4. Переключает трафик на новые процессы

Требования:
- `exec_mode: 'cluster'` в ecosystem.config.js
- `wait_ready: true`
- `process.send('ready')` в приложении

**Best Practices**:
- Всегда используйте `pm2 reload` вместо `pm2 restart`
- Создавайте backup перед деплоем
- Проверяйте health check после деплоя
- Автоматически откатывайтесь при ошибках
- Храните последние 5 backups
- Тестируйте deployment script локально
- Используйте CI/CD (GitHub Actions, GitLab CI) для автоматизации

---

### 7. Настроить production database (PostgreSQL)

Настроить PostgreSQL для production с бэкапами и миграциями.

**Технологии**: PostgreSQL, Drizzle ORM, pg_dump

**Шаги**:

#### 7.1 Установка PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib
```

#### 7.2 Создание пользователя и БД

```bash
# Вход в PostgreSQL
sudo -u postgres psql

# Создание пользователя
CREATE USER loyalty_user WITH PASSWORD 'strong_password_here';

# Создание БД
CREATE DATABASE loyalty_production OWNER loyalty_user;

# Права
GRANT ALL PRIVILEGES ON DATABASE loyalty_production TO loyalty_user;

# Выход
\q
```

#### 7.3 Connection pooling с Drizzle

```typescript
// src/lib/server/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from './config';

const pool = new Pool({
  connectionString: config.database.url,
  max: 20,              // Максимум соединений
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.app.env === 'production' ? {
    rejectUnauthorized: false
  } : undefined
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  console.log('Database pool closed');
});
```

#### 7.4 Database Migrations

```bash
# Generate migration
npm run db:generate

# Push migration to production
npm run db:push

# ИЛИ migrate в deployment script
npx drizzle-kit migrate
```

#### 7.5 Automated Backups

```bash
#!/bin/bash
# /usr/local/bin/backup-db.sh

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="loyalty_production"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U loyalty_user $DB_NAME | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# Keep last 7 days
find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup complete: ${DB_NAME}_${DATE}.sql.gz"
```

Cron job:
```bash
# Ежедневный бэкап в 2:00 AM
0 2 * * * /usr/local/bin/backup-db.sh
```

**Best Practices**:
- Используйте connection pooling (`max: 20`)
- Настройте SSL для production
- Автоматизируйте бэкапы (cron job)
- Храните бэкапы минимум 7 дней
- Тестируйте restore из бэкапа регулярно
- Используйте migrations для schema changes
- Закрывайте pool при graceful shutdown

---

### 8. Настроить security headers

Защита от XSS, clickjacking, CSRF и других атак.

**Технологии**: nginx headers, SvelteKit CSP, helmet

**Headers**:

См. nginx конфигурацию в capability #3 для полного списка security headers.

Дополнительно в SvelteKit:

```javascript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
};
```

**Best Practices**:
- Настраивайте CSP в svelte.config.js
- Добавляйте HSTS для HTTPS only
- Используйте X-Frame-Options для защиты от clickjacking
- Настройте Referrer-Policy
- Ограничьте Permissions-Policy

---

### 9. Настроить rate limiting

Защита от DDoS и брутфорса.

**Технологии**: nginx limit_req, express-rate-limit

**nginx rate limiting**:

```nginx
# /etc/nginx/nginx.conf
http {
    # Rate limiting zone
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;

    # Connection limit
    limit_conn_zone $binary_remote_addr zone=addr:10m;
}

# /etc/nginx/sites-available/loyalty-app
server {
    # General rate limit
    limit_req zone=general burst=20 nodelay;
    limit_conn addr 10;

    # API endpoints
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    # Auth endpoints (более строгий лимит)
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

**Application-level (express-rate-limit)**:

```typescript
// src/hooks.server.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов с одного IP
  message: 'Too many requests, please try again later'
});

export const handle: Handle = async ({ event, resolve }) => {
  // Apply rate limiting
  await limiter(event.request as any, {} as any);

  return resolve(event);
};
```

**Best Practices**:
- Используйте разные лимиты для разных endpoints
- Auth endpoints - самый строгий лимит (1 req/s)
- API endpoints - средний лимит (5-10 req/s)
- Static assets - без лимита
- Логируйте блокированные IP для анализа

---

## Чек-лист Production Deployment

### Перед деплоем

- [ ] `npm run build` успешно выполняется
- [ ] `npm run check` - 0 errors
- [ ] Все environment variables настроены
- [ ] .env.production НЕ в git
- [ ] SSL сертификат получен
- [ ] Database migrations готовы
- [ ] PM2 ecosystem.config.js настроен
- [ ] nginx конфигурация готова
- [ ] Deployment script протестирован

### После деплоя

- [ ] Health check возвращает 200 OK
- [ ] HTTPS работает (редирект с HTTP)
- [ ] PM2 процессы запущены (`pm2 list`)
- [ ] Логи не показывают ошибок (`pm2 logs`)
- [ ] Database подключение работает
- [ ] Telegram WebApp открывается в боте
- [ ] Автозапуск настроен (`pm2 startup`)
- [ ] Backups работают (проверить cron)
- [ ] Monitoring настроен

### Security

- [ ] SSL/TLS настроен (A+ rating на SSL Labs)
- [ ] Security headers настроены
- [ ] CSP директивы корректны
- [ ] Rate limiting включен
- [ ] Firewall настроен (UFW/iptables)
- [ ] SSH ключ-аутентификация включена
- [ ] Root login отключен

---

## Troubleshooting

### PM2 процесс падает

```bash
# Проверка логов
pm2 logs loyalty-app --err

# Увеличение memory limit
pm2 set max_memory_restart 1G

# Проверка health
pm2 describe loyalty-app
```

### nginx 502 Bad Gateway

```bash
# Проверка PM2
pm2 status

# Проверка порта
netstat -tulpn | grep 3000

# Проверка nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL сертификат не обновляется

```bash
# Тест обновления
sudo certbot renew --dry-run

# Ручное обновление
sudo certbot renew

# Проверка cron job
sudo systemctl status certbot.timer
```

---

**Версия навыка**: 1.0.0
**Последнее обновление**: 2025-10-24
