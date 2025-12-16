---
name: migration-quality-control
description: Quality control skill for Static → SvelteKit migration protocol v3.0. Use this skill during migration projects to validate prerequisites before launching agents, detect code duplication, verify TypeScript interfaces, check component best practices, and ensure zero errors. Invoke before each agent launch and after agent completion to prevent duplicate components, missing types, and TypeScript errors. Provides automated validation scripts and comprehensive checklists for all 7 migration stages.
---

# Migration Quality Control

## Overview

Ensure production-quality migrations from Static HTML to SvelteKit by validating prerequisites before agent launches and verifying outputs after completion. This skill prevents common issues: duplicate components, missing TypeScript interfaces, code duplication, and compilation errors.

**Use this skill when:**
- Starting a new migration stage (validate prerequisites)
- After an agent completes work (verify outputs)
- Before moving to the next stage (ensure quality gates passed)
- Troubleshooting migration issues (diagnose problems)

## Core Capabilities

This skill provides validation at two critical points:

### 1. Pre-Agent Validation

Run **before** launching any migration agent to ensure prerequisites are met.

**Validates:**
- Stage 0 (inventory) completion
- EXISTING components, types, and mock data cataloged
- Agent instructions include proper context
- Explicit prohibitions (DO NOT CREATE) specified
- Size/entry limits defined
- Best practices embedded in instructions

**Usage:**
```bash
python3 scripts/pre_agent_validator.py <project_root> <agent_type> [instruction_file]
```

**Agent types:**
- `static-to-svelte-analyzer`
- `mock-data-generator`
- `ui-components-builder`
- `page-data-provider-builder`
- `typescript-svelte-error-fixer`

**Example:**
```bash
# Before launching ui-components-builder
python3 scripts/pre_agent_validator.py \
  ./project-box/frontend-sveltekit \
  ui-components-builder \
  instruction.txt
```

**Output:**
- ✅ Stage 0 completion check
- 📋 Context summary (existing components/types/mock data)
- ❌ Errors (must fix before proceeding)
- ⚠️ Warnings (recommended to address)

### 2. Post-Agent Validation

Run **after** agent completion to verify output quality.

**Validates:**
- No code duplication (components, interfaces, mock data)
- TypeScript interface quality (no duplicates, proper exports)
- Mock data structure (valid JSON, entry limits, foreign keys)
- Component best practices (Svelte 5 runes, accessibility, CSS)
- npm run check results (TypeScript errors)
- Migration metrics (components, types, lines, duplication score)

**Usage:**
```bash
python3 scripts/post_agent_validator.py <project_root> [--skip-npm-check]
```

**Example:**
```bash
# After ui-components-builder completes
python3 scripts/post_agent_validator.py ./project-box/frontend-sveltekit
```

**Output:**
- ⚠️ Duplication alerts (components, interfaces, mock IDs)
- ❌ Errors (must fix)
- ⚠️ Warnings (best practices)
- 📊 Metrics (components, types, lines, errors, duplication score)

## Workflow Integration

Integrate validation into the migration workflow at these points:

### Standard Migration Flow with Validation

```
┌─────────────────────────────────────────────────┐
│ Stage 0: Inventory Check                        │
│ → Catalog existing components/types/mock data   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ PRE-AGENT VALIDATION (before Stage 1)           │
│ → Verify Stage 0 completed                      │
│ → Generate context summary                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Stage 1: Launch static-to-svelte-analyzer       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ POST-AGENT VALIDATION (after Stage 1)           │
│ → Check output file exists and size <1500 lines │
│ → Verify no duplication in recommendations      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ PRE-AGENT VALIDATION (before Stage 2)           │
│ → Check mock-data-generator instruction         │
│ → Verify DO NOT CREATE list includes existing   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Stage 2: Launch mock-data-generator              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ POST-AGENT VALIDATION (after Stage 2)           │
│ → Check no existing files overwritten           │
│ → Validate JSON structure and entry count       │
│ → Verify foreign keys reference existing data   │
└─────────────────────────────────────────────────┘

[Continue for Stages 3-7...]
```

