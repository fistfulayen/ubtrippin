#!/bin/bash
# spawn-agent.sh — Create isolated worktree, spawn Codex in tmux, register task
#
# Usage: spawn-agent.sh <task-id> <branch-name> <prompt-file> [model] [effort]
# Example: spawn-agent.sh 016-p1 feat/live-trip-status scripts/prompts/016-p1.md

set -euo pipefail

TASK_ID="${1:?Usage: spawn-agent.sh <task-id> <branch> <prompt-file> [model] [effort]}"
BRANCH="${2:?Missing branch name}"
PROMPT_FILE="${3:?Missing prompt file}"
MODEL="${4:-gpt-5.3-codex}"
EFFORT="${5:-high}"

REPO_ROOT="/home/iancr/ubtrippin"
WORKTREE_DIR="/home/iancr/ubtrippin-worktrees/${BRANCH//\//-}"
TMUX_SESSION="codex-${TASK_ID}"
REGISTRY="$REPO_ROOT/.openclaw/active-tasks.json"

# Validate prompt file exists
if [ ! -f "$REPO_ROOT/$PROMPT_FILE" ]; then
  echo "Error: prompt file not found: $REPO_ROOT/$PROMPT_FILE"
  exit 1
fi

# Check tmux session doesn't already exist
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  echo "Error: tmux session '$TMUX_SESSION' already exists"
  exit 1
fi

echo "==> Fetching origin..."
cd "$REPO_ROOT"
git fetch origin --quiet

echo "==> Creating worktree at $WORKTREE_DIR..."
git worktree add "$WORKTREE_DIR" -b "$BRANCH" origin/main

echo "==> Installing dependencies..."
cd "$WORKTREE_DIR"
pnpm install --frozen-lockfile --silent

# Read prompt
PROMPT=$(cat "$REPO_ROOT/$PROMPT_FILE")

echo "==> Spawning Codex in tmux session: $TMUX_SESSION"
tmux new-session -d -s "$TMUX_SESSION" -c "$WORKTREE_DIR" \
  "codex exec --full-auto --model $MODEL -c 'model_reasoning_effort=$EFFORT' '${PROMPT//\'/\'\\\'\'}

When completely finished:
1. Run: npx tsc --noEmit
2. If clean, commit all changes with a descriptive message
3. Run: git push -u origin $BRANCH
4. Run: gh pr create --base main --fill --label agent-built
5. Touch /tmp/agent-${TASK_ID}-done
'; echo 'Agent exited. Press enter to close.'; read"

# Register task
python3 << PYEOF
import json, time, os

registry_path = "$REGISTRY"
os.makedirs(os.path.dirname(registry_path), exist_ok=True)

try:
    with open(registry_path) as f:
        tasks = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    tasks = []

tasks.append({
    "id": "$TASK_ID",
    "tmuxSession": "$TMUX_SESSION",
    "agent": "codex",
    "model": "$MODEL",
    "branch": "$BRANCH",
    "worktree": "$WORKTREE_DIR",
    "promptFile": "$PROMPT_FILE",
    "startedAt": int(time.time() * 1000),
    "status": "running",
    "attempts": 1,
    "maxAttempts": 3,
    "pr": None,
    "checks": {}
})

with open(registry_path, "w") as f:
    json.dump(tasks, f, indent=2)

PYEOF

echo ""
echo "✅ Agent spawned"
echo "   Task:    $TASK_ID"
echo "   Session: $TMUX_SESSION"
echo "   Branch:  $BRANCH"
echo "   Worktree: $WORKTREE_DIR"
echo ""
echo "Monitor: tmux attach -t $TMUX_SESSION"
echo "Steer:   tmux send-keys -t $TMUX_SESSION 'your message' Enter"
