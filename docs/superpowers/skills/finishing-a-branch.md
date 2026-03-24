# Finishing a Branch — Adapted for UBT

## Process

### Step 1: Verify Everything

```bash
npm test                    # All tests pass
npm run build               # Build succeeds
```

If either fails → STOP. Fix before proceeding.

### Step 2: Push and Create PR

```bash
git push -u origin <branch>
gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
## Summary
- <what changed, bullet points>

## Test Plan
- [ ] <verification steps>

## Privacy Check
- [ ] No real names, hotel names, addresses
- [ ] No PII in code or comments
EOF
)"
```

### Step 3: Wait for CI

Update build-tracker.json: status → "ci_pending"

Wait for:
- All CI checks pass
- READ every CI check annotation (not just green checkmark)
- API Parity Report shows ✅ (not ⚠️)
- Code review comments from automated reviewers (Claude, Gemini, Vercel)

### Step 4: Address Review Findings

For each finding:
1. Fix the issue
2. Reply in the PR comment thread explaining fix and commit
3. Push fixes
4. Wait for re-review

### Step 5: Merge-Ready Gate

```bash
# If gate script exists
./scripts/merge-ready-check.sh <pr-number>
```

Gate checks:
- No unaddressed review findings
- No CI warnings
- Fix commits after all findings
- Reviewer confirmation on fixes

### Step 6: Notify Ian

Only after gate passes:

1. Update `memory/build-tracker.json`: status → "merge_ready"
2. Add to Obsidian `UB Trippin/Needs.md`:
   ```
   ## PR #<number> — <title>
   - **Status:** Merge-ready
   - **Link:** https://github.com/fistfulayen/ubtrippin/pull/<number>
   - **What:** <1-2 sentence summary>
   ```
3. Message Ian on Signal: "PR #X is merge-ready: <title> <url>"

## What NOT to Do

- Don't tell Ian "PR is up" — only "PR is merge-ready"
- Don't declare merge-ready before CI passes
- Don't declare merge-ready with unaddressed review findings
- Don't declare merge-ready without reading CI check content
- Don't include PII in PR description
