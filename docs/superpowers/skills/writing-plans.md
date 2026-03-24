# Writing Plans — Adapted for UBT

Write implementation plans assuming the agent has zero codebase context and questionable taste.

## Context

- Run AFTER brainstorming produces a validated spec
- Plans saved to: `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`

## File Structure First

Before defining tasks, map out which files will be created or modified:
- Each file: one clear responsibility
- Prefer smaller focused files
- Follow existing codebase patterns
- Files that change together live together

## Task Granularity — Bite-Sized (2-5 minutes each)

Each step is one action:
- "Write the failing test" — step
- "Run it to verify it fails" — step
- "Implement minimal code to pass" — step
- "Run tests to verify pass" — step
- "Commit" — step

## Plan Document Header

Every plan MUST start with:

```markdown
# [Feature Name] Implementation Plan

> **For agents:** Execute this plan using subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
**Spec:** [Link to spec in docs/superpowers/specs/]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `__tests__/exact/path/to/file.test.ts`

**Model:** flash-lite | sonnet | opus (based on complexity)

- [ ] **Step 1: Write the failing test**
```typescript
// exact test code here
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- --testPathPattern="path" -t "test name"`
Expected: FAIL with "..."

- [ ] **Step 3: Write minimal implementation**
```typescript
// exact implementation code here
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- --testPathPattern="path"`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add <files>
git commit -m "feat: add specific feature"
```
````

## UBT-Specific Requirements in Every Plan

Include in the plan header:

```markdown
## Project Rules (include in every agent prompt)
- Do NOT use createSecretClient() or service role to bypass RLS
- No real names, hotel names, addresses in code/comments
- Use `/api/v1/...` for data access, never direct Supabase from user-facing code
- TDD: write failing test first, watch it fail, then implement
```

## Model Selection Per Task

| Complexity Signal | Model | Examples |
|-------------------|-------|---------|
| 1-2 files, clear spec, isolated | flash-lite or kimi | Add a util function, simple component |
| Multi-file, integration | sonnet | API route + component + test |
| Architecture, judgment, review | opus or gemini | Schema design, complex state management |

## Plan Review

After writing the complete plan:
1. Dispatch plan-document-reviewer subagent (see `prompts/plan-document-reviewer-prompt.md`)
2. Fix issues, re-dispatch, max 3 iterations then ask Ian
3. On approval → execution handoff

## Execution Handoff

After plan is approved:

**"Plan saved to `docs/superpowers/plans/<filename>.md`. Ready to execute via subagent-driven-development. Shall I begin?"**

Then use subagent-driven-development to execute.
