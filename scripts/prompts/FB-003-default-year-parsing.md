# Bug Fix: Default Year Should Be Future-Looking

## Problem
When parsing an itinerary, if a date is provided without a year (e.g., "March 15"), the model defaults to 2024. It should default to the next occurrence of that date (e.g., if today is Feb 28, 2026 and we see "March 15", it should use March 15, 2026, not March 15, 2024).

## Root Cause Analysis
The date parsing logic in the email/ itinerary parser is likely using a fixed fallback year or the model's training cutoff instead of calculating the next future occurrence.

## Files to Investigate
- `src/lib/email-parser.ts` or similar — Email parsing logic
- `src/lib/ai/prompts.ts` — AI prompts for date extraction
- `src/lib/trips/extract-dates.ts` — Date extraction utilities
- Any LLM/system prompts that instruct the model how to parse dates

## Required Fix

1. **Post-process parsed dates:**
   After the AI/model extracts dates, add logic to:
   - Detect dates without a year (or with a past year)
   - Calculate the next future occurrence of that date
   - If the date has already passed this year, use next year

2. **Example logic:**
   ```typescript
   function normalizeDate(dateStr: string, referenceDate: Date = new Date()): Date {
     const parsed = new Date(dateStr);
     
     // If no year specified or year is in the past
     if (parsed.getFullYear() < referenceDate.getFullYear() ||
         (parsed.getFullYear() === referenceDate.getFullYear() && 
          parsed < referenceDate)) {
       // Set to next occurrence
       parsed.setFullYear(referenceDate.getFullYear());
       if (parsed < referenceDate) {
         parsed.setFullYear(referenceDate.getFullYear() + 1);
       }
     }
     
     return parsed;
   }
   ```

3. **Update AI prompts:**
   - If there's a system prompt for date extraction, add instruction: "If year is not specified, assume the next occurrence of that date from today."

## Implementation Notes

- The fix should handle edge cases:
  - Date is today → use today
  - Date is tomorrow → use tomorrow  
  - Date is Dec 31 and today is Dec 30 → use this year
  - Date is Jan 1 and today is Dec 31 → use next year
- Check if the date parsing happens in:
  - Email processing pipeline
  - Manual entry forms
  - Import from other sources
- Consider timezone handling — use the user's timezone if available

## Success Criteria
- [ ] Dates without years default to the next future occurrence
- [ ] "March 15" in February 2026 → March 15, 2026
- [ ] "January 10" in February 2026 → January 10, 2027
- [ ] Explicit years are preserved (e.g., "March 15, 2025" stays 2025)
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Commit Message
`fix: default date parsing to next future occurrence when year is omitted`
