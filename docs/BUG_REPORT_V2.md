# Bug Report V2 - Admin Panel Business Logic Audit

**Date:** 2025-12-17
**Version:** Phase 7 Complete (Post-Audit #1)
**Severity Levels:** CRITICAL, HIGH, MEDIUM, LOW
**Focus:** Business Logic Verification

---

## Summary

Second audit focused on business logic correctness and data flow consistency.

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| HIGH     | 3     | 3     | 0         |
| MEDIUM   | 2     | 1     | 1         |
| LOW      | 1     | 0     | 1         |
| **TOTAL**| **6** | **4** | **2**     |

---

## HIGH Severity Bugs

### BUG-011: Theme/Settings Not Persisted to Database

**Severity:** HIGH
**Location:**
- `frontend-astro/src/components/admin/ThemeEditor.svelte:127-132`
- `frontend-astro/src/components/admin/SiteSettings.svelte:115`
**Impact:** Settings lost on browser clear or different device/browser

**Description:**
Both ThemeEditor and SiteSettings save data to `localStorage` only. Comments in code mention "In production, save to database via API" but no API endpoints exist.

```javascript
// ThemeEditor.svelte:127-132
async function saveTheme() {
  // For now, save to localStorage
  // In production, this would save to the database
  localStorage.setItem('themeOverrides', JSON.stringify(themeData));
}

// SiteSettings.svelte:115
localStorage.setItem('siteSettings', JSON.stringify(settings));
```

**Business Logic Issue:**
- Users expect settings to persist across sessions and devices
- Data stored in localStorage is browser-specific and volatile
- No server-side validation of settings values

**Fix Required:**
Create API endpoints for theme/settings storage:
1. `GET/PUT /api/admin/settings/theme`
2. `GET/PUT /api/admin/settings/site`
Store in database (new `SiteSettings` table)

---

### BUG-012: Media API Missing Authentication

**Severity:** HIGH
**Location:** `backend-hono/src/routes/media.ts`
**Impact:** Security vulnerability - unauthorized file operations

**Description:**
The media routes don't apply any authentication middleware. Unlike pages API which has `authMiddleware` and `editorOrAdmin`, media routes are completely unprotected.

```typescript
// pages.ts (correct)
pages.use('*', authMiddleware);
pages.use('*', editorOrAdmin);

// media.ts (missing auth)
const media = new Hono();
// No auth middleware!
```

**Business Logic Issue:**
- Anyone can upload files to the server
- Anyone can delete any media file
- Anyone can list all media files
- Potential for abuse, spam uploads, or data deletion

**Fix Required:**
Add authentication middleware to media routes:
```typescript
import { authMiddleware, editorOrAdmin } from '../middleware/auth';
media.use('*', authMiddleware);
media.use('*', editorOrAdmin);
```

---

### BUG-013: SectionEditor Missing Form Inputs for Many Fields

**Severity:** HIGH
**Location:** `frontend-astro/src/components/admin/SectionEditor.svelte:521-704`
**Impact:** Cannot edit many section properties through admin panel

**Description:**
The `sectionMeta` object defines fields for each section type (lines 68-196), but the template only has form inputs for a subset of these fields. Many critical fields cannot be edited.

**Fields defined in sectionMeta but missing form inputs:**

| Section Type | Missing Fields |
|-------------|----------------|
| hero | align, height, overlay, overlayOpacity |
| textBlock | content (Markdown textarea) |
| longread | content, showToc, tocTitle |
| videoYouTube | videoId, aspectRatio |
| videoLocal | src, poster, autoplay, muted, loop, controls |
| cta | buttonText, buttonHref, variant |
| contactForm | submitText, successMessage |
| partners | grayscale |

**Business Logic Issue:**
- Users add sections but cannot configure key properties
- Section defaults are used but never editable
- Incomplete editing capability renders some sections useless

**Fix Required:**
Add form inputs for all fields defined in `sectionMeta`:
- Content textarea for textBlock/longread with Markdown preview
- Video URL inputs for videoYouTube/videoLocal
- Boolean toggles for autoplay, muted, loop, overlay, grayscale
- Select dropdowns for align, height, variant, aspectRatio

---

## MEDIUM Severity Bugs

### BUG-014: CTA Field Naming Inconsistency

**Severity:** MEDIUM
**Location:** `frontend-astro/src/components/admin/SectionEditor.svelte:561-587`
**Impact:** CTA button fields not editable for hero and cta sections

**Description:**
Different sections use different field names for CTA buttons, but the template only checks for one naming convention:

**hero section:**
- Defines: `ctaText`, `ctaHref`
- Template checks: `hasField('ctaText')` ✓, `hasField('ctaLink')` ✗

**cta section:**
- Defines: `buttonText`, `buttonHref`
- Template checks: `hasField('ctaText')` ✗, `hasField('ctaLink')` ✗

```svelte
<!-- Line 561-587: Only checks ctaText/ctaLink -->
{#if hasField('ctaText') || hasField('ctaLink')}
  <!-- Hero has ctaHref not ctaLink - partial match -->
  <!-- CTA has buttonText/buttonHref - no match at all -->
{/if}
```

**Business Logic Issue:**
- Hero section: ctaHref field can't be edited (only ctaText shows)
- CTA section: buttonText/buttonHref can't be edited at all
- Users can add CTA sections but can't configure the buttons

**Fix Required:**
Add conditional handling for different CTA field names:
```svelte
{#if hasField('ctaText') || hasField('ctaHref')}
  <!-- hero CTA -->
{/if}
{#if hasField('buttonText') || hasField('buttonHref')}
  <!-- cta section buttons -->
{/if}
```

---

### BUG-015: BUG-008 Was False Positive

**Severity:** MEDIUM (Clarification)
**Location:** `frontend-astro/src/components/admin/MediaGallery.svelte:111`
**Status:** NOT A BUG - Path construction is correct

**Description:**
BUG-008 from first audit claimed delete path was wrong, but analysis shows it's correct:

```javascript
// MediaGallery.svelte:111
await fetch(`/api/media${file.path}`, { method: 'DELETE' });

// file.path is like: /images/filename.jpg
// Full URL becomes: /api/media/images/filename.jpg

// Backend route expects: /:type/:filename
// /api/media/images/filename.jpg matches /api/media/:type/:filename ✓
```

**Action:** Remove BUG-008 from bug tracking.

---

## LOW Severity Bugs

### BUG-016: No Token Validation on Login Page Redirect

**Severity:** LOW
**Location:** `frontend-astro/src/pages/admin/login.astro` (client script)
**Impact:** Possible redirect loop with expired token

**Description:**
Login page checks for accessToken presence but doesn't verify if the token is valid:

```javascript
// Login page redirect logic
const accessToken = localStorage.getItem('accessToken');
if (accessToken) {
  window.location.href = '/admin';  // Redirects without validating token
}
```

**Business Logic Issue:**
- User has expired token in localStorage
- Login page redirects to /admin
- Admin page rejects expired token, redirects to /login
- Possible redirect loop until token cleared manually

**Fix Required:**
Either:
1. Verify token with `/api/auth/me` before redirecting
2. Or let admin pages handle the redirect (current behavior may work)

---

## Verification Status

| Bug | Status | Priority |
|-----|--------|----------|
| BUG-011 | DEFERRED | Requires schema changes |
| BUG-012 | **FIXED** | Security fix applied |
| BUG-013 | **FIXED** | SectionEditor fields added |
| BUG-014 | **FIXED** | CTA field naming fixed |
| BUG-015 | CLARIFIED | Not a bug |
| BUG-016 | OPEN | Low Priority |

---

## Fixes Applied (2025-12-17)

### BUG-012 Fix
- Added `authMiddleware` and `editorOrAdmin` to `backend-hono/src/routes/media.ts`
- Updated `MediaGallery.svelte` to send Authorization header on all requests
- Upload, delete, and list operations now require authentication

### BUG-013/014 Fix
- Added ~250 lines of form inputs to `SectionEditor.svelte` for all missing fields:
  - Content textarea for textBlock/longread with Markdown support
  - Video fields: videoId, src, poster, aspectRatio
  - Video options: autoplay, muted, loop, controls
  - Hero fields: align, height, overlay, overlayOpacity
  - CTA fields: ctaHref, ctaText, ctaSecondaryText, ctaSecondaryHref
  - CTA section: buttonText, buttonHref, secondaryText, secondaryHref
  - ContactForm: submitText, successMessage
  - Partners: grayscale
  - Layout/variant selectors
  - Added corresponding CSS styles

---

## Remaining Issues

1. **BUG-011** - Theme/Settings persistence requires database schema changes (deferred)
2. **BUG-016** - Token validation on login page (low priority, current behavior acceptable)
