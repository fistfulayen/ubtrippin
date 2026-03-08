#!/usr/bin/env bash
# merge-ready-check.sh — Run before declaring ANY PR merge-ready.
# If this script doesn't pass, don't message Ian.
set -euo pipefail

PR=${1:?Usage: merge-ready-check.sh <PR_NUMBER>}
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0
pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAIL=1; }

echo "=== Merge-Ready Check for PR #${PR} ==="
echo ""

# 1. All CI checks pass
echo "--- CI Status ---"
CHECKS=$(gh pr checks "$PR" 2>&1)
if echo "$CHECKS" | grep -q "fail"; then
  fail "CI has failing checks"
  echo "$CHECKS" | grep "fail"
else
  pass "All CI checks pass"
fi

# 2. Parity check - no missing endpoints
echo ""
echo "--- API Parity ---"
# Check latest CI parity check result, not stale PR comments
PARITY_CHECK=$(gh pr checks "$PR" 2>&1 | grep -i "parity" || true)
if echo "$PARITY_CHECK" | grep -q "fail"; then
  fail "Parity CI check failed"
elif echo "$PARITY_CHECK" | grep -q "pass"; then
  pass "Parity CI check passed"
else
  echo "⚠️  Parity check not found or still running"
fi

# 3. No unresolved review comments
echo ""
echo "--- Code Reviews ---"
REVIEW_COMMENTS=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/comments" --jq 'length' 2>/dev/null || echo "0")
REVIEWS=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length' 2>/dev/null || echo "0")
if [ "$REVIEWS" -gt 0 ]; then
  fail "Has CHANGES_REQUESTED reviews"
else
  pass "No blocking reviews"
fi
echo "   Inline review comments: $REVIEW_COMMENTS"

# 4. Build passes locally
echo ""
echo "--- Local Build ---"
if pnpm build > /dev/null 2>&1; then
  pass "pnpm build passes"
else
  fail "pnpm build fails"
fi

# 5. Tests pass
echo ""
echo "--- Tests ---"
TEST_OUTPUT=$(pnpm test 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Tests.*passed"; then
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -o "[0-9]* passed")
  pass "All tests pass ($TEST_COUNT)"
else
  fail "Tests failing"
  echo "$TEST_OUTPUT" | grep -E "FAIL|Error|✗" | head -5
fi

# 6. Feature launch checklist
echo ""
echo "--- Feature Launch Checklist ---"
DIFF_FILES=$(gh pr diff "$PR" --name-only 2>/dev/null)
if echo "$DIFF_FILES" | grep -q "src/app/api/v1/"; then
  # API changed — check all surfaces
  if echo "$DIFF_FILES" | grep -q "skill/SKILL.md"; then
    pass "Skill docs updated"
  else
    fail "API changed but skill/SKILL.md not updated"
  fi
  
  if echo "$DIFF_FILES" | grep -q "src/app/api/v1/docs"; then
    pass "API docs updated"
  else
    fail "API changed but /api/v1/docs not updated"
  fi
fi

echo ""
echo "================================"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ PR #${PR} is MERGE READY"
  exit 0
else
  echo "❌ PR #${PR} is NOT merge ready — fix the issues above"
  exit 1
fi
