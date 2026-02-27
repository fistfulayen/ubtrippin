#!/bin/bash
# check-agents.sh — Deterministic agent monitoring. Zero LLM tokens.
# Checks tmux sessions, PRs, CI status. Outputs JSON.
# Exit 0 with alerts = action needed. Exit 0 no alerts = all quiet.

set -uo pipefail

REPO_ROOT="/home/iancr/ubtrippin"
REGISTRY="$REPO_ROOT/.openclaw/active-tasks.json"

if [ ! -f "$REGISTRY" ]; then
  echo '{"tasks":[],"alerts":[]}'
  exit 0
fi

python3 << 'PYEOF'
import json, subprocess, os, sys

REGISTRY = "/home/iancr/ubtrippin/.openclaw/active-tasks.json"
REPO = "/home/iancr/ubtrippin"

try:
    with open(REGISTRY) as f:
        tasks = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print('{"tasks":[],"alerts":[]}')
    sys.exit(0)

alerts = []
updated = False

for task in tasks:
    if task["status"] not in ("running", "review", "respawning"):
        continue

    task_id = task["id"]
    tmux = task["tmuxSession"]
    branch = task["branch"]

    # Check tmux alive
    tmux_alive = subprocess.run(
        ["tmux", "has-session", "-t", tmux],
        capture_output=True
    ).returncode == 0

    # Check done marker
    done_marker = os.path.exists(f"/tmp/agent-{task_id}-done")

    # Check for PR if we don't have one yet
    if not task.get("pr"):
        result = subprocess.run(
            ["gh", "pr", "list", "--head", branch, "--json", "number,state", "--limit", "1"],
            capture_output=True, text=True, cwd=REPO
        )
        try:
            prs = json.loads(result.stdout)
            if prs:
                task["pr"] = prs[0]["number"]
                task["status"] = "review"
                updated = True
        except:
            pass

    # If we have a PR, check CI and reviews
    if task.get("pr"):
        pr_num = task["pr"]

        # CI status via gh pr checks
        result = subprocess.run(
            ["gh", "pr", "checks", str(pr_num), "--json", "name,state,conclusion"],
            capture_output=True, text=True, cwd=REPO
        )
        try:
            checks_data = json.loads(result.stdout)
            if checks_data:
                ci_passed = all(
                    c.get("conclusion") in ("SUCCESS", "success")
                    for c in checks_data
                    if c.get("state") in ("COMPLETED", "completed")
                )
                ci_pending = any(
                    c.get("state") not in ("COMPLETED", "completed")
                    for c in checks_data
                )
                ci_failed = any(
                    c.get("conclusion") in ("FAILURE", "failure")
                    for c in checks_data
                )

                if ci_pending:
                    task["checks"]["ci"] = "pending"
                elif ci_failed:
                    task["checks"]["ci"] = "failed"
                elif ci_passed:
                    task["checks"]["ci"] = "passed"
            else:
                task["checks"]["ci"] = "no-checks"
        except:
            task["checks"]["ci"] = "unknown"

        # Review count
        result = subprocess.run(
            ["gh", "pr", "view", str(pr_num), "--json", "reviews"],
            capture_output=True, text=True, cwd=REPO
        )
        try:
            reviews = json.loads(result.stdout).get("reviews", [])
            task["checks"]["reviews"] = len(reviews)
            approved = [r for r in reviews if r.get("state") == "APPROVED"]
            task["checks"]["approved"] = len(approved)
        except:
            pass

        updated = True

        # PR ready: CI passed
        if task["checks"].get("ci") == "passed" and task["status"] != "ready":
            task["status"] = "ready"
            alerts.append(f"✅ PR #{pr_num} ({task_id}) ready for review — CI passed, {task['checks'].get('reviews', 0)} reviews")

        # CI failed
        if task["checks"].get("ci") == "failed" and task["status"] != "failed":
            task["status"] = "ci_failed"
            alerts.append(f"❌ PR #{pr_num} ({task_id}) CI failed — needs intervention")

    # Agent died without PR
    if not tmux_alive and not task.get("pr") and task["status"] == "running":
        if done_marker:
            alerts.append(f"⚠️ Agent {task_id} finished but no PR found — check branch {branch}")
            task["status"] = "needs_attention"
        else:
            if task.get("attempts", 1) < task.get("maxAttempts", 3):
                alerts.append(f"🔄 Agent {task_id} died — attempt {task['attempts']}/{task['maxAttempts']}")
                task["status"] = "respawning"
            else:
                alerts.append(f"💀 Agent {task_id} died after {task['maxAttempts']} attempts — needs manual help")
                task["status"] = "failed"
        updated = True

    # Agent finished and PR exists — clean state
    if not tmux_alive and task.get("pr") and done_marker and task["status"] == "running":
        task["status"] = "review"
        updated = True

if updated:
    with open(REGISTRY, "w") as f:
        json.dump(tasks, f, indent=2)

# Output
active = [
    {
        "id": t["id"],
        "status": t["status"],
        "branch": t["branch"],
        "pr": t.get("pr"),
        "checks": t.get("checks", {}),
        "tmux": t["tmuxSession"]
    }
    for t in tasks
    if t["status"] not in ("done", "cleaned", "merged")
]

output = {"tasks": active, "alerts": alerts}
print(json.dumps(output, indent=2))
PYEOF
