---
name: browser-verification-workflow
description: Detailed workflow for browser verification of frontend tasks (phases 4-6). This skill should be used when verifying frontend implementation in browser, including User Stories format, error prioritization (CRITICAL/HIGH/MEDIUM/LOW), regression testing, and browser audit templates. Use webapp-testing skill and playwright MCP tools.
---

# Browser Verification Workflow

## Overview

This skill provides detailed instructions for verifying frontend implementations in real browser. Code audit alone is not enough — this workflow ensures the UI actually works by testing in browser with User Stories, prioritization, and regression testing.

**CRITICAL:** Code audit ≠ working product. Must verify in browser.

## When to Use This Skill

- Browser Verification phases 4-6
- Frontend tasks with UI components
- After code audit passed but need to verify it actually works
- When Done Checklist has frontend items

## Required Tools

- **Skill:** `webapp-testing`
- **MCP:** `mcp__playwright__*` (browser_navigate, browser_snapshot, browser_click, browser_type, etc.)

## User Stories Format

Every frontend task should have User Stories with this format:

```markdown
# User Stories: task-NNN

## US-001: [Feature Name]

### Happy Path
1. Navigate to [URL]
2. [Action]: Click/Fill/Select [element]
3. [Action]: ...
4. **Expected:** [What should happen]
5. **Verify:** [What to check]

### Edge Cases
- Invalid input → should show error message
- Empty form → submit button disabled
- Network error → should show retry option

### Acceptance Criteria
- [ ] Happy path works
- [ ] Edge case 1 handled
- [ ] Edge case 2 handled
- [ ] No console errors
```

### Example User Story

```markdown
## US-001: User Registration

### Happy Path
1. Navigate to /register
2. Fill email: test@example.com
3. Fill password: SecurePass123
4. Click "Register" button
5. **Expected:** Redirect to /dashboard
6. **Verify:** Welcome message visible, user logged in

### Edge Cases
- Invalid email format → "Please enter valid email"
- Password < 8 chars → "Password too short"
- Email already exists → "Email already registered"
- Empty fields → Submit button disabled

### Acceptance Criteria
- [ ] Can register with valid data
- [ ] Invalid email shows error
- [ ] Short password shows error
- [ ] Duplicate email shows error
- [ ] No console errors during flow
```

## Error Prioritization

After browser verification, categorize found issues:

| Priority | Definition | Example |
|----------|------------|---------|
| **CRITICAL** | App crashes / main function unavailable | Page doesn't load, form doesn't submit |
| **HIGH** | Function works incorrectly | Data saves but shows wrong values |
| **MEDIUM** | UX problems, non-standard scenarios | Slow response, confusing UI |
| **LOW** | Cosmetic issues | Wrong spacing, minor style issues |

**Fix order:** CRITICAL → HIGH → MEDIUM → LOW

## issues.md Format

```markdown
# Browser Issues: task-NNN

## Date: [date]
## URL tested: http://localhost:XXXX

## CRITICAL
- [ ] #1: Form doesn't submit — button click has no effect
  - Screenshot: screenshots/issue-1.png
  - Console: "TypeError: Cannot read property 'submit' of null"
  - User Story: US-001, step 4

## HIGH
- [ ] #2: Data displays incorrectly — prices show NaN
  - Screenshot: screenshots/issue-2.png
  - Console: No errors
  - User Story: US-002, step 5

## MEDIUM
- [ ] #3: Loading state missing — no feedback during API call
  - User Story: US-001, step 4-5

## LOW
- [ ] #4: Button alignment off on mobile
  - Screenshot: screenshots/issue-4.png

## Summary
- CRITICAL: 1
- HIGH: 1
- MEDIUM: 1
- LOW: 1
Total: 4 issues
```

## Regression Testing

**CRITICAL:** After fixing issue #N, must re-verify ALL previous issues #1..N-1

### Regression Workflow

