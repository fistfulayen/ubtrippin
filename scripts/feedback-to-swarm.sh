#!/bin/bash
# feedback-to-swarm.sh — Check for new feedback, triage, spawn agents for fixes
#
# Called by cron daily. Zero tokens if no new feedback.
# Flow: query DB → evaluate → write prompt → spawn Codex → PR created → Ian reviews
#
# Dependencies: ubt-admin, psql or supabase CLI, spawn-agent.sh

set -euo pipefail

REPO_ROOT="/home/iancr/ubtrippin"
STATE_FILE="$REPO_ROOT/.openclaw/feedback-state.json"
SUPABASE_URL="${SUPABASE_URL:-https://cqijgtijuselspyzpphf.supabase.co}"

# Ensure state file exists
mkdir -p "$(dirname "$STATE_FILE")"
if [ ! -f "$STATE_FILE" ]; then
  echo '{"lastCheckedAt":"2026-01-01T00:00:00Z","processedIds":[]}' > "$STATE_FILE"
fi

LAST_CHECKED=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['lastCheckedAt'])")

# Query new feedback since last check via API
NEW_FEEDBACK=$(curl -s -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
  "${SUPABASE_URL}/rest/v1/feedback?created_at=gt.${LAST_CHECKED}&order=created_at.asc&select=id,title,body,type,status,created_at,user_id" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null || echo "[]")

COUNT=$(echo "$NEW_FEEDBACK" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$COUNT" = "0" ]; then
  echo "No new feedback."
  exit 0
fi

echo "Found $COUNT new feedback item(s)."
echo "$NEW_FEEDBACK" | python3 -c "
import json, sys
items = json.load(sys.stdin)
for item in items:
    print(f\"  [{item['type']}] {item['title']} (id: {item['id'][:8]}...)\")
"

# Output for the cron agent to process
# The cron runs in Jacques's session — Jacques evaluates and decides:
# - Bug → write prompt + spawn agent
# - Feature request → write PRD draft
# - Won't fix → mark as reviewed
echo ""
echo "=== FEEDBACK FOR TRIAGE ==="
echo "$NEW_FEEDBACK"
echo "=== END FEEDBACK ==="

# Update last checked timestamp
python3 << PYEOF
import json
from datetime import datetime, timezone

with open("$STATE_FILE") as f:
    state = json.load(f)

state["lastCheckedAt"] = datetime.now(timezone.utc).isoformat()

with open("$STATE_FILE", "w") as f:
    json.dump(state, f, indent=2)
PYEOF

echo "State updated."
