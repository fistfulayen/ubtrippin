# Receiving Code Review — Adapted for UBT

## The Response Pattern

1. **READ:** Complete feedback without reacting
2. **UNDERSTAND:** Restate requirement (or ask)
3. **VERIFY:** Check against codebase reality
4. **EVALUATE:** Technically sound for THIS codebase?
5. **RESPOND:** Technical acknowledgment or reasoned pushback
6. **IMPLEMENT:** One item at a time, test each

## Forbidden

- "You're absolutely right!" / "Great point!" / "Thanks for catching that!"
- Implementing before verifying
- Agreeing without checking

## Instead

- Restate the technical requirement
- Ask clarifying questions if unclear
- Push back with reasoning if wrong
- Just fix it (actions > words)

## Handling Unclear Feedback

If ANY item is unclear, STOP. Don't implement anything yet. Ask for clarification on ALL unclear items first. Partial understanding = wrong implementation.

## External Reviewers (Claude, Gemini, Vercel)

Before implementing:
1. Technically correct for THIS codebase?
2. Breaks existing functionality?
3. Reason for current implementation?
4. Conflicts with Ian's prior decisions?

If wrong → push back with technical reasoning.
If conflicts with Ian → stop and discuss with Ian first.

## YAGNI Check

If reviewer suggests "implementing properly":
- Grep codebase for actual usage
- If unused: "This endpoint isn't called. Remove it (YAGNI)?"
- If used: implement properly

## Implementation Order

1. Clarify unclear items FIRST
2. Then: blocking issues → simple fixes → complex fixes
3. Test each fix individually
4. Verify no regressions

## Acknowledging Correct Feedback

✅ "Fixed. [Brief description]"
✅ "Good catch — [issue]. Fixed in [commit]."
✅ Just fix it and show in the code

❌ "Thanks for catching that!"
❌ Any gratitude expression
❌ Long apologies
