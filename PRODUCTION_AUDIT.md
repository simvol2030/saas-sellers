# Production Audit Report - Landing Builder

**Date:** 2025-12-17
**Auditor:** Claude Code
**Scope:** Full system audit for production readiness

---

## Executive Summary

The Landing Builder application has a solid foundation but contains **critical architectural issues** that must be resolved before production deployment.

| Severity | Count | Action Required |
|----------|-------|-----------------|
| CRITICAL | 4     | Must fix before deployment |
| HIGH     | 5     | Should fix before deployment |
| MEDIUM   | 3     | Recommended improvements |
| LOW      | 2     | Nice to have |

---

## CRITICAL Issues

### ISSUE-001: Schema Mismatch - Blog Models Don't Exist
**Severity:** CRITICAL
**Impact:** API routes will crash at runtime
**Location:** `backend-hono/src/routes/posts.ts`, `categories.ts`, `tags.ts`

**Problem:**
The backend has routes for `posts`, `categories`, `tags` that reference Prisma models from an OLD schema at `/prisma/schema.prisma`, but the backend uses a DIFFERENT schema at `/backend-hono/prisma/schema.prisma` which doesn't have these models.

```
Routes expecting:        Current schema has:
- Post                   - User (with password)
- Category               - Session
- Tag                    - Page
- PostTag                - Media
- Comment                - SiteSetting
                         - ThemeOverride
```

**Fix Options:**
1. **RECOMMENDED:** Remove unused routes (posts, categories, tags) - Landing Builder doesn't need them
2. OR merge schemas and regenerate migrations

---

### ISSUE-002: Users API Creates Users Without Password
**Severity:** CRITICAL (Security)
**Impact:** Bypasses authentication, creates unusable accounts
**Location:** `backend-hono/src/routes/users.ts:48-62`

**Problem:**
```typescript
users.post('/', zValidator('json', createUserSchema), async (c) => {
  const user = await prisma.user.create({
    data: {
      email: validated.email,
      name: validated.name  // NO PASSWORD!
    }
  });
});
```

The `createUserSchema` only validates `email` and `name`, ignoring the required `password` field.

**Fix:**
1. Remove `/api/users` route entirely - user creation should only be via `/api/auth/register`
2. OR add password hashing to users route (but this duplicates auth logic)

---

### ISSUE-003: No Authentication on Content Routes
**Severity:** CRITICAL (Security)
**Impact:** Anyone can create/modify/delete posts, categories, tags
**Location:**
- `backend-hono/src/routes/posts.ts`
- `backend-hono/src/routes/categories.ts`
- `backend-hono/src/routes/tags.ts`

**Problem:**
These routes have NO `authMiddleware` applied. Any anonymous user can:
- Create/delete posts
- Create/delete categories
- Create/delete tags

**Fix:**
Since these routes reference non-existent models, the recommended fix is to remove them entirely (see ISSUE-001).

---

### ISSUE-004: Settings and Theme Not Persisted to Database
**Severity:** CRITICAL (Data Loss)
**Impact:** Settings lost on browser clear/change, not shared across users
**Location:**
- `frontend-astro/src/components/admin/SiteSettings.svelte:95-100`
- `frontend-astro/src/components/admin/ThemeEditor.svelte`

**Problem:**
```javascript
function loadSettings() {
  const saved = localStorage.getItem('siteSettings');  // Uses localStorage!
  if (saved) {
    settings = { ...defaultSettings, ...JSON.parse(saved) };
  }
}
```

Both components save to `localStorage` instead of the database API. The schema HAS `SiteSetting` and `ThemeOverride` models but NO API routes exist for them.

**Fix:**
1. Create API routes for `/api/admin/settings` and `/api/admin/theme`
2. Update components to use API instead of localStorage

---

## HIGH Severity Issues

### ISSUE-005: Two Conflicting Prisma Schemas
**Severity:** HIGH
**Impact:** Confusion, potential deployment errors
**Location:**
- `/prisma/schema.prisma` (Blog platform - UNUSED)
- `/backend-hono/prisma/schema.prisma` (Landing Builder - ACTIVE)

**Problem:**
Two completely different schemas exist in the project. The root `/prisma/schema.prisma` is for a blog platform but the backend uses `/backend-hono/prisma/schema.prisma`.

**Fix:**
Delete `/prisma/schema.prisma` and its migrations to avoid confusion.

---

### ISSUE-006: Media Files Not Tracked in Database
**Severity:** HIGH
**Impact:** Orphan files, no metadata, can't track who uploaded what
**Location:** `backend-hono/src/routes/media.ts`

**Problem:**
Media files are stored on filesystem but NOT recorded in the `Media` table. The schema has a complete Media model with metadata fields, but the route only uses filesystem operations.

**Fix:**
Update media route to save file metadata to database after upload.

