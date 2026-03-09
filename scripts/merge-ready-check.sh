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

# 3. No unresolved review comments — check that commits exist AFTER review comments
echo ""
echo "--- Code Reviews ---"
REPO="${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}"
REVIEWS=$(gh api "repos/${REPO}/pulls/${PR}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length' 2>/dev/null || echo "0")
if [ "$REVIEWS" -gt 0 ]; then
  fail "Has CHANGES_REQUESTED reviews"
else
  pass "No blocking reviews"
fi

# Check for high/medium severity findings that may need addressing
REVIEW_COMMENTS=$(gh api "repos/${REPO}/pulls/${PR}/comments" 2>/dev/null || echo "[]")
COMMENT_COUNT=$(echo "$REVIEW_COMMENTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
HIGH_MEDIUM=$(echo "$REVIEW_COMMENTS" | python3 -c "
import sys, json
comments = json.load(sys.stdin)
findings = [c for c in comments if 'high' in c.get('body','').lower()[:200] or 'security-high' in c.get('body','').lower()[:200]]
print(len(findings))
" 2>/dev/null || echo "0")

if [ "$COMMENT_COUNT" -gt 0 ]; then
  # Get the timestamp of the last review comment
  LAST_COMMENT_TIME=$(echo "$REVIEW_COMMENTS" | python3 -c "
import sys, json
comments = json.load(sys.stdin)
if comments:
    times = [c['created_at'] for c in comments]
    print(max(times))
else:
    print('')
" 2>/dev/null || echo "")

  # Get the timestamp of the last commit on the PR
  LAST_COMMIT_TIME=$(gh api "repos/${REPO}/pulls/${PR}/commits" --jq '.[-1].commit.committer.date' 2>/dev/null || echo "")

  if [ -n "$LAST_COMMENT_TIME" ] && [ -n "$LAST_COMMIT_TIME" ]; then
    if [[ "$LAST_COMMIT_TIME" > "$LAST_COMMENT_TIME" ]]; then
      pass "Commits exist after last review comment ($COMMENT_COUNT comments, $HIGH_MEDIUM high/security)"
    else
      fail "No commits after review comments — $COMMENT_COUNT findings ($HIGH_MEDIUM high/security) may be unaddressed"
    fi
  else
    echo "⚠️  Could not determine review/commit timeline"
  fi
else
  pass "No inline review comments"
fi

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
