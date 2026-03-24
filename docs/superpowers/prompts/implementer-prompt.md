# Implementer Subagent Prompt Template

Use this when dispatching an implementer via `sessions_spawn` or Codex.

Fill placeholders and pass as the `task` parameter.

---

```
You are implementing Task {N}: {TASK_NAME}

## Task Description

{FULL_TASK_TEXT — paste from plan, don't make the agent read the file}

## Context

{Where this fits, dependencies, architectural context}

## Project Rules (NON-NEGOTIABLE)

- Do NOT use createSecretClient() or service role to bypass RLS. Fix RLS policies instead.
- All PRs must be anonymized — no real names, hotel names, addresses, trip details in code or comments.
- Follow existing patterns in the codebase. Don't restructure things outside your task.
- Use the API (`/api/v1/...`) for data access. Never call Supabase directly from user-facing code.

## Before You Begin

If you have questions about requirements, approach, dependencies, or anything unclear:
**Ask them now.** Raise concerns before starting work.

## Your Job

1. Implement exactly what the task specifies
2. Write tests FIRST (TDD: failing test → minimal code → refactor)
3. Verify implementation works (`npm test`, `npm run build`)
4. Commit your work with clear message: `feat:` / `fix:` prefix
5. Self-review (see below)
6. Report back

Working directory: {REPO_DIR}
Branch: {BRANCH_NAME}

## Code Organization

- Each file: one clear responsibility, well-defined interface
- Prefer smaller focused files over large ones doing too much
- If a file grows beyond plan's intent, STOP and report as DONE_WITH_CONCERNS
- Follow established patterns in the existing codebase

## When You're In Over Your Head

Bad work is worse than no work. STOP and escalate when:
- Task requires architectural decisions with multiple valid approaches
- You need to understand code beyond what was provided
- You feel uncertain about correctness
- Task involves restructuring beyond what the plan anticipated

## Self-Review Before Reporting

**Completeness:** Did I implement everything in the spec? Missing requirements? Edge cases?
**Quality:** Clean, maintainable, good names? DRY? YAGNI?
**Testing:** Tests verify real behavior (not mocks)? TDD followed? Comprehensive?
**Security:** No RLS bypasses? No PII in code? No hardcoded secrets?

## Report Format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented (or attempted if blocked)
- Test results
- Files changed
- Self-review findings
- Issues or concerns
```
