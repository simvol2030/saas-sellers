# Security Best Practices for Telegram Mini Apps

This document covers critical security practices for production Telegram Mini Apps.

## 🔐 1. InitData Validation (CRITICAL)

**Why:** `initDataUnsafe` can be spoofed by malicious users. ALWAYS validate on backend.

### Implementation Checklist

- [ ] **Backend validation** - Use `scripts/validate_init_data.ts`
- [ ] **Bot token security** - Store in environment variables, never commit to Git
- [ ] **Timing-safe comparison** - Use `crypto.timingSafeEqual()` to prevent timing attacks
- [ ] **Auth date check** - Reject initData older than 24 hours (configurable)
- [ ] **HTTPS only** - Telegram requires HTTPS for production Mini Apps

### Example: SvelteKit

```typescript
// src/routes/api/telegram/auth/+server.ts
import { validateTelegramInitData } from '$lib/server/telegram/validate';
import { TELEGRAM_BOT_TOKEN } from '$env/static/private';

export const POST = async ({ request }) => {
  const { initData } = await request.json();

  try {
    const validated = validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN, 86400);

    // Create session, store user, etc.
    return json({ success: true, user: validated.user });
  } catch (error) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
};
```

### Common Mistakes

❌ **Trusting `initDataUnsafe` directly**
```typescript
// WRONG - can be spoofed!
const user = window.Telegram.WebApp.initDataUnsafe.user;
await fetch('/api/user', { body: JSON.stringify(user) });
```

✅ **Sending raw initData for backend validation**
```typescript
// CORRECT
const initData = window.Telegram.WebApp.initData;
await fetch('/api/telegram/auth', { body: JSON.stringify({ initData }) });
```

---

## 🛡️ 2. CSRF Protection

**Why:** Telegram Mini Apps can be embedded in iframes. Protect against CSRF attacks.

### Implementation

```typescript
// Backend: Generate CSRF token
import { randomBytes } from 'crypto';

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Store in session/database with user
session.csrfToken = generateCsrfToken();

// Frontend: Include in requests
const response = await fetch('/api/action', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

// Backend: Validate token
if (req.headers['x-csrf-token'] !== session.csrfToken) {
  return res.status(403).json({ error: 'Invalid CSRF token' });
}
```

### SvelteKit CSRF

```typescript
// src/hooks.server.ts
import { error } from '@sveltejs/kit';

export const handle = async ({ event, resolve }) => {
  if (event.request.method === 'POST') {
    const csrfToken = event.request.headers.get('x-csrf-token');
    const sessionToken = event.cookies.get('csrf_token');

    if (!csrfToken || csrfToken !== sessionToken) {
      throw error(403, 'Invalid CSRF token');
    }
  }

  return resolve(event);
};
```

---

## 🚦 3. Rate Limiting

**Why:** Prevent abuse, brute force attacks, and DoS.

### Implementation: Express

```typescript
import rateLimit from 'express-rate-limit';

// Login endpoint: strict limits
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.post('/api/telegram/auth', loginLimiter, authHandler);

// API endpoints: generous limits
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
```

### Implementation: SvelteKit + Redis

```typescript
// src/lib/server/rate-limit.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function rateLimit(
  identifier: string,
  max: number = 100,
  windowMs: number = 60000
): Promise<boolean> {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }

  return current <= max;
}

// Usage in endpoint
export const POST = async ({ request, getClientAddress }) => {
  const ip = getClientAddress();

  if (!(await rateLimit(ip, 5, 15 * 60 * 1000))) {
    return json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Process request...
};
```

---

## 🧹 4. Input Sanitization

**Why:** QR codes, user inputs can contain malicious data (SQL injection, XSS).

### QR Code Validation

```typescript
function validateQRCode(qrData: string): { type: string; payload: any } {
  // 1. Length check
  if (qrData.length > 1024) {
    throw new Error('QR data too long');
  }

  // 2. Format check (example: loyalty:card:123456)
  const parts = qrData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid QR format');
  }

  const [prefix, type, payload] = parts;

  // 3. Prefix validation
  if (prefix !== 'loyalty') {
    throw new Error('Invalid QR prefix');
  }

  // 4. Type whitelist
  const validTypes = ['card', 'transaction', 'coupon'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid QR type');
  }

  // 5. Payload validation (type-specific)
  if (type === 'card') {
    // Card number: 6-20 digits only
    if (!/^\d{6,20}$/.test(payload)) {
      throw new Error('Invalid card number format');
    }
  }

  // 6. SQL injection prevention
  if (/[';--]/.test(qrData)) {
    throw new Error('Invalid characters in QR data');
  }

  return { type, payload };
}
```

### User Input Sanitization

```typescript
import validator from 'validator';

function sanitizeUserInput(input: string): string {
  // 1. Trim whitespace
  let sanitized = input.trim();

  // 2. Escape HTML (prevent XSS)
  sanitized = validator.escape(sanitized);

  // 3. Length limit
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  // 4. Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}
```

