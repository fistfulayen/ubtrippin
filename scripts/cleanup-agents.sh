#!/bin/bash
# cleanup-agents.sh — Remove worktrees and registry entries for merged PRs
# Run daily via cron. Zero tokens.

set -uo pipefail

REPO_ROOT="/home/iancr/ubtrippin"
REGISTRY="$REPO_ROOT/.openclaw/active-tasks.json"

if [ ! -f "$REGISTRY" ]; then
  echo "No registry found. Nothing to clean."
  exit 0
fi

cd "$REPO_ROOT"

python3 << 'PYEOF'
import json, subprocess, os

REGISTRY = "/home/iancr/ubtrippin/.openclaw/active-tasks.json"
REPO = "/home/iancr/ubtrippin"

with open(REGISTRY) as f:
    tasks = json.load(f)

cleaned = 0
remaining = []

for task in tasks:
    pr = task.get("pr")
    should_clean = False

    # Clean merged PRs
    if pr and task["status"] in ("ready", "review", "done", "merged"):
        result = subprocess.run(
            ["gh", "pr", "view", str(pr), "--json", "state"],
            capture_output=True, text=True, cwd=REPO
        )
        try:
            state = json.loads(result.stdout).get("state")
            if state == "MERGED":
                should_clean = True
        except:
            pass

    # Clean failed tasks older than 24h
    if task["status"] == "failed":
        import time
        age_hours = (time.time() * 1000 - task.get("startedAt", 0)) / (1000 * 3600)
        if age_hours > 24:
            should_clean = True

    if should_clean:
        worktree = task.get("worktree")
        branch = task.get("branch")

        # Remove worktree
        if worktree and os.path.exists(worktree):
            subprocess.run(
                ["git", "worktree", "remove", worktree, "--force"],
                cwd=REPO, capture_output=True
            )
            print(f"Removed worktree: {worktree}")

        # Delete local branch
        if branch:
            subprocess.run(
                ["git", "branch", "-D", branch],
                cwd=REPO, capture_output=True
            )

        # Clean done marker
        marker = f"/tmp/agent-{task['id']}-done"
        if os.path.exists(marker):
            os.remove(marker)

        # Kill tmux session if still around
        subprocess.run(
            ["tmux", "kill-session", "-t", task["tmuxSession"]],
            capture_output=True
        )

        print(f"Cleaned: {task['id']} (PR #{pr or 'none'})")
        cleaned += 1
        continue

    remaining.append(task)

with open(REGISTRY, "w") as f:
    json.dump(remaining, f, indent=2)

print(f"\nCleaned {cleaned} tasks. {len(remaining)} remaining.")
PYEOF
