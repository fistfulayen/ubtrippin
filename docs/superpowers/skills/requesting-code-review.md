# Requesting Code Review — Adapted for UBT

Two-stage review: spec compliance first, then code quality.

## When to Request

**Mandatory:** After each task in subagent-driven development, after major feature, before merge.
**Optional:** When stuck, before refactoring, after complex bug fix.

## Stage 1: Spec Compliance

Does the code match the spec? Nothing missing? Nothing extra?

Dispatch subagent with `prompts/spec-reviewer-prompt.md` template.
Model: sonnet (reviewers need judgment).

## Stage 2: Code Quality

Only after spec compliance passes.

1. Get git SHAs: `BASE_SHA=$(git rev-parse HEAD~N)`, `HEAD_SHA=$(git rev-parse HEAD)`
2. Dispatch subagent with `prompts/code-quality-reviewer-prompt.md` template
3. Model: sonnet

## Acting on Feedback

- **Critical:** Fix immediately, re-review
- **Important:** Fix before proceeding, re-review
- **Minor:** Note for later (or fix if quick)
- **Wrong feedback:** Push back with technical reasoning

## GitHub Review Comment Discipline

When fixing review findings on a GitHub PR:
1. Reply IN THE COMMENT THREAD explaining what was found, fixed, and which commit
2. Add a summary comment to the PR with full status
3. Never declare merge-ready with unaddressed findings
4. After pushing fixes, wait for reviewer confirmation before proceeding

```bash
# Reply to specific review comment
gh api repos/fistfulayen/ubtrippin/pulls/{pr}/comments/{id}/replies \
  -f body="Fixed in <commit>. <explanation>"
```

## Integration with Merge-Ready Gate

The gate script (`scripts/merge-ready-check.sh`) enforces:
- No `new_findings` after fix commits → FAIL
- No `awaiting_re_review` status → FAIL
- Reviewer confirmed after fixes → PASS
