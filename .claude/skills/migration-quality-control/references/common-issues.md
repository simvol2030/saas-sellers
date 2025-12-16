# Common Issues and Solutions

This reference document catalogs common issues encountered during Static → SvelteKit migrations and their solutions.

## 🚫 Code Duplication Issues

### Issue: Component Already Exists

**Symptom**: Agent creates ProductCard.svelte when it already exists in `src/lib/components/ui/`

**Root Cause**: Stage 0 inventory not completed or not communicated to agent

**Solution**:
1. Always complete Stage 0 inventory before any agent
2. Include explicit list in agent instruction:
   ```
   СУЩЕСТВУЮТ (НЕ создавай!):
   ❌ ProductCard
   ❌ CategoryCard
   ❌ Slider
   ```

**Prevention**: Use pre-agent validation script

---

### Issue: Duplicate Interface Definition

**Symptom**: `types/index.ts` contains multiple `interface Product` definitions

**Root Cause**: Agent told to create types instead of extending existing

**Solution**:
1. Delete duplicate definition
2. Extend original interface with new fields:
   ```typescript
   export interface Product {
     // ... existing fields ...

     // NEW fields:
     imagesDetailed?: string[];
     availableColors?: ColorOption[];
   }
   ```

**Prevention**:
- Check types file before Stage 3
- Instruction should say "EXTEND existing Product interface" not "CREATE Product interface"

---

### Issue: Duplicate Mock Data

**Symptom**: Two files contain same product IDs or entity data

**Root Cause**: Agent recreated existing mock file instead of creating new one

**Solution**:
1. Delete duplicate file
2. Reference original file in data providers

**Prevention**:
- Run post-agent validator to detect duplicate IDs
- Include explicit DO NOT CREATE list for mock-data-generator

---

## 🔧 TypeScript Error Patterns

### Issue: Dynamic Object Access

**Error**: `Element implicitly has an 'any' type because expression of type 'X' can't be used to index type 'Y'`

**Example**:
```typescript
// ❌ ERROR
{distribution[stars]}
```

**Solution**: Add type assertion
```typescript
// ✅ FIXED
{distribution[stars as keyof RatingDistribution]}
```

**Common Locations**:
- Rating distributions
- Dynamic color/option selectors
- Tab content switching

---

### Issue: Property Does Not Exist

**Error**: `Property 'image' does not exist on type 'Product'. Did you mean 'images'?`

**Root Cause**: Component uses wrong property name from interface

**Solution**: Update component to use correct property
```typescript
// ❌ ERROR
<img src={product.image} alt="" />

// ✅ FIXED
<img src={product.images[0]} alt={product.name} />
```

**Prevention**:
- Provide agent with exact interface definitions
- Review interfaces before Stage 4

---

### Issue: Event Handler Type Mismatch

**Error**: `Type 'string' is not assignable to type '(e: Event) => void'`

**Example**:
```svelte
<!-- ❌ ERROR -->
<img onerror="this.src='placeholder.jpg'" />
```

**Solution**: Use proper event handler
```svelte
<!-- ✅ FIXED -->
<img onerror={(e) => { e.currentTarget.src = 'placeholder.jpg' }} />
```

---

### Issue: Missing Import

**Error**: `Cannot find name 'ProductCard'`

**Root Cause**: Component not imported

**Solution**:
```svelte
<script lang="ts">
  import ProductCard from '$lib/components/ui/ProductCard.svelte';
</script>
```

---

## 🎨 Svelte 5 Deprecated Patterns

### Issue: Using Svelte Stores

**Warning**: `writable/readable/derived from 'svelte/store' is deprecated`

**Example**:
```svelte
<!-- ❌ DEPRECATED -->
<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
</script>
```

**Solution**: Use Svelte 5 runes
```svelte
<!-- ✅ SVELTE 5 -->
<script>
  let count = $state(0);
</script>
```

---

### Issue: Using <svelte:component>

**Warning**: `<svelte:component> is deprecated in Svelte 5`

**Example**:
```svelte
<!-- ❌ DEPRECATED -->
<svelte:component this={MyComponent} />
```

**Solution**: Use conditional rendering
```svelte
<!-- ✅ SVELTE 5 -->
{#if type === 'A'}
  <ComponentA />
{:else if type === 'B'}
  <ComponentB />
{/if}
```

---

### Issue: Two-way Binding in Child Component

**Pattern**: Need two-way binding for props

**Example**:
```svelte
<!-- ❌ OLD APPROACH -->
<script>
  export let value;
</script>

<!-- ✅ SVELTE 5 with $bindable -->
<script lang="ts">
  interface Props {
    value: string;
  }

  let { value = $bindable() }: Props = $props();
</script>
```

---

## ♿ Accessibility Issues

### Issue: Icon Button Without Label

**Warning**: `A form label must be associated with a control`

**Example**:
```svelte
<!-- ❌ MISSING LABEL -->
<button onclick={handleClick}>
  <svg>...</svg>
</button>
```

**Solution**: Add aria-label
```svelte
<!-- ✅ WITH LABEL -->
<button aria-label="Добавить в избранное" onclick={handleClick}>
  <svg>...</svg>
</button>
```

---

### Issue: Custom Control Without Label

**Warning**: `A form label must be associated with a control`

**Example**:
```svelte
<!-- ❌ MISSING ASSOCIATION -->
<label>Выберите цвет</label>
<div class="color-buttons">...</div>
```

**Solution**: Use fieldset/legend
```svelte
<!-- ✅ PROPER ASSOCIATION -->
<fieldset>
  <legend>Выберите цвет</legend>
  <div class="color-buttons">...</div>
</fieldset>
```

