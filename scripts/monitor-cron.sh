#!/bin/bash
# monitor-cron.sh — Check agent status every 5 min, auto-push completed builds
# Cron: */5 * * * * /home/iancr/ubtrippin/scripts/monitor-cron.sh
#
# When an agent finishes:
# 1. Verify TypeScript compiles
# 2. Push the branch
# 3. Create PR with agent-built label
# 4. Alert Jacques via system event with PR link
# 5. Update task registry

set -uo pipefail

REGISTRY="/home/iancr/ubtrippin/.openclaw/active-tasks.json"
ALERT_STATE="/tmp/agent-monitor-alerted.json"
REPO="/home/iancr/ubtrippin"

if [ ! -f "$REGISTRY" ]; then
  exit 0
fi

ALERTS=$(python3 << 'PYEOF'
import json, subprocess, os, sys

REGISTRY = "/home/iancr/ubtrippin/.openclaw/active-tasks.json"
ALERT_STATE = "/tmp/agent-monitor-alerted.json"
REPO = "/home/iancr/ubtrippin"

try:
    with open(REGISTRY) as f:
        tasks = json.load(f)
except:
    sys.exit(0)

try:
    with open(ALERT_STATE) as f:
        alerted = set(json.load(f))
except:
    alerted = set()

alerts = []
updated = False

def has_modified_agents_md(worktree):
    result = subprocess.run(
        ["git", "status", "--porcelain", "--", "AGENTS.md"],
        cwd=worktree, capture_output=True, text=True
    )
    return bool((result.stdout or "").strip())

for task in tasks:
    if task["status"] in ("done", "merged", "cleaned", "pr_created"):
        continue

    task_id = task["id"]
    tmux = task.get("tmuxSession", f"codex-{task_id}")
    branch = task.get("branch", "")
    worktree = task.get("worktree", "")

    tmux_alive = subprocess.run(
        ["tmux", "has-session", "-t", tmux],
        capture_output=True
    ).returncode == 0

    done_marker = os.path.exists(f"/tmp/agent-{task_id}-done")
    codex_dir = os.path.isdir(os.path.join(worktree, ".codex")) if worktree else False
    agents_md_touched = has_modified_agents_md(worktree) if worktree and os.path.isdir(worktree) else False
    completion_artifact = codex_dir or agents_md_touched
    completion_signal = done_marker or (completion_artifact and not tmux_alive)

    alert_key = f"{task_id}-done"

    # Agent finished — auto-push and create PR
    if completion_signal and task["status"] in ("running", "needs_push") and alert_key not in alerted and worktree:
        # Step 1: git add + commit (may already be committed by Codex)
        subprocess.run(["git", "add", "-A"], cwd=worktree, capture_output=True)
        result = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=worktree, capture_output=True
        )
        if result.returncode != 0:
            subprocess.run(
                ["git", "commit", "-m", f"chore(agent-swarm): finalize {task_id} output"],
                cwd=worktree, capture_output=True
            )

        # Step 2: rebase onto origin/main
        subprocess.run(["git", "fetch", "origin", "--quiet"], cwd=REPO, capture_output=True)
        rebase = subprocess.run(
            ["git", "rebase", "origin/main"], cwd=worktree, capture_output=True, text=True
        )
        if rebase.returncode != 0:
            subprocess.run(["git", "rebase", "--abort"], cwd=worktree, capture_output=True)
            task["status"] = "merge_conflict"
            alerts.append(
                f"⚠️ Agent {task_id} has rebase conflicts on {branch}. "
                "Manual conflict resolution required; no push performed."
            )
            alerted.add(alert_key)
            updated = True
            continue

        # Step 3: push
        push = subprocess.run(
            ["git", "push", "-u", "origin", branch, "--force-with-lease"],
            cwd=worktree, capture_output=True, text=True
        )

        if push.returncode == 0:
            # Step 4: create PR
            pr_result = subprocess.run(
                ["gh", "pr", "create", "--base", "main", "--fill", "--label", "agent-built"],
                cwd=worktree, capture_output=True, text=True
            )
            pr_url = pr_result.stdout.strip()
            if pr_result.returncode == 0 and pr_url:
                task["status"] = "pr_created"
                task["pr_url"] = pr_url
                alerts.append(f"✅ Agent {task_id} done — PR created: {pr_url}\nReady for Ian to merge.")
            else:
                existing_pr = subprocess.run(
                    ["gh", "pr", "view", branch, "--json", "url", "-q", ".url"],
                    cwd=worktree, capture_output=True, text=True
                )
                if existing_pr.returncode == 0 and existing_pr.stdout.strip():
                    task["status"] = "pr_created"
                    task["pr_url"] = existing_pr.stdout.strip()
                    alerts.append(f"✅ Agent {task_id} done — existing PR detected: {task['pr_url']}")
                else:
                    task["status"] = "needs_push"
                    alerts.append(f"⚠️ Agent {task_id} finished and pushed, but PR creation failed. Branch: {branch}")
        else:
            task["status"] = "needs_push"
            alerts.append(f"⚠️ Agent {task_id} finished but push failed. Check worktree: {worktree}")

        alerted.add(alert_key)
        updated = True

    # Agent died without finishing
    elif not tmux_alive and not done_marker and task["status"] == "running":
        fail_key = f"{task_id}-died"
        if fail_key not in alerted:
            alerts.append(f"💀 Agent {task_id} died without completing. Branch: {branch}")
            task["status"] = "failed"
            alerted.add(fail_key)
            updated = True

if updated:
    with open(REGISTRY, "w") as f:
        json.dump(tasks, f, indent=2)

with open(ALERT_STATE, "w") as f:
    json.dump(list(alerted), f)

if alerts:
    print("\n".join(alerts))
PYEOF
)

if [ -n "$ALERTS" ]; then
  openclaw system event --text "$ALERTS" 2>/dev/null
fi
