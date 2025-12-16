# Telegram Mini App Deployment Checklist

Step-by-step checklist for deploying production Telegram Mini Apps.

## 📋 Pre-Deployment Checklist

### 1. Code & Configuration

- [ ] **Environment variables configured**
  - `TELEGRAM_BOT_TOKEN` set
  - `DATABASE_URL` configured (if using PostgreSQL)
  - `SESSION_SECRET` set (random 32+ character string)
  - `NODE_ENV=production`

- [ ] **Bot token security**
  - Token stored in environment variables (not hardcoded)
  - `.env` file in `.gitignore`
  - Token never logged or exposed

- [ ] **InitData validation implemented**
  - Backend validates all Telegram requests
  - Using `scripts/validate_init_data.ts` or equivalent
  - Timing-safe comparison used
  - Auth date checked (max age: 24 hours)

- [ ] **Security headers configured**
  - CSP headers set
  - HSTS enabled (production only)
  - X-Frame-Options set
  - X-Content-Type-Options set

- [ ] **Rate limiting enabled**
  - Login endpoints: 5 attempts per 15 minutes
  - API endpoints: 100 requests per minute
  - Using Redis for distributed systems

- [ ] **Error handling**
  - Production errors don't leak sensitive data
  - Error tracking service configured (Sentry, etc.)

- [ ] **Database**
  - Migrations applied
  - Indexes created for performance
  - Backup strategy configured
  - Connection pooling enabled (PostgreSQL)

### 2. Testing

- [ ] **Functional testing**
  - All features work in Telegram client
  - Tested on iOS, Android, Desktop, Web
  - QR scanner works (requires Telegram 6.2+)
  - MainButton/BackButton work correctly
  - Theme switching works

- [ ] **Security testing**
  - Spoofed initData rejected
  - CSRF protection works
  - Rate limiting works
  - SQL injection tests passed
  - XSS tests passed

- [ ] **Performance testing**
  - Page load time < 3 seconds
  - API response time < 500ms
  - Database queries optimized

### 3. Monitoring & Logging

- [ ] **Error tracking configured**
  - Sentry/Rollbar/DataDog integration
  - Source maps uploaded

- [ ] **Audit logging enabled**
  - Authentication events logged
  - Sensitive operations logged
  - IP address and user agent captured

- [ ] **Metrics & monitoring**
  - Server metrics (CPU, memory, disk)
  - Application metrics (request count, errors)
  - Database metrics (connections, query time)

---

## 🌐 1. Domain & SSL Setup

### 1.1 Domain Configuration

**Option A: Subdomain (Recommended)**
```
miniapp.yourdomain.com
```

**Option B: Dedicated domain**
```
yourminiapp.com
```

### 1.2 DNS Configuration

Point domain to your server:
```
A     miniapp.yourdomain.com  →  YOUR_SERVER_IP
AAAA  miniapp.yourdomain.com  →  YOUR_SERVER_IPv6 (optional)
```

Verify DNS propagation:
```bash
dig miniapp.yourdomain.com
```

### 1.3 SSL Certificate (Let's Encrypt)

**Install certbot:**
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

**Get certificate:**
```bash
sudo certbot --nginx -d miniapp.yourdomain.com
```

**Auto-renewal (certbot sets this up automatically):**
```bash
# Test renewal
sudo certbot renew --dry-run

# View renewal timer
sudo systemctl status certbot.timer
```

### 1.4 SSL Configuration Check

Test SSL rating: https://www.ssllabs.com/ssltest/

Target: **A+ rating**

---

## 🚀 2. Server Setup (Ubuntu/Debian)

### 2.1 Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools
sudo apt install -y build-essential git

# Install nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2.2 Create Deploy User

```bash
# Create user
sudo adduser deploy
sudo usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### 2.3 Clone Repository

```bash
cd ~
git clone https://github.com/yourusername/your-miniapp.git
cd your-miniapp
```

---

## 📦 3. Application Deployment

### 3.1 Install Dependencies

```bash
# Frontend (SvelteKit)
cd frontend-sveltekit
npm install

# Backend (Express.js) - if separate
cd ../backend-expressjs
npm install
```

### 3.2 Environment Variables

```bash
# Create .env file
nano .env
```

**Required variables:**
```env
NODE_ENV=production
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SESSION_SECRET=your_random_32_char_secret_here
PORT=3000
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.3 Build Application

```bash
# SvelteKit
cd frontend-sveltekit
npm run build

# Express.js (if TypeScript)
cd ../backend-expressjs
npm run build
```

### 3.4 Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed data (optional)
npm run db:seed
```

---

## ⚙️ 4. Process Manager (PM2)

### 4.1 Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'miniapp-frontend',
      cwd: '/home/deploy/your-miniapp/frontend-sveltekit',
      script: 'build/index.js', // SvelteKit adapter-node output
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'miniapp-backend',
      cwd: '/home/deploy/your-miniapp/backend-expressjs',
      script: 'dist/index.js', // Express.js build output
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

### 4.2 Start Applications

```bash
# Start all apps
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Run the command it outputs (starts with 'sudo')
```

### 4.3 PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart app
pm2 restart miniapp-frontend

# Stop app
pm2 stop miniapp-frontend

# Monitor
pm2 monit
```

---

## 🔧 5. nginx Configuration

### 5.1 Create nginx Config

```bash
sudo nano /etc/nginx/sites-available/miniapp
```

