# Family Sharing Guide

Family Sharing in UBTRIPPIN is intentionally simple: **sharing is caring**.  
If you are in a family, shared context is all-or-nothing across accepted members.

## Overview

What is shared across family members:
- Trips
- Loyalty programs
- Traveler profiles/preferences
- City guides + guide entries

What is not shared:
- Billing and subscription data
- API keys
- Account credentials

There are no per-item privacy toggles in Family Sharing.

## Create a Family

1. Create a family (Pro required for the creator).
2. Invite members by email (Pro required for the inviter).
3. Invited member accepts the invite link.
4. Once accepted, shared context is immediately visible to all members.

Example CLI:

```bash
ubt family create "Rogers Family"
ubt family invite <family_id> mom@example.com
ubt family show <family_id>
```

## Query Shared Data

Family APIs and tools expose cross-member data in read-only, structured responses.

CLI:

```bash
ubt family list
ubt family loyalty <family_id>
ubt family loyalty lookup <family_id> united
ubt family profiles <family_id>
ubt family trips <family_id>
ubt family guides <family_id>
```

MCP tools:

```json
{ "tool": "list_families", "input": {} }
{ "tool": "get_family", "input": { "family_id": "..." } }
{ "tool": "get_family_loyalty", "input": { "family_id": "..." } }
{ "tool": "lookup_family_loyalty", "input": { "family_id": "...", "provider": "united" } }
{ "tool": "get_family_profiles", "input": { "family_id": "..." } }
{ "tool": "get_family_trips", "input": { "family_id": "...", "scope": "upcoming" } }
{ "tool": "get_family_guides", "input": { "family_id": "..." } }
```

## Email Routing Behavior

Forwarded booking emails still go to `trips@ubtrippin.xyz`.

Routing behavior:
- UBTRIPPIN first tries matching the email to one of the sender's own trips.
- If no own-trip match is found, it attempts family-trip matching using accepted family memberships.
- If a family trip match is found, items are auto-routed into that existing family member trip.
- If no match is found, a new trip is created for the sender.

This is automatic; there are no manual routing switches for family sharing.

## Leaving and Removing Members

CLI examples:

```bash
ubt family remove <family_id> <user_id>
ubt family leave <family_id>
```

`family remove` supports user ID and member ID lookup in the CLI workflow.

## FAQ

### What happens when someone leaves a family?

They immediately lose access to shared family context (trips, loyalty, profiles, guides) from that family.

### What exactly is shared?

Trips, loyalty programs, traveler profile preferences, and city guides for all accepted members.

### Do all members need Pro?

No.  
Pro is required to:
- Create a family
- Invite family members

Membership and accepting invites can be done by free users.