### When to Skip Validation

**Skip pre-agent validation when:**
- Repeating a stage after manual fixes
- Agent instruction unchanged from validated version

**Skip post-agent validation when:**
- Making minor manual edits
- Only documentation changes

**Never skip:**
- Stage 0 inventory check
- Final Stage 7 validation before deployment

## Validation Checklists

Detailed stage-by-stage checklists are available in `references/stage-checklists.md`. Quick reference:

### Pre-Agent Checklist (applies to ALL agents)

- [ ] Stage 0 completed (inventory exists)
- [ ] Context created (EXISTING/REUSE/CREATE/DO_NOT_CREATE)
- [ ] Explicit prohibitions in instruction (❌ НЕ...)
- [ ] Explicit requirements in instruction (✅ ДЕЛАЙ...)
- [ ] Size/entry limits specified

### Post-Agent Checklist (applies to ALL agents)

- [ ] Expected files created
- [ ] No existing files overwritten
- [ ] No code duplication
- [ ] Size limits respected
- [ ] Quality check passed

### Critical Stage-Specific Checks

**Stage 1 (Analyzer):**
- Pre: HTML file ready, line limit <1500 specified
- Post: Output file <1500 lines, no duplication in recommendations

**Stage 2 (Mock Data):**
- Pre: DO NOT CREATE list includes all existing .json files
- Post: No existing files overwritten, entry count ≤15 per file

**Stage 4 (UI Components):**
- Pre: DO NOT CREATE list includes all existing components
- Post: No component duplication, each component <200 lines

**Stage 6 (TypeScript Check):**
- Pre: None required
- Post: npm run check → 0 errors ✅

## Common Issues and Solutions

Comprehensive issue catalog in `references/common-issues.md`. Most frequent:

### Code Duplication

**Issue:** Agent creates ProductCard.svelte when it already exists

**Detection:** Post-agent validator reports duplicate components

**Fix:**
```bash
# Remove duplicate
rm src/lib/components/ui/ProductCard.svelte

# Update imports to reference existing
# In files that imported the duplicate:
import ProductCard from '$lib/components/ui/ProductCard.svelte';
```

**Prevention:** Always include existing components in DO NOT CREATE list

### TypeScript Errors

**Issue:** Dynamic object access without type assertion

**Detection:** `npm run check` shows "implicitly has 'any' type"

**Fix:**
```typescript
// ❌ Before
{distribution[stars]}

// ✅ After
{distribution[stars as keyof RatingDistribution]}
```

**Prevention:** Include TypeScript best practices in ui-components-builder instruction

### Missing Interfaces

**Issue:** Agent uses interface that doesn't exist

**Detection:** `npm run check` shows "Cannot find name 'ColorOption'"

**Fix:** Add interface to `src/lib/types/index.ts`

**Prevention:** Complete Stage 3 (TypeScript types) before Stage 4 (UI components)

### Accessibility Warnings

**Issue:** Icon button without aria-label

**Detection:** Post-agent validator or `npm run check` a11y warnings

**Fix:**
```svelte
<!-- ❌ Before -->
<button><svg>...</svg></button>

<!-- ✅ After -->
<button aria-label="Добавить в избранное"><svg>...</svg></button>
```

**Prevention:** Include accessibility requirements in ui-components-builder instruction

## Metrics and Success Criteria

Post-agent validation calculates these metrics:

| Metric | Target | Description |
|--------|--------|-------------|
| **components_created** | ~12 per page | New components generated |
| **types_defined** | ~8 per page | TypeScript interfaces |
| **mock_files** | 1-3 new | New mock data files |
| **total_lines** | ~2,500-3,000 | Total code generated |
| **typescript_errors** | 0 ✅ | Compilation errors |
| **duplication_score** | 0 ✅ | Duplicate items found |

