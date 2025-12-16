# Stage-by-Stage Checklists for Migration Protocol v3.0

This document contains detailed checklists for each stage of the Static → SvelteKit migration protocol.

## 📋 Stage 0: Inventory Check (CRITICAL)

**Time**: 5 minutes
**Purpose**: Create context for all agents to prevent duplication

### Checklist:

- [ ] Scan existing layout components (`src/lib/components/layout/`)
  - [ ] Document Header, Footer, MobileMenu if they exist
- [ ] Scan existing UI components (`src/lib/components/ui/`)
  - [ ] List all reusable components (ProductCard, CategoryCard, etc.)
- [ ] Extract existing TypeScript interfaces (`src/lib/types/index.ts`)
  - [ ] Note all exported interfaces
  - [ ] Identify which can be extended vs recreated
- [ ] List existing mock data files (`src/lib/data/mock/`)
  - [ ] Note file names and what they contain
- [ ] List existing data providers (`src/lib/data-providers/`)
  - [ ] Document available methods

### Output Format:

```typescript
{
  existing: {
    layout: ["Header", "Footer", "MobileMenu"],
    ui: ["ProductCard", "CategoryCard", "BlogCard", "Slider"],
    types: ["Product", "Category", "BlogPost", "Review"],
    mockData: ["products.json", "categories.json", "blog.json"],
    dataProviders: ["products.ts", "categories.ts", "blog.ts"]
  }
}
```

---

## 📋 Stage 1: HTML/CSS/JS Analysis

**Agent**: `static-to-svelte-analyzer`
**Time**: 7-10 minutes

### Pre-Agent Checklist:

- [ ] **Stage 0 completed** (inventory exists)
- [ ] **HTML file ready** (static-site_v2/[page].html)
- [ ] **Instruction includes**:
  - [ ] ✅ EXISTING components from Stage 0
  - [ ] ✅ EXISTING types from Stage 0
  - [ ] ✅ EXISTING mock data from Stage 0
  - [ ] ❌ DO NOT analyze Header/Footer/MobileMenu
  - [ ] ❌ DO NOT duplicate existing interfaces
  - [ ] ❌ DO NOT suggest creating existing components
  - [ ] 📏 Line limit: <1500 lines for output
- [ ] **Expected output**: `analysis/[page]-structure.md`

### Post-Agent Checklist:

- [ ] **Output file exists** (`analysis/[page]-structure.md`)
- [ ] **File size check**: <1500 lines
- [ ] **Content includes**:
  - [ ] List of NEW page-specific components only
  - [ ] Plan to EXTEND existing interfaces (not recreate)
  - [ ] Plan to REUSE existing components
  - [ ] Clear separation: NEW vs REUSE
- [ ] **No duplication**:
  - [ ] Does not suggest creating ProductCard if it exists
  - [ ] Does not suggest new Product interface if one exists
  - [ ] References existing components for reuse

---

## 📋 Stage 2: Mock Data Generation

**Agent**: `mock-data-generator`
**Time**: 5-7 minutes

### Stage 2.1: New Files

#### Pre-Agent Checklist:

- [ ] **Stage 0 completed** (existing mock files known)
- [ ] **Instruction includes**:
  - [ ] ❌ DO NOT CREATE for each existing file:
    - [ ] products.json (if exists)
    - [ ] categories.json (if exists)
    - [ ] blog.json (if exists)
  - [ ] ✅ CREATE ONLY new files identified in analysis
  - [ ] 📏 Entry limit: 10-15 records per file
  - [ ] 📏 Size limit: <5000 lines total
  - [ ] 🌐 Language: Russian for text fields
  - [ ] 🗄️ DB-ready structure (id, foreign keys, ISO timestamps)

#### Post-Agent Checklist:

- [ ] **No existing files overwritten**:
  - [ ] products.json unchanged (if existed)
  - [ ] categories.json unchanged (if existed)
  - [ ] blog.json unchanged (if existed)
- [ ] **New files created only**:
  - [ ] reviews.json (if needed)
  - [ ] deliveryOptions.json (if needed)
  - [ ] Other new files as identified
- [ ] **File structure validation**:
  - [ ] Each file is valid JSON
  - [ ] Each file contains array of objects
  - [ ] Each object has "id" field
  - [ ] Entry count ≤15 per file
  - [ ] Foreign keys reference existing data
- [ ] **Size check**: Total lines <5000

### Stage 2.2: Extending Existing Files (Manual)

#### Checklist:

- [ ] **Identify which existing files need extension**
  - [ ] Example: products.json needs new fields (imagesDetailed, availableColors)
