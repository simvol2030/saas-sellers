# Feedback v2 - Additional TypeScript Build Errors

**Date:** 2025-12-24
**Previous Branch:** `claude/fix-ecommerce-build-errors-zfm1d`
**Status:** MERGE REVERTED - Build failed with NEW errors

---

## Summary

The fixes from feedback-v1 (products.ts, shipping.ts) were applied correctly, but the build revealed **28 additional TypeScript errors** in other files that weren't caught before.

---

## What was attempted

1. Merged branch `claude/fix-ecommerce-build-errors-zfm1d` into `main`
2. Ran `npm install` and `prisma generate` - SUCCESS
3. Ran `npm run build` - **FAILED with 28 TypeScript errors**
4. Reverted merge

---

## Bug 1: cart.ts - Missing Prisma fields and includes (16 errors)

**Score:** 14 (Complexity: 3×3=9, Files: 1×2=2, Risk: 2×1=2, Time: 1)

**File:** `backend-hono/src/routes/cart.ts`

**Errors:**

```
Line 67: Property 'items' is missing in cart return type (need include: { items: true })
Line 68: 'expiresAt' is required in CartUncheckedCreateInput but not provided
Line 235, 256, 266, 346, 581: Property 'stockStatus' does not exist on Product type
Line 242, 272, 283, 302, 513, 519: 'cartRecord' is possibly 'null' - need null checks
Line 276: 'priceSnapshot' does not exist in CartItemUncheckedCreateInput
Line 499: 'siteId' does not exist in CurrencyWhereInput
Line 591: Property 'priceSnapshot' does not exist on CartItem type
```

**Root cause:**
1. Cart queries missing `include: { items: { include: { product: true, variant: true } } }`
2. `stockStatus` field doesn't exist in Product model
3. `priceSnapshot` field doesn't exist in CartItem model
4. Missing null checks for cartRecord
5. Currency model doesn't have siteId field

**Fix required:**
1. Add proper includes to cart queries
2. Check Prisma schema for actual Product fields (use `status` or `stockQuantity` instead of `stockStatus`)
3. Check Prisma schema for CartItem fields (remove or add `priceSnapshot`)
4. Add null checks: `if (!cartRecord) { return c.json({ error: 'Cart not found' }, 404) }`
5. Remove `siteId` from Currency queries or add to schema

---

## Bug 2: orders.ts - Missing Prisma fields and includes (11 errors)

**Score:** 13 (Complexity: 3×3=9, Files: 1×2=2, Risk: 2×1=2, Time: 0)

**File:** `backend-hono/src/routes/orders.ts`

**Errors:**

```
Line 147: Property 'priceSnapshot' does not exist on CartItem type
Line 198: Property 'discountType' does not exist on PromoCode type (should use 'type')
Line 199: Property 'discountValue' does not exist on PromoCode type (should use 'value')
Line 200, 201: Property 'maxDiscount' does not exist on PromoCode type (check schema)
Line 204: Property 'discountValue' does not exist on PromoCode type
Line 239: 'tax' does not exist in OrderUncheckedCreateInput
Line 294: Property 'items' does not exist on Order type (need include: { items: true })
Line 477: Property 'tax' does not exist on Order type
```

**Root cause:**
1. PromoCode model uses `type` not `discountType`, `value` not `discountValue`
2. Order model doesn't have `tax` field
3. Order queries missing `include: { items: true }`
4. CartItem doesn't have `priceSnapshot` field

**Fix required:**
1. Replace `promoCode.discountType` → `promoCode.type`
2. Replace `promoCode.discountValue` → `promoCode.value`
3. Check if `maxDiscount` exists in PromoCode schema, if not remove
4. Remove `tax` from Order create/read or add to schema
5. Add `include: { items: true }` to Order queries
6. Handle CartItem price via `item.product.price` instead of `priceSnapshot`

---

## Bug 3: product-import-export.ts - Decimal type mismatch (1 error)

**Score:** 5 (Complexity: 1×3=3, Files: 1×2=2, Risk: 0, Time: 0)

**File:** `backend-hono/src/routes/product-import-export.ts`

**Errors:**

```
Line 96: Type 'Decimal' is not assignable to type 'string | number | boolean | null | undefined'
```

**Root cause:** Prisma Decimal type needs conversion to string/number for CSV export.

**Fix required:**
```typescript
// Change from:
rows.map(r => r.join(','))

// To:
rows.map(r => r.map(v => v instanceof Decimal ? v.toString() : v).join(','))
```

Or handle Decimal conversion when building the row data.

---

## Prisma Schema Fields to Check

Before fixing, verify these fields exist in `prisma/schema.prisma`:

| Model | Field | Expected |
|-------|-------|----------|
| Product | `stockStatus` | Probably doesn't exist, use `status` or `stockQuantity` |
| CartItem | `priceSnapshot` | Probably doesn't exist |
| Cart | `expiresAt` | Required field - must provide in create |
| PromoCode | `discountType` | Should be `type` |
| PromoCode | `discountValue` | Should be `value` |
| PromoCode | `maxDiscount` | Check if exists |
| Order | `tax` | Probably doesn't exist |
| Currency | `siteId` | Probably doesn't exist |

---

## How to reproduce

```bash
cd backend-hono
npm install
npx prisma generate
npm run build  # <- Will fail with TS errors
```

---

## Recommended approach

1. First, review `prisma/schema.prisma` to understand all model fields
2. Run `npx prisma generate` to update types
3. Fix cart.ts - align code with actual schema fields
4. Fix orders.ts - use correct PromoCode field names, remove tax
5. Fix product-import-export.ts - handle Decimal conversion
6. Run `npx tsc --noEmit` to verify all errors fixed
7. Test with `npm run build` before pushing

---

## Important Note

The code assumes fields exist that don't match the Prisma schema. The Developer should:
1. Either update the schema to add missing fields
2. Or update the code to use existing fields

Recommend updating CODE to match SCHEMA (not changing schema for this fix).

---

## Branch to create

Create new branch: `claude/fix-typescript-errors-v2`

Base on: `claude/fix-ecommerce-build-errors-zfm1d`

---

*Generated by CLI Integrator (Workflow v4.2)*
