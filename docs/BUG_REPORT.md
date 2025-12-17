# Bug Report - Landing Builder Audit

**Date:** 2025-12-17
**Version:** Phase 7 Complete
**Severity Levels:** CRITICAL, HIGH, MEDIUM, LOW
**Status:** FIXED (2025-12-17)

---

## CRITICAL Bugs

### BUG-001: Section Types Mismatch (PageEditor.svelte) - FIXED

**Severity:** CRITICAL
**Location:** `frontend-astro/src/components/admin/PageEditor.svelte:77-107`
**Impact:** Users cannot add real sections from admin panel
**Status:** FIXED - Replaced sectionTypes with correct 23 section types

**Description:**
The `sectionTypes` array in PageEditor defines section types that DO NOT exist in the actual implementation. The admin panel shows non-existent sections while hiding real ones.

**Wrong types defined in PageEditor:**
- `hero-split` (NOT IMPLEMENTED)
- `hero-video` (NOT IMPLEMENTED)
- `features-alt` (NOT IMPLEMENTED)
- `features-icons` (NOT IMPLEMENTED)
- `pricing-toggle` (NOT IMPLEMENTED)
- `testimonials-carousel` (NOT IMPLEMENTED)
- `cta-split` (NOT IMPLEMENTED)
- `faq-columns` (NOT IMPLEMENTED)
- `contact` (should be `contactForm`)
- `contact-map` (NOT IMPLEMENTED)
- `gallery` (should be `photoGallery`)
- `gallery-masonry` (NOT IMPLEMENTED)
- `logos` (should be `partners`)
- `social-feed` (should be `instagramFeed`)
- `social-proof` (NOT IMPLEMENTED)

**Real sections from sections.ts:**
1. `hero` - Hero
2. `heroMin` - HeroMin
3. `textBlock` - TextBlock
4. `snippet` - Snippet
5. `longread` - Longread
6. `photoGallery` - PhotoGallery
7. `photoSlider` - PhotoSlider
8. `videoYouTube` - VideoYouTube
9. `videoLocal` - VideoLocal
10. `mediaMix` - MediaMix
11. `cta` - CTA
12. `faq` - FAQ
13. `contactForm` - ContactForm
14. `pricing` - Pricing
15. `compareTable` - CompareTable
16. `testimonials` - Testimonials
17. `features` - Features
18. `timeline` - Timeline
19. `stats` - Stats
20. `team` - Team
21. `partners` - Partners
22. `instagramFeed` - InstagramFeed

**Fix Required:**
Replace entire `sectionTypes` array with correct types from `sectionsRegistry` in `lib/sections.ts`.

---

### BUG-002: Section Types Mismatch (SectionEditor.svelte) - FIXED

**Severity:** CRITICAL
**Location:** `frontend-astro/src/components/admin/SectionEditor.svelte:68-196`
**Impact:** Section editor cannot properly edit real sections
**Status:** FIXED - Replaced sectionMeta with correct types, added itemsKey support

**Description:**
The `sectionMeta` object in SectionEditor defines metadata for non-existent sections and misses metadata for real sections. This means when a user tries to edit a real section, the editor falls back to a generic "📦 Unknown" display and only shows title/description fields.

**Same issue as BUG-001** - the metadata doesn't match real section types.

**Fix Required:**
Replace entire `sectionMeta` object with correct types and fields based on actual section interfaces in `lib/parser.ts`.

---

### BUG-003: Missing FacebookPost in Section Registry - FIXED

**Severity:** CRITICAL
**Location:** `frontend-astro/src/lib/sections.ts`
**Impact:** FacebookPost section cannot be added via admin
**Status:** FIXED - Added facebookPost to sectionsRegistry

**Description:**
- `FacebookPost.astro` exists in `components/sections/`
- `FacebookPostSection` interface exists in `parser.ts`
- BUT `facebookPost` is NOT registered in `sectionsRegistry`

This means:
1. FacebookPost cannot be selected in section picker
2. 23 sections exist but registry only has 22
3. Inconsistency between components and registry

**Fix Required:**
Add FacebookPost to sectionsRegistry:
```typescript
{
  type: 'facebookPost',
  name: 'Facebook Post',
  description: 'Пост в стиле Facebook',
  category: 'social',
  icon: 'brand-facebook',
  component: 'FacebookPost',
  defaultProps: {
    type: 'facebookPost',
    author: { name: '', avatar: '' },
    date: '',
    content: '',
  },
}
```

---

## HIGH Bugs

### BUG-004: Dashboard Section Library Shows Wrong Information - FIXED

**Severity:** HIGH
**Location:** `frontend-astro/src/components/admin/Dashboard.svelte:238-270`
**Impact:** Users see misleading information about available sections
**Status:** FIXED - Updated section library to show correct 6 categories