```nginx
# Upstream servers
upstream frontend {
    server localhost:3000;
}

upstream backend {
    server localhost:3001;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name miniapp.yourdomain.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/miniapp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/miniapp.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CSP (adjust as needed)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.telegram.org; frame-ancestors 'none';" always;

    # Logging
    access_log /var/log/nginx/miniapp_access.log;
    error_log /var/log/nginx/miniapp_error.log;

    # Frontend (SvelteKit)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API (if separate)
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting (optional, PM2 might handle this)
        limit_req zone=api_limit burst=20 nodelay;
    }

    # Static files caching (if served by nginx)
    location /_app/ {
        proxy_pass http://frontend/_app/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name miniapp.yourdomain.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

### 5.2 Enable Site & Restart nginx

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/miniapp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Enable nginx on boot
sudo systemctl enable nginx
```

---

## 🤖 6. Telegram Bot Configuration

### 6.1 Set Mini App URL

**Via BotFather:**
1. Open @BotFather in Telegram
2. Send `/mybots`
3. Select your bot
4. Click **Bot Settings** → **Menu Button**
5. Send Mini App URL: `https://miniapp.yourdomain.com`

**Via API:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "Open App",
      "web_app": {
        "url": "https://miniapp.yourdomain.com"
      }
    }
  }'
```

### 6.2 Set Bot Commands

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Открыть программу лояльности"},
      {"command": "balance", "description": "Проверить баланс баллов"},
      {"command": "card", "description": "Показать карту лояльности"}
    ]
  }'
```

---

## 🧪 7. Post-Deployment Testing

### 7.1 HTTPS Test

```bash
# Check SSL certificate
curl -vI https://miniapp.yourdomain.com 2>&1 | grep -i ssl

# Check HSTS header
curl -I https://miniapp.yourdomain.com | grep -i strict-transport-security
```

### 7.2 Telegram Integration Test

1. Open your bot in Telegram
2. Click **Menu Button** (bottom-left)
3. Mini App should open in Telegram
4. Check browser console for errors
5. Test QR scanner (requires mobile)
6. Test MainButton
7. Test theme switching (Settings → Chat Settings → Theme)

### 7.3 Performance Test

```bash
# Response time test
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://miniapp.yourdomain.com

# Load test (using Apache Bench)
ab -n 1000 -c 10 https://miniapp.yourdomain.com/
```

### 7.4 Security Test

- [ ] HTTP redirects to HTTPS
- [ ] Spoofed initData rejected (test with modified data)
- [ ] Rate limiting works (make 100+ rapid requests)
- [ ] CSRF protection works (test without token)
- [ ] CSP headers present (check DevTools → Network → Headers)

---

## 📊 8. Monitoring Setup

### 8.1 PM2 Monitoring

```bash
# Install PM2 Plus (free tier available)
pm2 install pm2-server-monit

# Link to PM2 Plus dashboard
pm2 link <SECRET_KEY> <PUBLIC_KEY>
```

### 8.2 nginx Monitoring

```bash
# Enable status page
sudo nano /etc/nginx/sites-available/miniapp
```

Add:
```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

```bash
sudo systemctl reload nginx

# Check status
curl http://localhost/nginx_status
```

### 8.3 Log Rotation

nginx logs rotate automatically. For PM2:

```bash
pm2 install pm2-logrotate

# Configure (optional)
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

---

## 🔄 9. CI/CD Setup (Optional)

### 9.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          cd frontend-sveltekit
          npm ci

      - name: Build
        run: |
          cd frontend-sveltekit
          npm run build

      - name: Deploy to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "frontend-sveltekit/build"
          target: "/home/deploy/your-miniapp"

      - name: Restart PM2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/your-miniapp
            pm2 restart miniapp-frontend
```

---

## ✅ 10. Final Checklist

Before marking deployment complete:

- [ ] **Domain & SSL**
  - [ ] Domain configured and propagated
  - [ ] SSL certificate valid (test at ssllabs.com)
  - [ ] HTTP redirects to HTTPS
  - [ ] HSTS enabled

- [ ] **Application**
  - [ ] Frontend running (PM2 status)
  - [ ] Backend running (if separate)
  - [ ] Database connected
  - [ ] Migrations applied

- [ ] **Telegram**
  - [ ] Bot menu button configured
  - [ ] Mini App opens in Telegram
  - [ ] InitData validation works
  - [ ] QR scanner works (mobile)
  - [ ] Theme syncs with Telegram

- [ ] **Security**
  - [ ] Bot token secure (env variable)
  - [ ] CSRF protection enabled
  - [ ] Rate limiting works
  - [ ] CSP headers configured
  - [ ] Error messages don't leak data

- [ ] **Monitoring**
  - [ ] PM2 monitoring active
  - [ ] Error tracking configured (Sentry)
  - [ ] Logs rotating properly
  - [ ] Metrics dashboard accessible

- [ ] **Performance**
  - [ ] Page load < 3s
  - [ ] API response < 500ms
  - [ ] Database queries optimized

- [ ] **Testing**
  - [ ] Tested on iOS Telegram
  - [ ] Tested on Android Telegram
  - [ ] Tested on Desktop Telegram
  - [ ] Tested on Web Telegram
  - [ ] All features work

---

## 🆘 Troubleshooting

### Mini App doesn't open
- Check nginx logs: `sudo tail -f /var/log/nginx/miniapp_error.log`
- Check PM2 logs: `pm2 logs miniapp-frontend`
- Verify SSL certificate: `sudo certbot certificates`

### InitData validation fails
- Check bot token is correct
- Verify `TELEGRAM_BOT_TOKEN` environment variable
- Check server time (must be accurate for auth_date validation)

### Rate limiting issues
- Check nginx error log for rate limit messages
- Adjust limits in nginx config if needed

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check database is running: `sudo systemctl status postgresql`
- Check connection pool settings

---

## 📞 Support Resources

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [SvelteKit Deployment Docs](https://kit.svelte.dev/docs/adapters)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Community](https://community.letsencrypt.org/)
