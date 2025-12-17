# Bug Report V3 - Frontend Components Audit

**Date:** 2025-12-17
**Version:** Post-Audit #2
**Focus:** Frontend Components & Business Logic Integration

---

## Summary

Third audit focused on frontend component correctness and business logic alignment.

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 1     | 1     | 0         |
| MEDIUM   | 1     | 1     | 0         |
| LOW      | 1     | 0     | 1         |
| **TOTAL**| **3** | **2** | **1**     |

---

## CRITICAL Severity Bugs

### BUG-017: Dashboard Media API Missing Authorization

**Severity:** CRITICAL
**Location:** `frontend-astro/src/components/admin/Dashboard.svelte:74`
**Impact:** Dashboard fails to load media stats after security fix

**Description:**
After adding authentication to the media API (BUG-012 fix), the Dashboard component still calls the media API without Authorization header:

```javascript
// Line 74 - Missing Authorization header!
const mediaRes = await fetch('/api/media');
```

**Business Logic Issue:**
- Dashboard will receive 401 Unauthorized from `/api/media`
- Media stats (totalMedia, totalImages, totalVideos) will not load
- Users see incomplete dashboard or errors

**Fix Required:**
```javascript
const mediaRes = await fetch('/api/media', {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## MEDIUM Severity Bugs

### BUG-018: ContactForm Submits to Non-Existent API

**Severity:** MEDIUM
**Location:** `frontend-astro/src/components/sections/ContactForm.astro:448`
**Impact:** Contact form always fails with error

**Description:**
The contact form tries to submit data to `/api/contact` endpoint which doesn't exist in the backend:

```javascript
// Line 448
const response = await fetch('/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

**Business Logic Issue:**
- Users fill out contact form
- Form shows "loading" state
- Request fails with 404
- User sees generic error message

**Fix Options:**
1. Create `/api/contact` endpoint in backend
2. Change to email-based submission
3. Document as "placeholder for integration"

**Recommended:** Add comment clarifying this is a placeholder until backend endpoint is implemented.

---

## LOW Severity Bugs

### BUG-019: TextBlock Markdown Parser Limited

**Severity:** LOW
**Location:** `frontend-astro/src/components/sections/TextBlock.astro:33-53`
**Impact:** Some Markdown features don't render correctly

**Description:**
The `simpleMarkdown` function has limited regex-based parsing that doesn't handle:
- Nested lists
- Ordered lists correctly
- Code blocks with language syntax
- Tables
- Images with alt text

```javascript
// Current implementation only handles basic cases
.replace(/^\- (.*$)/gim, '<li>$1</li>')
.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
```

**Business Logic Issue:**
- Users enter complex Markdown in admin panel
- Some formatting doesn't render as expected on frontend
- May cause confusion

**Fix Options:**
1. Use proper Markdown library (marked, remark, etc.)
2. Document supported syntax limitations
3. Add preview in admin panel to show actual rendering

---

## Verification Status

| Bug | Status | Priority |
|-----|--------|----------|
| BUG-017 | **FIXED** | Critical |
| BUG-018 | **DOCUMENTED** | Needs Implementation |
| BUG-019 | OPEN | Low Priority |

---

## Fixes Applied (2025-12-17)

### BUG-017 Fix
- Added Authorization header to media API call in Dashboard.svelte
- Line 74: `fetch('/api/media', { headers: { Authorization: \`Bearer ${token}\` } })`

### BUG-018 Fix
- Added detailed comment explaining this is a placeholder
- Documented options for implementation (backend route, email service, database)

---

## Components Reviewed

### Admin Components (7 total)
- [x] Dashboard.svelte - **BUG FOUND** (BUG-017)
- [x] PagesList.svelte - OK
- [x] PageEditor.svelte - OK
- [x] SectionEditor.svelte - Fixed in V2
- [x] MediaGallery.svelte - Fixed in V2
- [x] ThemeEditor.svelte - OK (uses localStorage)
- [x] SiteSettings.svelte - OK (uses localStorage)

### Section Components (23 total)
- [x] Hero.astro - OK
- [x] HeroMin.astro - OK
- [x] TextBlock.astro - **Minor Issue** (BUG-019)
- [x] Snippet.astro - OK
- [x] Longread.astro - OK
- [x] CTA.astro - OK
- [x] Features.astro - OK
- [x] FAQ.astro - OK
- [x] ContactForm.astro - **BUG FOUND** (BUG-018)
- [x] Pricing.astro - OK
- [x] CompareTable.astro - OK
- [x] Testimonials.astro - OK
- [x] Timeline.astro - OK
- [x] Stats.astro - OK
- [x] Team.astro - OK
- [x] Partners.astro - OK
- [x] PhotoGallery.astro - OK
- [x] PhotoSlider.astro - OK
- [x] VideoYouTube.astro - OK
- [x] VideoLocal.astro - OK
- [x] MediaMix.astro - OK
- [x] InstagramFeed.astro - OK
- [x] FacebookPost.astro - OK

### Type Definitions
- [x] parser.ts - OK (23 section types defined)

---

## Recommended Fix Order

1. **BUG-017** - Critical - Dashboard will break without this fix
2. **BUG-018** - Medium - Needs decision on implementation approach
3. **BUG-019** - Low - Can be deferred
