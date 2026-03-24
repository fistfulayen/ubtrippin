# Systematic Debugging — Adapted for UBT

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## Phase 1: Root Cause Investigation

1. **Read error messages carefully** — stack traces, line numbers, error codes
2. **Reproduce consistently** — exact steps, reliable trigger
3. **Check recent changes** — git diff, recent commits, new deps
4. **Gather evidence in multi-component systems** — log at each boundary:
   - Browser → API route → Supabase → RLS policy
   - Add diagnostic instrumentation, run once, analyze where it breaks
5. **Trace data flow** — where does the bad value originate? Keep tracing up until you find the source. Fix at source, not at symptom.

## Phase 2: Pattern Analysis

1. Find working examples in same codebase
2. Compare working vs broken — list every difference
3. Understand dependencies and assumptions

## Phase 3: Hypothesis and Testing

1. Form single hypothesis: "X is root cause because Y"
2. Design minimal test to confirm/deny
3. Run test, observe results
4. If wrong, back to Phase 2

## Phase 4: Fix and Verify

1. Fix at root cause (not symptom)
2. Add defense-in-depth validation at every layer data passes through
3. Write regression test (RED-GREEN: test fails without fix, passes with fix)
4. Run full test suite
5. Verify no regressions

## UBT-Specific Debugging Patterns

### RLS Issues
- Empty response ≠ no data. It means RLS blocked the query.
- Check: `SELECT * FROM pg_policies WHERE tablename = '<table>'`
- Never "fix" by switching to service client. Fix the policy.
- Remember: `DROP FUNCTION ... CASCADE` silently destroys RLS policies.

### API Key Auth
- `createUserScopedClient()` uses service role — bypasses RLS
- If a test passes with API key but fails with JWT, the bug is in the RLS policy
- QA user (qa@ubtrippin.xyz) tests should use JWT auth path

### Split-Brain (CLI vs API vs MCP)
- If behavior differs between interfaces, one is calling Supabase directly
- CI guardrail blocks direct Supabase calls in user-facing commands
- `FORMAT=json ubt ...` for debugging CLI output

### FlightAware
- Only call FA when a human loads a page (no background polling)
- 5-min staleness cache
- Check `normalizeStatusRow()` for null handling

## Defense-in-Depth

When you fix a bug, add validation at EVERY layer:
1. **Entry point** — reject invalid input at API boundary
2. **Business logic** — ensure data makes sense for the operation
3. **Environment guards** — prevent dangerous operations in test/prod contexts
4. **Debug instrumentation** — log context for forensics

Single validation = "we fixed the bug." Multiple layers = "we made the bug impossible."