### Success Thresholds

**Stage completion criteria:**
- TypeScript errors: **0** (required)
- Duplication score: **0** (required)
- Component size: **<200 lines** each (required)
- Mock entries: **≤15** per file (recommended)
- Analysis output: **<1500 lines** (recommended)

**Final validation criteria (Stage 7):**
- All stage completion criteria met ✅
- `npm run check` → 0 errors ✅
- Page loads without errors ✅
- All interactive features work ✅
- Responsive design functional ✅

## Integration with Migration Protocol

This skill implements quality gates for **Migration Protocol v3.0**. Reference the protocol for:
- Complete 7-stage workflow
- Agent-specific instructions
- Best practices (TypeScript, Svelte 5, Accessibility)
- Timing estimates per stage

### Quality Gates

| Stage | Pre-Validation | Post-Validation | Success Gate |
|-------|---------------|-----------------|--------------|
| **0** | N/A | ✅ Inventory complete | Files exist |
| **1** | ✅ Check context | ✅ Check output size | <1500 lines |
| **2** | ✅ Check DO NOT list | ✅ Check no overwrites | 0 duplicates |
| **3** | Manual | Manual | 0 interface duplicates |
| **4** | ✅ Check components list | ✅ Check duplication | 0 duplicates |
| **5** | ✅ Check reuse list | ✅ Check structure | Proper imports |
| **6** | N/A | ✅ npm run check | 0 errors |
| **7** | N/A | ✅ Full validation | All criteria ✅ |

## Quick Start Examples

### Example 1: Validating Before UI Components Stage

```bash
# 1. Run pre-agent validation
python3 scripts/pre_agent_validator.py \
  ./project-box/frontend-sveltekit \
  ui-components-builder \
  ui-instruction.txt

# 2. Review output
# ✅ Stage 0 completed
# КОНТЕКСТ СУЩЕСТВУЮЩЕГО КОДА:
# ✅ Layout: Header, Footer, MobileMenu
# ✅ UI: ProductCard, CategoryCard, Slider
# ⚠️  WARNING: Existing component 'ProductCard' not mentioned in DO NOT CREATE

# 3. Fix instruction (add ProductCard to DO NOT CREATE)

# 4. Re-run validation
python3 scripts/pre_agent_validator.py \
  ./project-box/frontend-sveltekit \
  ui-components-builder \
  ui-instruction.txt

# 5. All checks passed ✅
# 6. Launch ui-components-builder agent
```

### Example 2: Validating After Agent Completion

```bash
# 1. Agent completed (e.g., ui-components-builder)

# 2. Run post-agent validation
python3 scripts/post_agent_validator.py ./project-box/frontend-sveltekit

# 3. Review output
# ⚠️  CODE DUPLICATION DETECTED:
#    Duplicate Components:
#    - ProductCard: src/lib/components/ui/ProductCard.svelte, src/lib/components/page/ProductCard.svelte
# ❌ ERRORS:
#    ❌ npm run check found 3 error(s)
# 📊 METRICS:
#    Components: 15
#    Duplication: 1 issue

# 4. Fix issues
rm src/lib/components/page/ProductCard.svelte  # Remove duplicate

# 5. Run typescript-svelte-error-fixer for TypeScript errors

# 6. Re-run validation
python3 scripts/post_agent_validator.py ./project-box/frontend-sveltekit

# 7. All checks passed ✅
```

### Example 3: Using During Development

When asked to perform migration quality checks during development:

**User:** "Проверь готовность к запуску ui-components-builder"

**Response:**
1. Run Stage 0 inventory check
2. Generate context summary
3. Review agent instruction for:
   - EXISTING components list
   - DO NOT CREATE prohibitions
   - Size limits (<200 lines)
   - Best practices (TypeScript, Svelte 5, A11y)
