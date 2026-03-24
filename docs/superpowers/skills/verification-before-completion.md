# Verification Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this session, you cannot claim it passes.

## The Gate

Before claiming any status:

1. **IDENTIFY:** What command proves this claim?
2. **RUN:** Execute the full command (fresh, complete)
3. **READ:** Full output, check exit code, count failures
4. **VERIFY:** Does output confirm the claim?
5. **ONLY THEN:** Make the claim

Skip any step = lying, not verifying.

## What Requires Verification

| Claim | Requires | NOT Sufficient |
|-------|----------|----------------|
| Tests pass | `npm test` output: 0 failures | Previous run, "should pass" |
| Build succeeds | `npm run build` exit 0 | Linter passing |
| Bug fixed | Regression test RED-GREEN | "Code changed, assumed fixed" |
| PR merge-ready | CI green + reviews addressed + gate script | "Tests pass locally" |
| Agent completed | VCS diff shows changes | Agent says "success" |
| Requirements met | Line-by-line checklist | "Tests pass" |

## Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification
- About to commit/push/PR without verification
- Trusting agent success reports without checking
- Thinking "just this once"

## UBT-Specific Verification

Before declaring merge-ready:
1. `npm test` — all pass
2. `npm run build` — succeeds
3. `gh pr checks <number>` — all green
4. READ every CI check annotation (not just ✅)
5. READ every review comment — all addressed
6. `scripts/merge-ready-check.sh` — passes
7. No warnings in API Parity Report

Only THEN message Ian and update Needs.md.
