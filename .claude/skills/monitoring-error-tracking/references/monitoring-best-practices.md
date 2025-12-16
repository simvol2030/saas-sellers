# Monitoring Best Practices for Production Telegram Mini Apps

## 1. Error Tracking Strategy

### Sentry Configuration

**Sample Rates**:
- Development: 100% traces, 100% replays
- Production: 10% traces, 10% replays (save quota)
- Error replays: 100% (always capture context)

**What to Track**:
- ✅ Unhandled exceptions
- ✅ API errors (4xx, 5xx)
- ✅ Payment failures
- ✅ QR code scan errors
- ✅ Offline sync failures
- ✅ Database connection errors
- ❌ User navigations (noise)
- ❌ Expected validation errors (noise)

**User Context**:
Always attach Telegram user data:
```typescript
event.user = {
  id: telegramUser.id.toString(),
  username: telegramUser.username,
  language_code: telegramUser.language_code
};
event.tags = {
  telegram_platform: WebApp.platform,
  telegram_version: WebApp.version
};
```

### Error Filtering

Ignore common false positives:
```typescript
ignoreErrors: [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection',
  'ChunkLoadError',
  /telegram.*bot/i  // Telegram bot errors (not user-facing)
]
```

---

## 2. Metrics Design

### Metric Naming Convention

Follow Prometheus naming:
```
<namespace>_<subsystem>_<name>_<unit>
```

Examples:
- `loyalty_transactions_total` (counter)
- `loyalty_qr_scans_total` (counter)
- `http_request_duration_seconds` (histogram)
- `offline_sync_queue_size` (gauge)
- `loyalty_active_users` (gauge)

### Cardinality Awareness

**High cardinality (avoid)**:
- ❌ User IDs in labels (thousands of unique values)
- ❌ Full URLs in labels
- ❌ Timestamps in labels

**Low cardinality (good)**:
- ✅ Transaction type (earn, redeem, refund)
- ✅ HTTP status code (200, 400, 500)
- ✅ Store ID (if <100 stores)
- ✅ Environment (dev, staging, prod)

### Metric Types

**Counter** (always increasing):
- Transaction count
- QR scans
- API requests
- Cache hits/misses

**Gauge** (can go up/down):
- Active users
- Queue size
- Memory usage
- Database connections

**Histogram** (distribution):
- API latency
- Transaction amount
- Web Vitals (LCP, FID, CLS)

---

## 3. Performance Monitoring

### Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤2.5s | 2.5s - 4s | >4s |
| FID | ≤100ms | 100ms - 300ms | >300ms |
| CLS | ≤0.1 | 0.1 - 0.25 | >0.25 |
| FCP | ≤1.8s | 1.8s - 3s | >3s |
| TTFB | ≤800ms | 800ms - 1800ms | >1800ms |

### API Latency Targets

- **P50**: <200ms (typical user)
- **P95**: <500ms (slower users)
- **P99**: <1s (edge cases)

Alert if P95 > 2s for 5 minutes.

### Mobile-Specific Considerations

Telegram Mini Apps run on various devices:
- Track metrics by `platform` label (android, ios, web)
- Monitor bundle size (target <500KB initial)
- Track offline sync queue growth

---

## 4. Uptime Monitoring

### Health Check Endpoint

**Levels**:
1. **Shallow** (`/health`): Server responds (200 OK)
2. **Deep** (`/health/ready`): Database + Redis reachable
3. **Critical** (`/health/live`): Essential services only

Example:
```typescript
// Shallow
app.get('/health', (req, res) => res.status(200).send('OK'));

// Deep
app.get('/health/ready', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});
```

### External Monitoring

Use UptimeRobot or similar:
- Check `/health` every 5 minutes
- Alert on 2 consecutive failures
- Monitor from multiple regions

### SLA Targets

- **Uptime**: 99.9% (43 min downtime/month)
- **Response time**: <2s for 95% of requests
- **Error rate**: <0.1% of transactions

---

## 5. Alerting Strategy

### Alert Levels

**Critical** (immediate action):
- Error rate >10% for 5 min
- API completely down (all requests fail)
- Database unreachable
- Payment processing broken

**Warning** (investigate soon):
- API latency P95 >2s for 5 min
- Error rate >5% for 10 min
- Disk usage >80%
- Memory usage >85%

**Info** (awareness):
- Deployment completed
- Auto-scaling event
- Certificate expiring in 7 days

### Alert Destinations

- **Critical**: Telegram + PagerDuty + SMS
- **Warning**: Telegram + Email
- **Info**: Telegram only

### Alert Rate Limiting

Prevent alert fatigue:
```typescript
const alertCache = new Map<string, number>();

function shouldSendAlert(key: string, cooldownMs = 300000): boolean {
  const lastSent = alertCache.get(key);
  const now = Date.now();

  if (!lastSent || now - lastSent > cooldownMs) {
    alertCache.set(key, now);
    return true;
  }
  return false;
}
```

---

## 6. Logging Best Practices

### Log Levels

