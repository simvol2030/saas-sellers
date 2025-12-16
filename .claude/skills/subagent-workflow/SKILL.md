---
name: subagent-workflow
description: Detailed protocol for working with subagents in task execution, code audit, and troubleshooting. This skill should be used when launching subagents for implementation, code audit (phases 1-3), troubleshooting, or research tasks. Provides prompt templates, file formats, and strict rules to ensure subagents work within defined scope.
---

# Subagent Workflow Protocol

## Overview

This skill provides detailed instructions for orchestrating subagents in a long delegation workflow. Subagents execute isolated tasks while the orchestrator coordinates and maintains project context.

## Core Rules

1. **EVERY subagent launch MUST include SUBAGENT_PROTOCOL reference**
2. **Stay STRICTLY within SCOPE** — never touch files outside defined scope
3. **After audit — NEW version of task, NOT a patch**
4. **Version control plan.md** — preserve iteration history

## Subagent Launch Templates

### For Implementation Task

```
Read these files FIRST (mandatory):
1. project-docs/SUBAGENT_PROTOCOL.md — rules to follow
2. tasks/phase-N/task-NNN/plan.md — what needs to be done
3. tasks/phase-N/task-NNN/task-prompt.md — specific instructions

Execute the task. Write result to tasks/phase-N/task-NNN/report.md
```

### For Code Audit Task (Phases 1-3)

```
Read these files FIRST (mandatory):
1. project-docs/SUBAGENT_PROTOCOL.md — rules to follow
2. tasks/phase-N/task-NNN/plan.md — what was intended
3. tasks/phase-N/task-NNN/report.md — what was actually done

Audit the implementation. Find bugs, deviations, issues.
Write findings to tasks/phase-N/task-NNN/audit.md
```

### For Research Task

```
Read project-docs/SUBAGENT_PROTOCOL.md first.
Research: [specific question]
Scope: [files/directories to explore]
Return: condensed summary for task formulation
```

### For Troubleshooting Task

```
Read project-docs/SUBAGENT_PROTOCOL.md first.

Problem: [what exactly doesn't work]
Expected: [what should happen]
Actual: [what happens instead]
Scope: [files/areas to investigate]

Find root cause. Return:
1. Why it happens
2. Which file/line is responsible
3. Recommended fix
```

## Task Prompt Structure

Every task-prompt.md MUST contain:

```markdown
# Task: [task-NNN-name]

## Prerequisites
Read first:
- project-docs/SUBAGENT_PROTOCOL.md — general rules
- tasks/phase-N/task-NNN/plan.md — detailed plan

## SCOPE
Files to work with (exact paths):
- path/to/file1.ts (create/modify)
- path/to/file2.ts (read only, for reference)

## GOAL
One sentence: what to achieve.

## CONTEXT
Read these files first:
- tasks/phase-N/task-NNN/plan.md — detailed plan
- path/to/similar/file.ts — pattern to follow

## CONSTRAINTS
- DO NOT touch files outside SCOPE
- DO NOT create new files unless explicitly listed
- DO NOT refactor existing code
- DO NOT add features not mentioned in GOAL
- DO NOT change configs without explicit permission

## TOOLS (if needed)
Skills: [relevant skills]
MCP: [relevant MCP tools]

## OUTPUT
After completion write to tasks/phase-N/task-NNN/report.md
```

## File Format: report.md

```markdown
# Task Report: task-NNN

## Files Modified
- `src/api/users.ts` — created, user CRUD endpoints
- `src/types/user.ts` — added User, CreateUserDTO types

## What Was Done
1. Created REST endpoints for user management
2. Added zod validation schemas
3. Connected to existing db module

## Issues
- None / or describe what happened

## Deviations from Plan
- None / or explain why deviated

## Done Checklist Status
### Backend
- [x] API endpoint works
- [x] Returns correct data

### Frontend
- [ ] Component renders (not tested yet)
```

## File Format: audit.md

```markdown
# Audit: task-NNN

## Audit #1 — [date]

### Critical
- [ ] `src/api/users.ts:42` — SQL injection in query param
- [ ] `src/api/users.ts:67` — missing auth check

### Major
- [ ] `src/types/user.ts:12` — email field should be required

### Minor
- [ ] `src/api/users.ts:15` — unused import

### Summary
Found: 2 critical, 1 major, 1 minor
Recommendation: fix critical and re-audit

---

## Audit #2 — [date]
[Next iteration after fixes]
```

## Fix Rules (CRITICAL)

**After any audit — NEW version of task, NOT a patch!**

Version control for plan.md:
1. Before creating new version: `mv plan.md plan-v{N}.md`
2. Create fresh plan.md with full context including audit findings
3. Previous versions preserved for context recovery

Rules:
- If bugs found: create NEW plan.md with full context (not patch)
- If analysis requires too much context: launch research subagent first
- Never just "fix the bug" — reformulate the entire task with new knowledge
- Old versions help restore context after auto-compact

## Red Flags (Subagent NEVER should)

- Create helpers/utilities not in SCOPE
- "Improve" code structure
- Add comments/docs not requested
- Modify configs (tsconfig, package.json, etc.)
- Install new dependencies
- Touch test files unless explicitly asked
- Create files outside SCOPE

## Troubleshooting Triggers

Launch troubleshooting subagent when:
- User reports problem
- report.md contains unresolved issues
- audit.md found bug but cause unclear
- Fix didn't help — same problem persists
- Browser verification failed (cause unknown)

## Troubleshooting Report Format

```markdown
# Troubleshooting Report: [problem]

## Root Cause
[Why it happens]

## Location
File: src/path/file.ts
Line: 42
Code: `problematic code snippet`

## Why This Causes the Problem
[Explanation]

## Recommended Fix
[What to change]

## Verification
[How to verify fix worked]
```