4. Run pre-agent validation script
5. Report findings and recommendations

**User:** "Проверь результаты работы mock-data-generator"

**Response:**
1. Run post-agent validation script
2. Check for:
   - Overwritten existing files
   - Duplicate IDs in mock data
   - Entry count violations (>15)
   - Invalid JSON structure
3. Report findings
4. Suggest fixes if issues found

## Resources

### Scripts

- **`scripts/pre_agent_validator.py`** - Pre-agent validation script
  - Checks Stage 0 completion
  - Generates context summary
  - Validates agent instructions
  - Detects missing prohibitions/limits

- **`scripts/post_agent_validator.py`** - Post-agent validation script
  - Detects code duplication
  - Validates TypeScript interfaces
  - Checks mock data structure
  - Runs npm check
  - Calculates metrics

### References

- **`references/stage-checklists.md`** - Comprehensive checklists for all 7 stages
  - Pre-agent and post-agent checklists
  - Stage-specific requirements
  - Success criteria per stage
  - Quick reference tables

- **`references/common-issues.md`** - Catalog of common issues and solutions
  - Code duplication patterns
  - TypeScript error patterns
  - Svelte 5 deprecated APIs
  - Accessibility issues
  - CSS issues
  - Mock data issues
  - Detection strategies
  - Quick fix reference

## Best Practices

### When to Run Validation

**Always run pre-agent validation when:**
- First time launching an agent type in migration
- Agent instruction significantly changed
- Previous stage failed validation

**Always run post-agent validation when:**
- Agent generates multiple files
- Agent modifies existing code
- Before proceeding to next stage

**Run full validation (both) when:**
- Starting critical stages (4, 5, 6)
- After significant rework
- Before final deployment (Stage 7)

### Handling Validation Failures

**If pre-agent validation fails:**
1. Review errors and warnings
2. Update agent instruction
3. Re-run validation
4. Only proceed when all errors resolved

**If post-agent validation fails:**
1. Assess severity:
   - Errors (must fix)
   - Warnings (should fix)
2. Fix manually or use error-fixer agent
3. Re-run validation
4. Document any accepted warnings

### Integration with CI/CD

Post-agent validation can be integrated into CI/CD:

```bash
# In CI pipeline after migration
python3 scripts/post_agent_validator.py /project/root

# Exit code 0 = success, 1 = failure
# Fail build if validation fails
```

## Troubleshooting

### Validation Script Errors

**Issue:** `ModuleNotFoundError: No module named 'pathlib'`

**Solution:** Use Python 3.7+
```bash
python3 --version  # Should be ≥3.7
```

**Issue:** `FileNotFoundError: [Errno 2] No such file or directory: 'src/lib'`

**Solution:** Provide correct project root path
```bash
# Wrong
python3 scripts/post_agent_validator.py .

# Correct
python3 scripts/post_agent_validator.py ./project-box/frontend-sveltekit
```

### False Positives

**Issue:** Validator reports duplicate but files are different

**Solution:** Review actual file content, may be same name but different purpose

**Issue:** npm check errors not related to migration

**Solution:** Use `--skip-npm-check` flag
```bash
python3 scripts/post_agent_validator.py /project/root --skip-npm-check
```

### Performance

**Issue:** Post-validation slow on large projects

**Solution:** Run only when necessary, use `--skip-npm-check` for quick checks

## Summary

Use this skill throughout migration to:
- ✅ Prevent code duplication
- ✅ Ensure TypeScript type safety
- ✅ Validate agent instructions
- ✅ Catch errors early
- ✅ Maintain code quality
- ✅ Track migration metrics

**Key principle:** Validate before and after every agent launch to achieve **0% duplication** and **0 TypeScript errors**.

---

**Version**: 3.0-production
**Protocol**: Static → SvelteKit Migration v3.0
**Tested**: product.html migration (45 min, 0 errors, 0% duplication)