- **error**: Unrecoverable errors requiring immediate action
- **warn**: Recoverable errors, degraded functionality
- **info**: Important business events (transaction created)
- **debug**: Detailed diagnostic info (dev/staging only)
- **trace**: Very verbose (local development only)

### Structured Logging

Always use structured logs:
```typescript
logger.info({
  msg: 'Transaction created',
  transactionId: tx.id,
  userId: user.id,
  storeId: store.id,
  amount: tx.amount,
  type: tx.type,
  duration: Date.now() - startTime
});
```

### Sensitive Data

Never log:
- ❌ Passwords
- ❌ API keys/tokens
- ❌ Credit card numbers
- ❌ Full Telegram initData

Safe to log:
- ✅ User ID (hashed if needed)
- ✅ Transaction IDs
- ✅ Sanitized error messages
- ✅ Request/response metadata

### Log Retention

- **Production errors**: 90 days
- **Info logs**: 30 days
- **Debug logs**: 7 days (staging only)
- **Trace logs**: 1 day (local only)

---

## 7. Dashboard Design

### Key Principles

1. **Hierarchy**: Most important metrics at top
2. **Grouping**: Related metrics together
3. **Time range**: Default to last 1 hour for prod monitoring
4. **Refresh**: Auto-refresh every 30s
5. **Alerts**: Visualize alert thresholds

### Essential Dashboards

**1. Application Overview**:
- Transaction rate
- Error rate
- Active users
- API latency

**2. Infrastructure**:
- CPU/Memory usage
- Database connections
- Redis operations
- Disk I/O

**3. Business Metrics**:
- Revenue per hour
- Top stores by transactions
- Popular rewards
- User retention

**4. Telegram-Specific**:
- Platform distribution (iOS, Android, Web)
- QR scan success rate
- Offline sync performance
- WebApp version adoption

---

## 8. Incident Response

### On-Call Runbook

**Step 1: Acknowledge**
- Acknowledge alert in Telegram/PagerDuty
- Check Grafana for current state
- Join incident channel

**Step 2: Assess**
- What's broken? (error rate, latency, specific endpoint)
- How many users affected? (check active users gauge)
- Is data at risk? (check transaction logs)

**Step 3: Mitigate**
- Can we rollback? (check deployment logs)
- Can we disable feature? (feature flags)
- Do we need to scale? (check resource usage)

**Step 4: Resolve**
- Apply fix
- Monitor metrics for 10 minutes
- Verify user reports stop

**Step 5: Document**
- Write postmortem (what, why, how to prevent)
- Update runbook
- Schedule team review

### Common Incidents

**High Error Rate**:
1. Check Sentry for error types
2. Check recent deployments (rollback if needed)
3. Check database/Redis connectivity
4. Check external API status (Telegram Bot API)

**High Latency**:
1. Check database query performance
2. Check N+1 queries (Drizzle logs)
3. Check cache hit rate
4. Check CPU/memory

**Database Down**:
1. Check connection pool (active/idle)
2. Check database server status
3. Verify credentials/firewall
4. Check max connections limit

---

## 9. Metrics Checklist

### Frontend (SvelteKit)

- [ ] Sentry error tracking enabled
- [ ] Session Replay enabled (10% sample rate)
- [ ] Web Vitals tracked (LCP, FID, CLS, FCP, TTFB)
- [ ] Telegram user context attached to errors
- [ ] Bundle size monitored (<500KB)
- [ ] Page load time tracked

### Backend (Express)

- [ ] Sentry error tracking enabled
- [ ] Prometheus metrics endpoint (`/metrics`)
- [ ] Health check endpoints (`/health`, `/health/ready`)
- [ ] Request duration histogram
- [ ] Transaction counters (by type, status)
- [ ] Database connection pool gauge
- [ ] Structured logging with pino

### Infrastructure

- [ ] Grafana dashboards created
- [ ] Prometheus scraping configured
- [ ] Alert rules defined
- [ ] Telegram alerting configured
- [ ] External uptime monitoring (UptimeRobot)
- [ ] Log aggregation setup (if needed)

### Business Metrics

- [ ] Daily active users (DAU)
- [ ] Transaction volume
- [ ] Revenue tracking
- [ ] Top stores by transactions
- [ ] QR scan success rate
- [ ] Offline sync queue size

---

## 10. Performance Optimization

### When Metrics Show Issues

**High Error Rate**:
- Add more specific error handling
- Improve input validation
- Add retries for transient errors
- Use circuit breakers for external APIs

**High Latency**:
- Add database indexes
- Implement caching (Redis)
- Optimize N+1 queries
- Use CDN for static assets

**High Memory Usage**:
- Check for memory leaks (heap snapshots)
- Optimize image sizes
- Implement pagination
- Clear unused cache entries

**Low Cache Hit Rate**:
- Increase TTL (if data doesn't change often)
- Add more cache keys
- Pre-warm cache on startup
- Use stale-while-revalidate pattern

---

## Resources

- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
- [Prometheus Naming](https://prometheus.io/docs/practices/naming/)
- [Web Vitals](https://web.dev/vitals/)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
