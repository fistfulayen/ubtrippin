# PRD: Inline Trip Details Editing from Trip Page

## Overview
Currently, there's no way to edit a piece of an itinerary directly on the trip page. Users must navigate back to the Inbox to find the original email to re-parse or edit. This PRD enables inline editing of trip items from the trip detail page.

## User Story
As a user viewing a trip, I want to edit individual itinerary items (flights, hotels, activities) directly on the trip page, so I can fix errors or update details without leaving the context of my trip.

## Design Approach

### Option A: "Edit" Button → Inbox (MVP)
Each trip item card gets an "Edit" button that:
1. Navigates to the Inbox with the source email selected
2. Shows the email with "Re-parse" or "Edit" options
3. After editing/re-parsing, redirects back to the trip page

### Option B: Inline Edit Modal (Future)
Clicking "Edit" opens a modal on the trip page with fields for that item type (flight number, dates, times, etc.).

**This PRD implements Option A as the MVP.**

## Changes Required

### 1. Trip Item Cards — Add Edit Action

File: `src/components/trips/trip-item-card.tsx` (or existing trip item component)

Add an "Edit" button/dropdown item to each trip item card:
- Position: Top-right corner, next to delete button
- Icon: Pencil/edit icon
- Behavior: Navigate to `/inbox?emailId={sourceEmailId}&returnTo=/trips/{tripId}`

The button only appears if:
- User has edit permission on the trip (owner, collaborator with edit, family with edit)
- The item has a `source_email_id` (was created from an email)

### 2. Inbox Page — Handle Edit Mode

File: `src/app/(dashboard)/inbox/page.tsx`

When `emailId` query param is present:
- Auto-select that email in the inbox list
- Show the email detail view
- Add "Re-parse" and "Manual Edit" actions

Add `returnTo` query param handling:
- After re-parse or manual edit completion, redirect to the `returnTo` URL
- If `returnTo` is not provided, default to current behavior (stay in inbox)

### 3. Email Detail — Edit Actions

File: `src/components/inbox/email-detail.tsx`

Add two new actions:
1. **Re-parse**: Re-run the AI parser on this email, show diff of changes, allow user to confirm
2. **Manual Edit**: Open a form to manually edit the extracted trip data

For Re-parse:
- Call existing parsing logic
- Show before/after comparison
- "Apply Changes" updates the trip items
- Redirect to `returnTo` URL

For Manual Edit:
- Show form with all extracted fields
- User can modify any field
- "Save Changes" updates the trip items
- Redirect to `returnTo` URL

### 4. Trip Items — Track Source

Ensure `trip_items` table has `source_email_id` column (should already exist from email parsing):
- This links each item back to its originating email
- Used to find the email when user clicks "Edit"

## API Changes

### GET /api/v1/trips/:id/items
Include `source_email_id` in response for each item (if applicable).

### POST /api/v1/emails/:id/reparse
Re-parse a single email and return the new extracted data without saving.
Body: `{ "tripId": "uuid" }`
Response: `{ "items": [...], "diff": { "added": [...], "removed": [...], "modified": [...] } }`

### POST /api/v1/emails/:id/apply
Apply re-parsed data to the trip.
Body: `{ "tripId": "uuid", "items": [...] }`

### PUT /api/v1/items/:id
Update a single trip item manually.
Body: `{ "startDate", "endDate", "detailsJson", ... }`

## Edge Cases

- Item created manually (no source email): Hide edit button or show "Manual items cannot be edited" tooltip
- Source email deleted: Show "Original email not available" message
- User doesn't have edit permission: Hide edit button
- Re-parse produces no changes: Show "No changes detected" and skip confirmation

## UI/UX Details

- Edit button: Small pencil icon, appears on hover (desktop) or always visible (mobile)
- Confirmation dialogs for destructive changes (re-parse replaces data)
- Toast notifications: "Trip updated successfully" / "No changes found"
- Loading states during re-parse

## Security & Permissions

- Respect existing trip edit permissions
- Only allow re-parsing emails belonging to the user
- RLS policies on `trip_items` and `emails` tables

## Success Criteria

- [ ] Each trip item card has an "Edit" button (when applicable)
- [ ] Clicking Edit navigates to Inbox with source email selected
- [ ] User can choose "Re-parse" or "Manual Edit"
- [ ] After editing, user is redirected back to the trip page
- [ ] Changes are reflected immediately on the trip page
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Future Enhancements (Out of Scope)

- True inline editing with modal (no navigation)
- Drag-and-drop to reorder items
- Batch edit multiple items
- Edit history/audit log

## Commit Message
`feat: inline trip editing via inbox navigation`