**Description:**
The "Библиотека секций" preview in Dashboard shows:
- "Hero, Split, Video" (Split and Video don't exist)
- "Grid, Alt, Icons" for Features (Alt and Icons don't exist)
- "Basic, Toggle" for Pricing (Toggle doesn't exist)
- Wrong groupings overall

**Fix Required:**
Update section library preview to show actual sections grouped by real categories from `sections.ts`.

---

### BUG-005: Section Editor Item Types Mismatch - FIXED

**Severity:** HIGH
**Location:** `frontend-astro/src/components/admin/SectionEditor.svelte:707-854`
**Impact:** Item editing forms don't match actual section data structures
**Status:** FIXED - Updated to exact type matches and correct field structures

**Description:**
The conditional rendering for item fields uses wrong type checks:
- `section.type.includes('pricing')` - won't match `pricing` exactly
- `section.type.includes('testimonial')` - won't match `testimonials`
- `section.type.includes('gallery')` - won't match `photoGallery`

Also, the item field structure doesn't match actual section interfaces in `parser.ts`:
- Testimonials use `author`, `content`, `role`, `avatar`, `rating` (not `name`, `quote`)
- Pricing uses `plans[]` with `name`, `price`, `period`, `features`, `ctaText`, `ctaHref`, `highlighted`

**Fix Required:**
Update type checks to exact matches and align item fields with actual parser.ts interfaces.

---

## MEDIUM Bugs

### BUG-006: Edit Section Link Broken for New Pages - FIXED

**Severity:** MEDIUM
**Location:** `frontend-astro/src/components/admin/PageEditor.svelte:528-545`
**Impact:** Clicking "Edit Section" on unsaved new page causes broken link
**Status:** FIXED - Shows disabled button with tooltip when pageId is undefined

**Description:**
```svelte
<a href={`/admin/pages/${pageId}/sections/${index}`} ...>
```
When creating a NEW page (pageId is undefined), clicking the edit section link navigates to `/admin/pages/undefined/sections/0` which returns 404.

**Fix Required:**
Either:
1. Disable edit section link when pageId is undefined
2. Or require saving page before allowing section editing
3. Or implement inline section editing

---

### BUG-007: Generate Slug Doesn't Handle Cyrillic - FIXED

**Severity:** MEDIUM
**Location:** `frontend-astro/src/components/admin/PageEditor.svelte:207-228`
**Impact:** Russian page titles generate empty slugs
**Status:** FIXED - Added Cyrillic transliteration map

**Description:**
```javascript
page.slug = page.title
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '') // This removes ALL Cyrillic characters
```

If title is "Главная страница", slug becomes empty string.

**Fix Required:**
Add transliteration for Cyrillic characters:
```javascript
function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', ...
  };
  // implement transliteration
}
```

---

### BUG-008: Media Gallery Delete Uses Wrong Path

**Severity:** MEDIUM
**Location:** `frontend-astro/src/components/admin/MediaGallery.svelte:111`
**Impact:** Delete request may fail if file.path includes leading slash

**Description:**
```javascript
const res = await fetch(`/api/media${file.path}`, { method: 'DELETE' });
```
If `file.path` is `/uploads/image.jpg`, URL becomes `/api/media/uploads/image.jpg`.
But if API expects `/api/media/image.jpg`, delete will fail.

**Fix Required:**
Verify API route structure and ensure path construction is correct.

---

## LOW Bugs

### BUG-009: Missing Authentication Check in Media Routes

**Severity:** LOW
**Location:** `frontend-astro/src/components/admin/MediaGallery.svelte:52-62`
**Impact:** Potential unauthorized access to media listing

**Description:**
The `loadFiles()` function calls `/api/media` without Authorization header, but it also doesn't redirect to login if response is 401.

**Fix Required:**
Add token to media API calls or handle 401 response.

---

### BUG-010: Dashboard Greeting Only in Russian

**Severity:** LOW
**Location:** `frontend-astro/src/components/admin/Dashboard.svelte:115-120`
**Impact:** No i18n support

**Description:**
Hardcoded Russian greetings. Consider making it configurable or following site language settings.

---

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 3     | 3     | 0         |
| HIGH     | 2     | 2     | 0         |
| MEDIUM   | 3     | 2     | 1         |
| LOW      | 2     | 0     | 2         |
| **TOTAL**| **10**| **7** | **3**     |

---

## Fix Status

| Bug | Status | Description |
|-----|--------|-------------|
| BUG-001 | FIXED | Section types in PageEditor |
| BUG-002 | FIXED | Section types in SectionEditor |
| BUG-003 | FIXED | Missing FacebookPost in registry |
| BUG-004 | FIXED | Dashboard section library |
| BUG-005 | FIXED | Section editor item types |
| BUG-006 | FIXED | Edit section link |
| BUG-007 | FIXED | Cyrillic slug generation |
| BUG-008 | OPEN | Media delete path (needs verification) |
| BUG-009 | OPEN | Media auth check (low priority) |
| BUG-010 | OPEN | Hardcoded Russian (low priority) |
