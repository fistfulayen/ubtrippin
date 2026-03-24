# Test-Driven Development — Adapted for UBT

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over. No exceptions.

## Red-Green-Refactor

### RED — Write Failing Test
- One behavior per test
- Clear name describing what should happen
- Real code, no mocks unless unavoidable
- Run: `npm test -- --testPathPattern="path" -t "test name"`
- Confirm: test FAILS because feature is missing (not because of typos)

### GREEN — Minimal Code
- Simplest code that passes the test
- Don't add features, don't refactor, don't "improve"
- Run: `npm test -- --testPathPattern="path"`
- Confirm: test passes, ALL other tests still pass

### REFACTOR — Clean Up
- Only after green
- Remove duplication, improve names, extract helpers
- Keep tests green throughout
- Don't add behavior

### Repeat

## When to Use TDD

**Always:** New features, bug fixes, refactoring, behavior changes

**Exceptions (ask Ian):** Throwaway prototypes, generated code, config files

## UBT-Specific Testing Rules

- Tests verify real behavior, not mocks
- No test-only methods in production classes (put in test utils)
- Mock at the lowest level needed (DB, external API), not high-level functions
- Integration tests preferred over complex mock setups
- API route tests should use the actual API handler, not bypass it

## Testing Anti-Patterns (DON'T)

| Anti-Pattern | Fix |
|--------------|-----|
| Assert on mock elements | Test real component |
| Test-only methods in production | Move to test utilities |
| Mock without understanding deps | Understand first, mock minimally |
| Incomplete mocks | Mirror real API response fully |
| Tests as afterthought | Tests first, always |

## Verification

Before claiming tests pass:
1. Run the command
2. Read the output
3. Count the failures (must be 0)
4. THEN claim it passes

"Should pass now" is not verification. Run it.
