#!/bin/bash
# check-agents.sh — Deterministic agent monitoring. Zero LLM tokens.
# Checks tmux sessions, done markers, PRs, CI status, reviews.
# Exit 0 with JSON output. Alerts = action needed.

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

def safe_json(stdout):
    try:
        return json.loads(stdout)
    except (json.JSONDecodeError, ValueError, TypeError):
        return None

def looks_like_gemini(entry):
    user = ((entry or {}).get("user") or {}).get("login", "").lower()
    body = ((entry or {}).get("body") or "").lower()
    return (
        "gemini" in user or
        "gemini code assist" in body or
        ("google" in user and "assist" in body)
    )

def looks_like_claude(entry):
    user = ((entry or {}).get("user") or {}).get("login", "").lower()
    body = ((entry or {}).get("body") or "").lower()
    return (
        "<!-- agent-claude-review -->" in body or
        ("claude review" in body and "github-actions[bot]" in user)
    )

for task in tasks:
    if task.get("status") in ("done", "merged", "cleaned"):
        continue

    task_id = task["id"]
    tmux = task.get("tmuxSession", f"codex-{task_id}")
    branch = task.get("branch", "")
    worktree = task.get("worktree", "")

    if "checks" not in task:
        task["checks"] = {}

    # Check tmux alive
    tmux_alive = subprocess.run(
        ["tmux", "has-session", "-t", tmux],
        capture_output=True
    ).returncode == 0

    # Check done marker
    done_marker = os.path.exists(f"/tmp/agent-{task_id}-done")

    # --- PHASE 1: Agent finished, needs push + PR ---
    if done_marker and task.get("status") == "running" and worktree:
        # Auto-commit if uncommitted changes
        subprocess.run(["git", "add", "-A"], cwd=worktree, capture_output=True)
        has_changes = subprocess.run(
            ["git", "diff", "--cached", "--quiet"], cwd=worktree, capture_output=True
        ).returncode != 0
        if has_changes:
            subprocess.run(
                ["git", "commit", "-m", f"feat({task_id}): agent build"],
                cwd=worktree, capture_output=True
            )

        # Rebase + push
        subprocess.run(["git", "fetch", "origin", "--quiet"], cwd=REPO, capture_output=True)
        subprocess.run(["git", "rebase", "origin/main"], cwd=worktree, capture_output=True)
        push = subprocess.run(
            ["git", "push", "-u", "origin", branch, "--force-with-lease"],
            cwd=worktree, capture_output=True, text=True
        )

        if push.returncode == 0:
            # Create PR if none exists
            if not task.get("pr"):
                pr_result = subprocess.run(
                    ["gh", "pr", "create", "--base", "main", "--fill", "--label", "agent-built"],
                    cwd=worktree, capture_output=True, text=True
                )
                if pr_result.returncode == 0:
                    pr_url = pr_result.stdout.strip()
                    # Extract PR number
                    try:
                        pr_num = int(pr_url.split("/")[-1])
                        task["pr"] = pr_num
                        task["pr_url"] = pr_url
                    except:
                        pass

            task["status"] = "review"
            alerts.append(f"📦 Agent {task_id} pushed — PR #{task.get('pr', '?')} ready for review pipeline")
        else:
            task["status"] = "needs_push"
            alerts.append(f"⚠️ Agent {task_id} finished but push failed. Branch: {branch}")
        updated = True
        continue

    # Agent died without done marker
    if not tmux_alive and not done_marker and task.get("status") == "running":
        attempts = task.get("attempts", 1)
        max_attempts = task.get("maxAttempts", 3)
        if attempts < max_attempts:
            task["status"] = "needs_respawn"
            task["attempts"] = attempts + 1
            alerts.append(f"🔄 Agent {task_id} died (attempt {attempts}/{max_attempts}) — needs respawn")
        else:
            task["status"] = "failed"
            alerts.append(f"💀 Agent {task_id} died after {max_attempts} attempts")
        updated = True
        continue

    # --- PHASE 2: PR exists, check CI + reviews ---
    if task.get("pr") and task.get("status") in ("review", "ready", "ci_failed"):
        pr_num = task["pr"]

        # CI status
        result = subprocess.run(
            ["gh", "pr", "checks", str(pr_num), "--json", "name,state,conclusion"],
            capture_output=True, text=True, cwd=REPO
        )
        try:
            checks_data = json.loads(result.stdout)
            if checks_data:
                all_complete = all(c.get("state") in ("COMPLETED", "completed") for c in checks_data)
                ci_passed = all_complete and all(
                    c.get("conclusion") in ("SUCCESS", "success")
                    for c in checks_data
                )
                ci_failed = any(
                    c.get("conclusion") in ("FAILURE", "failure")
                    for c in checks_data
                    if c.get("state") in ("COMPLETED", "completed")
                )

                if not all_complete:
                    task["checks"]["ci"] = "pending"
                elif ci_failed:
                    task["checks"]["ci"] = "failed"
                elif ci_passed:
                    task["checks"]["ci"] = "passed"
            else:
                task["checks"]["ci"] = "no-checks"
        except:
            task["checks"]["ci"] = "unknown"

        # Review sources (Gemini + Claude)
        issue_comments_result = subprocess.run(
            ["gh", "api", f"repos/fistfulayen/ubtrippin/issues/{pr_num}/comments"],
            capture_output=True, text=True, cwd=REPO
        )
        review_threads_result = subprocess.run(
            ["gh", "api", f"repos/fistfulayen/ubtrippin/pulls/{pr_num}/reviews"],
            capture_output=True, text=True, cwd=REPO
        )

        issue_comments = safe_json(issue_comments_result.stdout) or []
        review_threads = safe_json(review_threads_result.stdout) or []

        has_gemini = any(looks_like_gemini(c) for c in issue_comments) or any(
            looks_like_gemini(r) for r in review_threads
        )
        has_claude = any(looks_like_claude(c) for c in issue_comments) or any(
            looks_like_claude(r) for r in review_threads
        )

        automated_reviews = int(has_gemini) + int(has_claude)
        task["checks"]["gemini"] = "present" if has_gemini else "missing"
        task["checks"]["claude"] = "present" if has_claude else "missing"
        task["checks"]["reviews"] = automated_reviews

        # Determine overall readiness
        ci = task["checks"].get("ci")
        reviews = task["checks"].get("reviews", 0)

        if ci == "passed" and reviews >= 2 and task["status"] != "ready":
            task["status"] = "ready"
            alerts.append(
                f"✅ PR #{pr_num} ({task_id}) — CI passed with Gemini + Claude reviews. "
                "Ready for Ian human approval (Signal only; no auto-merge)."
            )
            updated = True
        elif ci == "failed" and task["status"] != "ci_failed":
            task["status"] = "ci_failed"
            alerts.append(f"❌ PR #{pr_num} ({task_id}) — CI failed. Needs fix.")
            updated = True
        elif ci == "passed" and reviews < 2:
            # CI passed but waiting for reviews
            updated = True

if updated:
    with open(REGISTRY, "w") as f:
        json.dump(tasks, f, indent=2)

# Output
active = [
    {
        "id": t["id"],
        "status": t.get("status"),
        "branch": t.get("branch"),
        "pr": t.get("pr"),
        "checks": t.get("checks", {}),
    }
    for t in tasks
    if t.get("status") not in ("done", "merged", "cleaned")
]

output = {"tasks": active, "alerts": alerts}
print(json.dumps(output, indent=2))
PYEOF
