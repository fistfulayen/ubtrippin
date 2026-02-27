#!/bin/bash
# monitor-cron.sh — Check agent status every 5 min, alert Jacques via system event
# Cron: */5 * * * * /home/iancr/ubtrippin/scripts/monitor-cron.sh
#
# Key insight: Codex runs in a sandbox and CANNOT push or create PRs.
# Jacques must push, PR, and manage the pipeline manually.
# This monitor detects when agents finish and alerts Jacques to take action.

set -uo pipefail

REGISTRY="/home/iancr/ubtrippin/.openclaw/active-tasks.json"
ALERT_STATE="/tmp/agent-monitor-alerted.json"

if [ ! -f "$REGISTRY" ]; then
  exit 0
fi

ALERTS=$(python3 << 'PYEOF'
import json, subprocess, os, sys

REGISTRY = "/home/iancr/ubtrippin/.openclaw/active-tasks.json"
ALERT_STATE = "/tmp/agent-monitor-alerted.json"

try:
    with open(REGISTRY) as f:
        tasks = json.load(f)
except:
    sys.exit(0)

# Load already-alerted set to avoid spamming
try:
    with open(ALERT_STATE) as f:
        alerted = set(json.load(f))
except:
    alerted = set()

alerts = []
updated = False

for task in tasks:
    if task["status"] in ("done", "merged", "cleaned"):
        continue

    task_id = task["id"]
    tmux = task["tmuxSession"]

    # Check done marker (Codex touches this when finished)
    done_marker = os.path.exists(f"/tmp/agent-{task_id}-done")

    # Check if tmux session is still alive
    tmux_alive = subprocess.run(
        ["tmux", "has-session", "-t", tmux],
        capture_output=True
    ).returncode == 0

    alert_key = f"{task_id}-done"

    if done_marker and task["status"] == "running" and alert_key not in alerted:
        alerts.append(f"✅ Agent {task_id} finished (branch: {task['branch']}). Push, create PR, and apply migration if needed.")
        task["status"] = "needs_push"
        alerted.add(alert_key)
        updated = True

    elif not tmux_alive and not done_marker and task["status"] == "running":
        fail_key = f"{task_id}-died"
        if fail_key not in alerted:
            alerts.append(f"💀 Agent {task_id} died without completing. Check tmux logs: tmux capture-pane -t {tmux} -p -S -50")
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
