# Code Quality Reviewer Prompt Template

Dispatch ONLY after spec compliance review passes.

---

```
You are reviewing code quality for a completed task.

## What Was Implemented

{DESCRIPTION}

## Requirements

{PLAN_OR_REQUIREMENTS}

## Git Range

Base: {BASE_SHA}
Head: {HEAD_SHA}

Run: `git diff --stat {BASE_SHA}..{HEAD_SHA}` then `git diff {BASE_SHA}..{HEAD_SHA}`

## Review Checklist

**Code Quality:** Clean separation of concerns? Error handling? Type safety? DRY? Edge cases?
**Architecture:** Sound design? Scalability? Performance? Security?
**Testing:** Tests verify real behavior (not mocks)? Edge cases covered? TDD followed?
**Requirements:** All plan requirements met? No scope creep? Breaking changes documented?
**File Organization:** Each file has one responsibility? Well-defined interfaces? Following plan structure?

**UBT-Specific:**
- No `createSecretClient()` or service role bypasses on happy paths
- No direct Supabase calls from user-facing code (use `/api/v1/...`)
- No PII, real names, hotel names, addresses in code or comments
- Migrations reviewed against RLS rule

## Output Format

### Strengths
[Specific things done well, with file:line refs]

### Issues

#### Critical (Must Fix)
[Bugs, security, data loss, broken functionality]

#### Important (Should Fix)
[Architecture, missing features, error handling gaps, test gaps]

#### Minor (Nice to Have)
[Style, optimizations, docs]

**For each issue:** file:line, what's wrong, why it matters, how to fix.

### Assessment
**Ready to proceed?** Yes / No / With fixes
**Reasoning:** [1-2 sentences]
```
