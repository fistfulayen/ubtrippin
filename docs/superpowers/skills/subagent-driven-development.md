# Subagent-Driven Development — Adapted for UBT

Execute plan by dispatching a fresh subagent per task, with two-stage review after each.

## When to Use

- Have an approved implementation plan
- Tasks are mostly independent
- Want fast iteration with quality gates

## The Process

```
For each task in plan:
  1. Dispatch implementer subagent (sessions_spawn or Codex)
  2. Handle status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)
  3. Dispatch spec compliance reviewer subagent
  4. If issues → implementer fixes → re-review
  5. Dispatch code quality reviewer subagent
  6. If issues → implementer fixes → re-review
  7. Mark task complete, update build-tracker.json
  
After all tasks:
  8. Final code review of entire implementation
  9. Run full test suite + build
  10. Push branch, create PR
  11. Run merge-ready gate (scripts/merge-ready-check.sh)
  12. Update build-tracker.json status
  13. Message Ian: "PR #X is merge-ready" + add to Obsidian Needs.md
```

## Dispatching Implementers

### Via sessions_spawn (for subagent-capable tasks)

```
sessions_spawn:
  task: [filled implementer-prompt.md template]
  runtime: "subagent"
  model: [matched to task complexity — see model selection]
```

### Via Codex (for larger tasks needing file exploration)

```
exec:
  command: cd /home/iancr/ubtrippin && codex --print --permission-mode bypassPermissions "..."
```

### Via Claude Code ACP (for thread-bound interactive work)

```
sessions_spawn:
  task: [filled template]
  runtime: "acp"
  thread: true
  mode: "session"
```

## Model Selection

**Mechanical tasks** (1-2 files, clear spec): `flash-lite` or `kimi`
**Integration tasks** (multi-file, cross-concern): `sonnet`
**Architecture/review tasks**: `opus` or `gemini`

## Handling Implementer Status

**DONE:** → dispatch spec compliance reviewer
**DONE_WITH_CONCERNS:** → read concerns, address if correctness/scope, note if observational, then review
**NEEDS_CONTEXT:** → provide missing context, re-dispatch same model
**BLOCKED:** → assess:
  1. Context problem → provide more, re-dispatch
  2. Needs more reasoning → re-dispatch with more capable model
  3. Task too large → break into smaller pieces
  4. Plan is wrong → escalate to Ian

**Never** ignore an escalation or retry without changes.

## Two-Stage Review

### Stage 1: Spec Compliance (prompts/spec-reviewer-prompt.md)

Does the code match the spec? Nothing missing? Nothing extra?

```
sessions_spawn:
  task: [filled spec-reviewer-prompt.md]
  runtime: "subagent"
  model: "sonnet"  # reviewers always get a capable model
```

### Stage 2: Code Quality (prompts/code-quality-reviewer-prompt.md)

Only after spec compliance passes. Is the code well-built?

```
sessions_spawn:
  task: [filled code-quality-reviewer-prompt.md]
  runtime: "subagent"  
  model: "sonnet"
```

## Build Tracker Integration

Update `memory/build-tracker.json` at each stage:

```json
{
  "id": "prd-xxx-task-N",
  "prd": "PRD-0XX",
  "branch": "feat/xxx",
  "status": "running|ci_pending|merge_ready|complete|failed",
  "pr": null,
  "tasks_total": 5,
  "tasks_complete": 3,
  "current_task": 4,
  "started": "2026-03-24T12:00:00Z",
  "updated": "2026-03-24T12:30:00Z"
}
```

## Finishing

After all tasks complete:

1. Run `npm test` — all tests must pass
2. Run `npm run build` — build must succeed
3. Push branch: `git push -u origin <branch>`
4. Create PR: `gh pr create --title "..." --body "..."`
5. Wait for CI (build-tracker status → "ci_pending")
6. READ every CI check annotation/comment (not just green checkmark)
7. Run `scripts/merge-ready-check.sh` if available
8. Only then: update Needs.md and message Ian

## What NOT to Do

- Don't present PR to Ian before CI passes and all review findings are addressed
- Don't declare merge-ready without reading CI check content
- Don't bypass RLS with service client
- Don't include PII in PR description or code
- Don't say "I'll come back to you" without a build-tracker entry