---

## 🔒 5. Secure Bot Token Storage

**Why:** Bot token gives full control over your bot. Never expose it.

### Best Practices

✅ **Store in environment variables**
```bash
# .env (NEVER commit to Git!)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Add to .gitignore
echo ".env" >> .gitignore
```

✅ **Use secret management services (production)**
- **AWS Secrets Manager**
- **Google Cloud Secret Manager**
- **HashiCorp Vault**
- **Azure Key Vault**

❌ **Never hardcode**
```typescript
// WRONG - visible in source code!
const BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
```

❌ **Never log**
```typescript
// WRONG - token in logs!
console.log('Bot token:', process.env.TELEGRAM_BOT_TOKEN);
```

### Environment Variable Loading

```typescript
// SvelteKit: src/lib/server/env.ts
import { TELEGRAM_BOT_TOKEN } from '$env/static/private';

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export { TELEGRAM_BOT_TOKEN };
```

```typescript
// Express: src/env.ts
import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export { BOT_TOKEN };
```

---

## 🌐 6. HTTPS & SSL/TLS

**Why:** Telegram REQUIRES HTTPS for production Mini Apps. No exceptions.

### SSL Certificate Options

1. **Let's Encrypt (Free)**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx

   # Get certificate
   sudo certbot --nginx -d yourdomain.com
   ```

2. **Cloudflare (Free + CDN)**
   - Point domain to Cloudflare
   - Enable "Full (strict)" SSL mode
   - Automatic HTTPS rewrites

3. **Commercial Certificates**
   - DigiCert, Sectigo, GlobalSign

### nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL settings (A+ rating)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;

    # HSTS (force HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to SvelteKit
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🛡️ 7. Content Security Policy (CSP)

**Why:** Prevent XSS attacks, unauthorized resource loading.

### Recommended CSP Headers

```typescript
// SvelteKit: src/hooks.server.ts
export const handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.telegram.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  return response;
};
```

### Additional Security Headers

```typescript
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
```

---

## 📊 8. Audit Logging

**Why:** Track sensitive operations, detect anomalies, comply with regulations.

### What to Log

✅ **Authentication events**
- Login attempts (success/failure)
- InitData validation failures
- Session creation/destruction

✅ **Sensitive operations**
- Balance changes (loyalty points)
- Transaction creation
- QR code generation/scanning
- Admin actions

✅ **Security events**
- Rate limit exceeded
- CSRF token mismatch
- Invalid input detected

### Implementation

```typescript
// src/lib/server/audit-log.ts
import { db } from './db';

interface AuditLogEntry {
  userId?: number;
  action: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export async function logAudit(entry: AuditLogEntry) {
  await db.insert(auditLogs).values({
    user_id: entry.userId,
    action: entry.action,
    details: JSON.stringify(entry.details),
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
    created_at: entry.timestamp
  });

  // Also log to external service (DataDog, Sentry, etc.)
  console.log('[AUDIT]', entry);
}

// Usage
await logAudit({
  userId: user.id,
  action: 'loyalty.points.add',
  details: { amount: 100, reason: 'purchase' },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date()
});
```

---

## 🔍 9. Error Handling & Information Disclosure

**Why:** Don't leak sensitive information in error messages.

### Best Practices

❌ **Bad - Leaks implementation details**
```typescript
catch (error) {
  res.json({ error: error.message }); // "Invalid bot token 123456:ABC..."
}
```

✅ **Good - Generic error message**
```typescript
catch (error) {
  console.error('Auth error:', error); // Log for debugging
  res.status(401).json({ error: 'Authentication failed' }); // Generic message
}
```

### Production Error Responses

```typescript
export function handleError(error: Error, isDev: boolean) {
  if (isDev) {
    // Show full error in development
    return { error: error.message, stack: error.stack };
  } else {
    // Generic error in production
    return { error: 'An error occurred' };
  }
}
```

---

## 🧪 10. Security Testing Checklist

Before deploying to production, test:

- [ ] **InitData validation** - Try spoofed initData, expired initData
- [ ] **CSRF protection** - Send requests without CSRF token
- [ ] **Rate limiting** - Make 100 requests in 1 second
- [ ] **SQL injection** - Test with `' OR 1=1 --` in QR codes
- [ ] **XSS** - Test with `<script>alert('XSS')</script>` in inputs
- [ ] **HTTPS enforcement** - Access via HTTP (should redirect to HTTPS)
- [ ] **Bot token exposure** - Search codebase for hardcoded tokens
- [ ] **Error messages** - Check production errors don't leak sensitive data
- [ ] **CSP headers** - Verify with browser DevTools
- [ ] **Audit logs** - Verify sensitive operations are logged

---

## 📚 Additional Resources

- [Telegram Mini Apps Security Guide](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SvelteKit Security Best Practices](https://kit.svelte.dev/docs/security)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
