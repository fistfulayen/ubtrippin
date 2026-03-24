# Superpowers — Adapted for UB Trippin

Structured development workflow based on [obra/superpowers](https://github.com/obra/superpowers),
adapted for our OpenClaw + Codex + Claude Code toolchain.

## The Pipeline

```
PRD (Obsidian) → Brainstorm (PA + Ian) → Spec Doc → Plan Doc → 
  Per-task subagent (model matched) → Spec review → Quality review →
  Next task → Final review → PR → Merge-ready gate → Ian merges
```

## Directory Structure

```
docs/superpowers/
├── README.md           ← you are here
├── specs/              ← design specs (output of brainstorming)
├── plans/              ← implementation plans (output of writing-plans)
└── prompts/            ← subagent prompt templates
```

## Skills (in execution order)

1. **brainstorming** — Refine PRD into validated spec through Socratic dialogue
2. **writing-plans** — Break spec into bite-sized tasks with exact file paths and code
3. **subagent-driven-development** — Execute plan task-by-task via sessions_spawn
4. **test-driven-development** — RED-GREEN-REFACTOR, no exceptions
5. **systematic-debugging** — 4-phase root cause process
6. **requesting-code-review** — Two-stage: spec compliance then code quality
7. **receiving-code-review** — How to handle feedback (verify, don't perform)
8. **verification-before-completion** — Evidence before claims
9. **finishing-a-branch** — Tests pass → PR → merge-ready gate → Ian

## Model Selection (our aliases)

| Task Type | Model | When |
|-----------|-------|------|
| Mechanical implementation | flash-lite or kimi | 1-2 files, clear spec, isolated |
| Integration work | sonnet | Multi-file, cross-concern |
| Architecture/design/review | opus or gemini | Judgment, broad codebase understanding |
| Quick CI checks | flash-lite | Status polling, simple review |

## Our Adaptations

- **Subagents** via `sessions_spawn` (runtime: "subagent" or "acp"), not Claude Code native
- **Build tracking** via `memory/build-tracker.json`, not TodoWrite
- **Branches** not worktrees (Codex clones fresh, we use feature branches)
- **Merge-ready gate** via `scripts/merge-ready-check.sh` (CI + reviews + no warnings)
- **PRDs live in Obsidian** (`UB Trippin/PRDs/`), specs and plans live here in the repo
- **Review comment discipline**: reply in-thread on GitHub, never declare merge-ready with unaddressed findings
- **RLS rule**: never bypass with service client. If RLS blocks, fix the policy.
- **Privacy rule**: all PRs anonymized, no real names/hotel names/addresses

## Integration with Existing Process

- Wiggum Loop still applies: autonomy to merge-ready, Ian reviews final product
- Heartbeat still monitors builds via build-tracker.json
- CI Watcher cron still checks PR status
- QA reports still trigger auto-fix protocol
