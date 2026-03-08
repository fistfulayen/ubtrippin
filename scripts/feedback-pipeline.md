# Feedback-to-Fix Pipeline

## Status Flow

```
new → triaged → building → review → merge-ready → shipped
                                                 → acknowledged
```

- **new** — user submitted, nobody's looked at it
- **triaged** — opus evaluated, admin_notes has reasoning
- **building** — codex is implementing the fix
- **review** — PR exists, code reviews in progress
- **merge-ready** — all CI green, reviews addressed, awaiting Ian's merge
- **shipped** — Ian merged, fix is live
- **acknowledged** — we read it, it's valid feedback, but we're not acting on it now (polite decline)

## Pipeline Steps

### Step 1: Triage (opus)
Read all `status=new` feedback. For each item:
- Is this a real bug, a feature request, or noise?
- Is it actionable (can we actually fix/build this)?
- Is it a duplicate of something already shipped or in progress?
- What's the user impact? How many users would benefit?
- Write reasoning to `admin_notes`
- Set status to `triaged`
- If actionable bug: write a mini-PRD in admin_notes and proceed to Step 2
- If feature request worth building: write PRD in Obsidian, message Ian for approval, set status to `triaged`
- If not actionable: set status to `acknowledged`, write polite reasoning in admin_notes

### Step 2: Build (codex/gpt-5.4)
- Spawn Codex with the triage notes as context
- Create branch `fix/feedback-<id>` or `feat/feedback-<id>`
- Build the fix, run tests
- Push and create PR with description of exactly what changes on the site

### Step 3: Follow-through (watchdog)
- Monitor CI, address code review findings
- Run merge-ready gate
- When ready: message Ian with PR link + plain-English description of what the change does

### Step 4: Resolution
- Ian merges → status = `shipped`
- Ian declines → status = `acknowledged`