---

### ISSUE-007: No API Route for Public Pages List
**Severity:** HIGH
**Impact:** Can't build sitemap, navigation from published pages
**Location:** `backend-hono/src/routes/public-pages.ts`

**Problem:**
Currently only `GET /api/pages/:slug` exists for public pages. No endpoint to list all published pages for:
- Sitemap generation
- Dynamic navigation
- Page listings

**Fix:**
Add `GET /api/pages` endpoint that returns list of published pages (already implemented in previous fix).

---

### ISSUE-008: Rate Limiting Too Strict for Admin
**Severity:** HIGH
**Impact:** Admin may get blocked during intensive work
**Location:** `backend-hono/src/index.ts:34-40`

**Problem:**
```typescript
app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per window
}));
```

100 requests per 15 minutes is very restrictive. Admin editing pages with autosave can easily exceed this.

**Fix:**
1. Increase limit for authenticated users
2. OR exclude admin routes from rate limiting
3. OR use different limits per route category

---

### ISSUE-009: No CSRF Protection
**Severity:** HIGH (Security)
**Impact:** Cross-site request forgery attacks possible
**Location:** Backend API

**Problem:**
No CSRF tokens are used. Since the API uses cookies (credentials: true) for CORS, CSRF attacks are possible.

**Fix:**
1. Implement CSRF tokens for state-changing operations
2. OR use strict SameSite cookie policy
3. OR require custom header for API calls

---

## MEDIUM Severity Issues

### ISSUE-010: Hardcoded JWT Secret Fallback
**Severity:** MEDIUM (Security)
**Impact:** Predictable tokens if ENV not set
**Location:** `backend-hono/src/lib/jwt.ts:10`

**Problem:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
```

**Fix:**
Throw error if JWT_SECRET is not set in production environment.

---

### ISSUE-011: No Input Sanitization for Markdown Content
**Severity:** MEDIUM (Security)
**Impact:** Potential XSS in rendered markdown
**Location:** Section components that render markdown

**Problem:**
TextBlock and Longread sections render markdown content without sanitization. If markdown contains malicious HTML/JS, it could execute.

**Fix:**
Use a markdown parser with HTML sanitization (e.g., DOMPurify).

---

### ISSUE-012: No Session Cleanup
**Severity:** MEDIUM (Performance)
**Impact:** Sessions table grows indefinitely
**Location:** `backend-hono/src/routes/auth.ts`

**Problem:**
Expired sessions are only deleted when a refresh is attempted. No background cleanup exists.

**Fix:**
Add a scheduled job or startup cleanup for expired sessions:
```typescript
await prisma.session.deleteMany({
  where: { expiresAt: { lt: new Date() } }
});
```

---

## LOW Severity Issues

### ISSUE-013: Missing Database Indexes
**Severity:** LOW
**Impact:** Slower queries as data grows

The schema has good indexes, but could add:
- `@@index([status, publishedAt])` on Page for listing queries

---

### ISSUE-014: No API Versioning
**Severity:** LOW
**Impact:** Difficult to evolve API without breaking clients

All routes are under `/api/` without version. Consider `/api/v1/` for future flexibility.

---

## Recommendations Summary

### Must Do Before Production:
1. ❌ Remove or fix posts/categories/tags routes (ISSUE-001)
2. ❌ Remove users.ts route (ISSUE-002)
3. ❌ Create settings/theme API routes (ISSUE-004)
4. ❌ Delete old prisma schema (ISSUE-005)

### Should Do Before Production:
5. ⚠️ Save media metadata to database (ISSUE-006)
6. ⚠️ Adjust rate limiting for admin (ISSUE-008)
7. ⚠️ Add CSRF protection (ISSUE-009)
8. ⚠️ Validate JWT_SECRET in production (ISSUE-010)

### Recommended:
9. 📋 Sanitize markdown output (ISSUE-011)
10. 📋 Add session cleanup (ISSUE-012)

---

## Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `backend-hono/src/index.ts` | Remove posts/categories/tags/users routes | CRITICAL |
| `backend-hono/src/routes/posts.ts` | DELETE | CRITICAL |
| `backend-hono/src/routes/categories.ts` | DELETE | CRITICAL |
| `backend-hono/src/routes/tags.ts` | DELETE | CRITICAL |
| `backend-hono/src/routes/users.ts` | DELETE | CRITICAL |
| `/prisma/` | DELETE entire directory | HIGH |
| `backend-hono/src/routes/settings.ts` | CREATE | CRITICAL |
| `backend-hono/src/routes/theme.ts` | CREATE | CRITICAL |
| `frontend-astro/.../SiteSettings.svelte` | Update to use API | CRITICAL |
| `frontend-astro/.../ThemeEditor.svelte` | Update to use API | CRITICAL |
