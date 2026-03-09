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

# 3. No unresolved review comments — full review cycle check
echo ""
echo "--- Code Reviews ---"
REPO="${GITHUB_REPOSITORY:-fistfulayen/ubtrippin}"
REVIEWS=$(gh api "repos/${REPO}/pulls/${PR}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length' 2>/dev/null || echo "0")
if [ "$REVIEWS" -gt 0 ]; then
  fail "Has CHANGES_REQUESTED reviews"
else
  pass "No blocking reviews"
fi

# Check that review findings are addressed AND re-reviewed
REVIEW_COMMENTS=$(gh api "repos/${REPO}/pulls/${PR}/comments" 2>/dev/null || echo "[]")
COMMENT_COUNT=$(echo "$REVIEW_COMMENTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$COMMENT_COUNT" -gt 0 ]; then
  LAST_COMMIT_TIME=$(gh api "repos/${REPO}/pulls/${PR}/commits" --jq '.[-1].commit.committer.date' 2>/dev/null || echo "")

  COMMENT_ANALYSIS=$(echo "$REVIEW_COMMENTS" | python3 -c "
import sys, json
comments = json.load(sys.stdin)
commit_time = '${LAST_COMMIT_TIME}'
if not commit_time or not comments:
    print('unknown')
    sys.exit()
post_fix = [c for c in comments if c['created_at'] > commit_time]
pre_fix = [c for c in comments if c['created_at'] <= commit_time]
post_high = len([c for c in post_fix if any(k in c.get('body','').lower()[:200] for k in ['high', 'security-high'])])
post_medium = len([c for c in post_fix if 'medium' in c.get('body','').lower()[:200]])
if post_fix:
    print(f'new_findings:{len(post_fix)}:{post_high}:{post_medium}')
elif pre_fix:
    print(f'awaiting_re_review:{len(pre_fix)}')
else:
    print('clean')
" 2>/dev/null || echo "unknown")

  if [[ "$COMMENT_ANALYSIS" == clean ]]; then
    pass "No review findings"
  elif [[ "$COMMENT_ANALYSIS" == unknown ]]; then
    echo "⚠️  Could not determine review/commit timeline"
  elif [[ "$COMMENT_ANALYSIS" == new_findings:* ]]; then
    IFS=: read -r _ count high medium <<< "$COMMENT_ANALYSIS"
    fail "Reviewers found $count new issues after fix commits ($high high, $medium medium) — address these"
  elif [[ "$COMMENT_ANALYSIS" == awaiting_re_review:* ]]; then
    IFS=: read -r _ pre_count <<< "$COMMENT_ANALYSIS"
    POST_FIX_REVIEWS=$(gh api "repos/${REPO}/pulls/${PR}/reviews" --jq "[.[] | select(.submitted_at > \"${LAST_COMMIT_TIME}\")] | length" 2>/dev/null || echo "0")
    if [ "$POST_FIX_REVIEWS" -gt 0 ]; then
      pass "Fixes reviewed — $pre_count pre-fix comments, $POST_FIX_REVIEWS post-fix reviews"
    else
      fail "Fixes pushed but not yet re-reviewed ($pre_count findings addressed, awaiting reviewer confirmation)"
    fi
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