- [ ] **Manually add fields to 1-2 sample entries**
- [ ] **Validate JSON structure** after edits
- [ ] **Document extended fields** for Stage 3 (TypeScript types)

---

## 📋 Stage 3: TypeScript Types (Manual)

**Time**: 3-5 minutes

### Checklist:

- [ ] **Open** `src/lib/types/index.ts`
- [ ] **For existing interfaces** (e.g., Product):
  - [ ] EXTEND with new optional fields
  - [ ] DO NOT create duplicate interface
  - [ ] Mark new fields as optional (?)
  - [ ] Example: `imagesDetailed?: string[];`
- [ ] **For new interfaces**:
  - [ ] CREATE only if doesn't exist
  - [ ] Use proper TypeScript conventions
  - [ ] Export all interfaces
  - [ ] Example: `export interface Review { ... }`
- [ ] **Validation**:
  - [ ] No duplicate interface names
  - [ ] All interfaces exported
  - [ ] Consistent naming (PascalCase)
  - [ ] Optional fields marked with ?

### Common New Interfaces:

```typescript
// Example checklist for product page:
- [ ] ProductBadge (if not exists)
- [ ] ColorOption (if not exists)
- [ ] MemoryOption (if not exists)
- [ ] Specification (if not exists)
- [ ] Review (if not exists)
- [ ] DeliveryOption (if not exists)
```

---

## 📋 Stage 4: UI Components

**Agent**: `ui-components-builder`
**Time**: 10-15 minutes

### Pre-Agent Checklist:

- [ ] **Stage 0 completed** (existing components known)
- [ ] **Stage 3 completed** (TypeScript types ready)
- [ ] **Instruction includes**:
  - [ ] ❌ DO NOT CREATE existing components:
    - [ ] Header, Footer, MobileMenu (if exist)
    - [ ] ProductCard, CategoryCard, etc. (if exist)
  - [ ] ✅ CREATE ONLY from analysis list
  - [ ] 📏 Component size: <200 lines each
  - [ ] 🎨 CSS: Pure CSS with CSS variables (no Tailwind)
  - [ ] ♿ Accessibility: WCAG 2.1 AA compliant
  - [ ] 🔧 Best Practices embedded:
    - [ ] TypeScript: type assertions for dynamic access
    - [ ] Svelte 5: $state, $derived, $effect (NO stores)
    - [ ] Accessibility: proper labels, ARIA, keyboard support
    - [ ] CSS: vendor prefixes + standard properties

### Post-Agent Checklist:

- [ ] **All components created** in `src/lib/components/ui/`
- [ ] **No duplication**:
  - [ ] ProductCard not recreated (if existed)
  - [ ] No duplicate component names
- [ ] **Component quality**:
  - [ ] Size: Each <200 lines
  - [ ] TypeScript: Proper Props interface
  - [ ] Svelte 5: Uses runes (not stores)
  - [ ] CSS: Uses CSS variables
  - [ ] Accessibility: aria-labels on buttons
- [ ] **Export file updated**: `src/lib/components/ui/index.ts`
- [ ] **Best practices check**:
  - [ ] No `<svelte:component>` usage
  - [ ] No `writable()` or `derived()` from stores
  - [ ] Dynamic object access uses type assertions
  - [ ] Icon buttons have aria-label
  - [ ] CSS has both vendor prefix and standard

---

## 📋 Stage 5: Page + Data Providers

**Agent**: `page-data-provider-builder`
**Time**: 10-12 minutes

### Pre-Agent Checklist:

- [ ] **Stage 4 completed** (UI components ready)
- [ ] **Instruction includes**:
  - [ ] ✅ REUSE existing components:
    - [ ] Header, Footer (auto from layout)
    - [ ] ProductCard (for related products)
    - [ ] Slider (for carousels)
  - [ ] ✅ USE new components from Stage 4
  - [ ] ✅ Data providers:
    - [ ] Extend existing (e.g., products.ts)
    - [ ] Create new (e.g., reviews.ts)
  - [ ] ✅ SEO requirements:
    - [ ] title, description
    - [ ] Open Graph tags
    - [ ] Twitter Card
    - [ ] Schema.org JSON-LD
  - [ ] 🛣️ Route structure (e.g., /products/[slug])
  - [ ] 🔧 Error handling (404 for invalid slugs)

### Post-Agent Checklist:

- [ ] **Files created**:
  - [ ] `src/routes/[route]/+page.ts` (data loader)
  - [ ] `src/routes/[route]/+page.svelte` (UI)
  - [ ] New data provider files (if needed)
- [ ] **Data providers**:
  - [ ] Existing providers extended (not duplicated)
  - [ ] New methods added correctly
  - [ ] TypeScript types used
