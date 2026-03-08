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
CHECKS=$(gh pr checks "$PR" 2>&1 || true)
if echo "$CHECKS" | grep -qi "fail"; then
  fail "CI has failing checks"
  echo "$CHECKS" | grep -i "fail"
elif echo "$CHECKS" | grep -qi "pending"; then
  fail "CI still running — wait for completion"
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
REVIEWS=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length' 2>/dev/null || echo "0")
if [ "$REVIEWS" -gt 0 ]; then
  fail "Has CHANGES_REQUESTED reviews"
else
  pass "No blocking reviews (CHANGES_REQUESTED)"
fi

# Check for unaddressed inline review comments from code review bots
# These are substantive findings (security, correctness) that MUST be addressed
REVIEW_COMMENTS=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/comments" --jq 'length' 2>/dev/null || echo "0")
BOT_FINDINGS=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/comments" \
  --jq '[.[] | select(.user.login | test("gemini|claude|github-actions"; "i")) | select(.body | test("security|critical|high|medium|bug|risk|incorrect|regression"; "i"))] | length' \
  2>/dev/null || echo "0")

if [ "$BOT_FINDINGS" -gt 0 ]; then
  # Check if there are commits AFTER the review comments (i.e., fixes were pushed)
  LAST_REVIEW_TIME=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/comments" \
    --jq '[.[] | select(.user.login | test("gemini|claude|github-actions"; "i"))] | sort_by(.created_at) | last | .created_at' \
    2>/dev/null || echo "")
  LAST_COMMIT_TIME=$(gh api "repos/${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}/pulls/${PR}/commits" \
    --jq 'last | .commit.committer.date' \
    2>/dev/null || echo "")

  if [ -n "$LAST_REVIEW_TIME" ] && [ -n "$LAST_COMMIT_TIME" ] && [[ "$LAST_COMMIT_TIME" > "$LAST_REVIEW_TIME" ]]; then
    pass "Code review findings addressed (${BOT_FINDINGS} findings, commits pushed after reviews)"
  else
    fail "Code review bots found ${BOT_FINDINGS} substantive issues — address them before declaring merge-ready"
    echo "   Run: gh api repos/fistfulayen/ubtrippin/pulls/${PR}/comments --jq '.[] | select(.user.login | test(\"gemini|claude\"; \"i\")) | .body[:200]'"
  fi
else
  pass "No substantive bot review findings"
fi
echo "   Total inline comments: $REVIEW_COMMENTS"

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