**Alternative**: Use hidden input
```svelte
<!-- ✅ ALTERNATIVE -->
<label for="color-input">Выберите цвет</label>
<input type="hidden" id="color-input" bind:value={selectedColor} />
<div class="color-buttons">...</div>
```

---

### Issue: Non-interactive Element With Click Handler

**Warning**: `Visible, non-interactive elements with click handlers must have at least one keyboard listener`

**Example**:
```svelte
<!-- ❌ MISSING KEYBOARD SUPPORT -->
<div onclick={handleClick}>Click me</div>
```

**Solution**: Add keyboard support
```svelte
<!-- ✅ WITH KEYBOARD SUPPORT -->
<div
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

---

## 🎨 CSS Issues

### Issue: Vendor Prefix Without Standard

**Warning**: `-moz-appearance` without standard `appearance`

**Example**:
```css
/* ❌ INCOMPLETE */
input[type="number"]::-webkit-inner-spin-button {
  -moz-appearance: textfield;
}
```

**Solution**: Add standard property
```css
/* ✅ COMPLETE */
input[type="number"]::-webkit-inner-spin-button {
  -moz-appearance: textfield;
  appearance: textfield;  /* Standard */
}
```

---

### Issue: Not Using CSS Variables

**Problem**: Hardcoded colors/spacing instead of using design tokens

**Example**:
```css
/* ❌ HARDCODED */
.component {
  color: #333;
  padding: 16px;
  background: #fff;
}
```

**Solution**: Use CSS variables from app.css
```css
/* ✅ USING VARIABLES */
.component {
  color: var(--text-primary);
  padding: var(--spacing-md);
  background: var(--bg-primary);
}
```

---

## 📦 Mock Data Issues

### Issue: Too Many Entries

**Problem**: Mock file has 50+ entries, causing performance issues

**Solution**: Limit to 10-15 entries
```json
// Keep only 10-15 representative entries
[
  { "id": "review-001", ... },
  { "id": "review-002", ... },
  // ... max 15 total
]
```

---

### Issue: Missing Foreign Keys

**Problem**: Related data doesn't reference existing IDs

**Example**:
```json
// ❌ WRONG - references non-existent product
{
  "id": "review-001",
  "productId": "prod-999",  // doesn't exist in products.json
  ...
}
```

**Solution**: Reference actual IDs
```json
// ✅ CORRECT
{
  "id": "review-001",
  "productId": "prod-001",  // exists in products.json
  ...
}
```

---

### Issue: Invalid Date Format

**Problem**: Dates not in ISO 8601 format

**Example**:
```json
// ❌ WRONG
"date": "20/10/2024"

// ✅ CORRECT
"date": "2024-10-20T14:30:00Z"
```

---

## 🗂️ File Structure Issues

### Issue: Component in Wrong Directory

**Problem**: Layout component created in `ui/` or vice versa

**Solution**: Move to correct directory
- Layout components (Header, Footer) → `src/lib/components/layout/`
- Reusable UI components → `src/lib/components/ui/`
- Page-specific components → `src/lib/components/ui/` (if reusable) or inline in page

---

### Issue: Missing Index Export

**Problem**: New components not exported from `index.ts`

**Solution**: Update export file
```typescript
// src/lib/components/ui/index.ts
export { default as ProductCard } from './ProductCard.svelte';
export { default as ProductGallery } from './ProductGallery.svelte';  // ADD NEW
export { default as ColorSelector } from './ColorSelector.svelte';    // ADD NEW
```

---

## 🛣️ Routing Issues

### Issue: 404 on Dynamic Routes

**Problem**: Route like `/products/[slug]` returns 404

**Root Cause**:
1. Data loader not returning data
2. Product not found in mock data

**Solution**:
```typescript
// +page.ts
export const load: PageLoad = async ({ params }) => {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    throw error(404, 'Product not found');  // Proper 404
  }

  return { product };
};
```

---

## 📊 Build Issues

### Issue: Build Fails Due to Type Errors

**Problem**: `npm run build` fails even though dev works

**Root Cause**: TypeScript strict mode in build

**Solution**: Fix all type errors shown by `npm run check`

---

### Issue: Module Not Found in Build

**Problem**: Import works in dev but fails in build

**Root Cause**: Case sensitivity or wrong path

**Solution**: Check exact file name and path
```typescript
// ❌ WRONG (case mismatch)
import ProductCard from '$lib/components/ui/productCard.svelte';

// ✅ CORRECT
import ProductCard from '$lib/components/ui/ProductCard.svelte';
```

---

## 🔍 Detection Strategies

### How to Detect Duplication:

1. **Manual check**:
   ```bash
   find src/lib/components -name "ProductCard.svelte"
   # Should return only 1 result
   ```

2. **Automated**: Run post-agent validator
   ```bash
   python3 scripts/post_agent_validator.py /path/to/project
   ```

### How to Detect Interface Issues:

1. **Manual check**:
   ```bash
   grep "interface Product" src/lib/types/index.ts
   # Should return only 1 result
   ```

2. **Automated**: Post-agent validator checks this

### How to Detect TypeScript Errors:

```bash
npm run check
# Target: 0 errors (warnings OK)
```

---

## 📝 Quick Fix Reference

| Error Type | Quick Fix Command |
|------------|------------------|
| Duplicate component | `rm src/lib/components/ui/DuplicateName.svelte` |
| TypeScript errors | Run `typescript-svelte-error-fixer` agent |
| Missing export | Add to `src/lib/components/ui/index.ts` |
| Invalid JSON | Validate with `jq . file.json` |
| Accessibility | Add aria-label, fieldset/legend |
| CSS vendor prefix | Add standard property after prefixed |

---

**Version**: 3.0-production
**Last Updated**: 2025-10-20
