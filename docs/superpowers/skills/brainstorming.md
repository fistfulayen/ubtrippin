# Brainstorming — Adapted for UBT

Turn PRDs and ideas into validated design specs through collaborative dialogue.

## HARD GATE

Do NOT write code, spawn agents, or take any implementation action until:
1. Design is presented and Ian approves
2. Spec is written and reviewed
3. Ian reviews the written spec

## Process

1. **Read existing PRD** (if one exists in Obsidian `UB Trippin/PRDs/`)
2. **Explore project context** — check files, docs, recent commits in repo
3. **Ask clarifying questions** — one at a time, prefer multiple choice
4. **Propose 2-3 approaches** — with trade-offs, lead with recommendation
5. **Present design in sections** — get Ian's approval after each section
6. **Write spec doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<feature>.md`
7. **Spec review** — dispatch reviewer subagent (see `prompts/spec-document-reviewer-prompt.md`)
   - Fix issues, re-dispatch, max 3 iterations then ask Ian
8. **Ian reviews written spec** — wait for approval before proceeding
9. **Transition** — invoke writing-plans to create implementation plan

## Scope Check

If the spec covers multiple independent subsystems, break into separate plans.
Each plan produces working, testable software on its own.

## Design Principles

- **YAGNI ruthlessly** — remove unnecessary features
- **Design for isolation** — smaller units with clear boundaries and interfaces
- **Follow existing patterns** — explore codebase before proposing changes
- **One question at a time** — don't overwhelm
- **RLS-first** — every data access path must work with RLS enabled
- **API-first** — new features accessible via `/api/v1/` and CLI

## Output

Spec saved to: `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`
Committed to git on feature branch.

**The terminal state is invoking writing-plans.** No other implementation skill.