```
Fix Issue #1
  ↓
Verify #1 works ✅
  ↓
(No previous issues to check)
  ↓
Fix Issue #2
  ↓
Verify #2 works ✅
  ↓
REGRESSION: Re-verify #1 ✅ ← Important!
  ↓
Fix Issue #3
  ↓
Verify #3 works ✅
  ↓
REGRESSION: Re-verify #1, #2 ✅ ← Check ALL previous!
  ↓
...continue pattern
```

### Why Regression Testing Matters

Fixing one issue can break previously working features because:
- Shared components modified
- CSS changes affect other elements
- JS logic changes have side effects
- Database schema updates break queries

## Browser Audit Template

### Subagent Prompt for Browser Verification

```
Read project-docs/SUBAGENT_PROTOCOL.md first.
Activate skill: browser-verification-workflow

Use: webapp-testing skill + playwright MCP tools

## URL
http://localhost:XXXX/path

## User Stories to Test
[Copy relevant User Stories here]

## Actions
1. Navigate to URL
2. Execute Happy Path steps
3. Check Edge Cases
4. Capture screenshots for failures
5. Check console for errors

## Output
Write to tasks/phase-N/task-NNN/browser-audit.md
Create issues.md if problems found
Save screenshots to tasks/phase-N/task-NNN/screenshots/
```

## browser-audit.md Format

```markdown
# Browser Audit: task-NNN

## Browser Audit #1 — [date]

### Environment
- URL: http://localhost:5173/products
- Browser: Chromium (Playwright)

### User Story Results

| US | Name | Happy Path | Edge Cases | Status |
|----|------|------------|------------|--------|
| US-001 | Registration | ✅ | 2/3 ✅ | PARTIAL |
| US-002 | Product List | ❌ | N/A | FAIL |

### Detailed Results

#### US-001: Registration
**Happy Path:** ✅ PASS
- All steps completed successfully
- Redirect worked
- Welcome message visible

**Edge Cases:**
- [x] Invalid email → error shown
- [x] Short password → error shown
- [ ] Duplicate email → NO ERROR (BUG)

#### US-002: Product List
**Happy Path:** ❌ FAIL
- Step 3 failed: Products don't render
- Console: "Cannot read property 'map' of undefined"
- Screenshot: screenshots/us002-fail.png

### Console Errors
```
TypeError: Cannot read property 'map' of undefined
    at ProductList.tsx:23
```

### Screenshots
- screenshots/us001-success.png
- screenshots/us002-fail.png

### Summary
- Passed: 1/2 User Stories
- Issues found: 2
- Recommendation: Fix CRITICAL issues, re-audit

---

## Browser Audit #2 — [date]
[After fixes - include regression results]

### Regression Check
- [x] US-001 still works after fixes
- [x] Previous issue #1 still fixed
```

## Browser Verification Failure Flow

```
Browser Verification
        ↓
    [FAILS?]
     /     \
  CLEAR    UNCLEAR
    ↓         ↓
  Fix     Troubleshooting
  directly   subagent
    ↓         ↓
    ↓      Root cause
    ↓         ↓
    ↓       Fix
    ↓         ↓
    └────→ Re-verify
              ↓
         [PASSES?]
          /     \
        YES      NO
         ↓        ↓
   REGRESSION   Repeat
     CHECK      cycle
         ↓
    [ALL PREV OK?]
         ↓
       Done ✅
```

## Final Verification Checklist

Before marking task complete:

```markdown
## Final Browser Verification

### All User Stories Pass
- [ ] US-001: [name] ✅
- [ ] US-002: [name] ✅

### Regression
- [ ] All previously fixed issues still work

### Console
- [ ] Zero errors in console

### Done Checklist (Frontend)
- [ ] Component renders in browser
- [ ] User can interact (clicks, forms work)
- [ ] Data displays correctly
- [ ] No console errors
- [ ] Responsive/styles correct
```

**Rule:** Task is NOT complete until Final Verification Checklist is 100% ✅