- [ ] **Page structure**:
  - [ ] Imports existing components (ProductCard, Slider)
  - [ ] Uses new components from Stage 4
  - [ ] Svelte 5 runes for state ($state, $derived)
  - [ ] SEO meta tags in <svelte:head>
- [ ] **Reuse validation**:
  - [ ] ProductCard imported from existing location
  - [ ] Not recreated inline
  - [ ] Slider used for carousels

---

## 📋 Stage 6: TypeScript Validation

**Time**: 3-5 minutes

### Checklist:

- [ ] **Run validation**: `npm run check`
- [ ] **Analyze output**:
  - [ ] Count errors
  - [ ] Count warnings
  - [ ] Identify files with errors
- [ ] **Decision**:
  - [ ] **0 errors** → Proceed to Stage 7 ✅
  - [ ] **>0 errors** → Proceed to Stage 6.5

### Stage 6.5: Auto-Fix Errors (if needed)

**Agent**: `typescript-svelte-error-fixer`

#### Pre-Agent Checklist:

- [ ] **npm run check output** captured
- [ ] **Instruction includes**:
  - [ ] 📄 Full npm run check output
  - [ ] ✅ EXISTING interfaces in types/index.ts
  - [ ] ❌ DO NOT create duplicate interfaces
  - [ ] ❌ DO NOT change component structure
  - [ ] ❌ DO NOT remove functionality
  - [ ] ❌ DO NOT modify business logic
  - [ ] ✅ USE existing interfaces from types/index.ts
  - [ ] 🔧 Common fixes:
    - [ ] Type assertions for dynamic keys
    - [ ] Props name corrections
    - [ ] Event handler type fixes

#### Post-Agent Checklist:

- [ ] **Run validation again**: `npm run check`
- [ ] **Target**: 0 errors
- [ ] **Warnings acceptable**: a11y warnings OK
- [ ] **No regressions**:
  - [ ] Functionality preserved
  - [ ] No new errors introduced
  - [ ] Component structure unchanged

---

## 📋 Stage 7: Final Validation

**Time**: 2-3 minutes

### Checklist:

- [ ] **TypeScript**:
  - [ ] `npm run check` → 0 errors ✅
  - [ ] Warnings acceptable (a11y)
- [ ] **Code Quality**:
  - [ ] No duplicate components (0%)
  - [ ] No duplicate interfaces
  - [ ] All EXISTING components reused
- [ ] **Functionality**:
  - [ ] Start dev server: `npm run dev`
  - [ ] Navigate to new page
  - [ ] Test interactive elements
  - [ ] Test responsive design
  - [ ] Verify SEO meta tags (view source)
- [ ] **Page-Specific Tests** (example for product page):
  - [ ] Breadcrumbs render correctly
  - [ ] Image gallery works (click, zoom)
  - [ ] Color/memory selection updates price
  - [ ] Tabs switch correctly
  - [ ] Related products display (uses ProductCard)
  - [ ] Related products slider works
  - [ ] Responsive design (mobile/desktop)
  - [ ] All buttons functional

### Metrics Validation:

- [ ] **Time**: Migration completed in 45-55 minutes
- [ ] **Files**: 15-20 files created
- [ ] **Lines**: ~2,500-3,000 lines of code
- [ ] **Duplication**: 0% ✅
- [ ] **TypeScript errors**: 0 ✅
- [ ] **Components reused**: All EXISTING components

---

## 🔄 Per-Agent Quick Reference

### Before ANY Agent:

- [ ] ✅ Stage 0 completed (inventory exists)
- [ ] ✅ Context created (EXISTING/REUSE/CREATE/DO_NOT_CREATE)
- [ ] ❌ Explicit prohibitions in instruction
- [ ] ✅ Explicit requirements in instruction
- [ ] 📏 Size/entry limits specified

### After ANY Agent:

- [ ] ✅ Expected files created
- [ ] ✅ No existing files overwritten
- [ ] ❌ No code duplication
- [ ] 📏 Size limits respected
- [ ] 🔍 Quality check passed

---

## 📊 Success Criteria Summary

| Criterion | Target |
|-----------|--------|
| **TypeScript errors** | 0 |
| **Code duplication** | 0% |
| **Components reused** | 100% of existing |
| **Time** | 45-55 min per page |
| **Best practices** | All embedded |
| **Functionality** | All features work |
| **Responsive** | Mobile + Desktop |
| **SEO** | Complete meta tags |
| **Accessibility** | WCAG 2.1 AA |

---

**Version**: 3.0-production
**Last Updated**: 2025-10-20
