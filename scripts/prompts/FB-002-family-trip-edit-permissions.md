# Bug Fix: Cannot Edit Trip Title Owned by Family Member

## Problem
When visiting a trip page owned by another family member (not the current user), editing the title does not update/save.

## Root Cause Analysis
This is likely an RLS (Row Level Security) policy issue or a permission check in the API route. The user should be able to edit trips that:
1. They own (user_id = auth.uid())
2. They have edit permissions on as a collaborator
3. They have edit permissions on through family sharing

## Files to Investigate
- `src/app/api/v1/trips/[id]/route.ts` — Trip update API
- `supabase/migrations/*` — RLS policies on trips table
- `src/lib/trips.ts` — Trip data layer
- `src/components/trips/trip-detail.tsx` or title edit component

## Required Fix

1. **Check the API route permission logic:**
   - The PUT/PATCH handler for `/api/v1/trips/[id]` likely only checks `trip.user_id = auth.uid()`
   - It should ALSO check if the user is a collaborator with `can_edit = true`
   - It should ALSO check if the user is a family member with edit permissions

2. **Check RLS policies:**
   ```sql
   -- Current policy probably only allows owner updates
   CREATE POLICY "trips_update_owner" ON trips FOR UPDATE USING (user_id = auth.uid());
   
   -- Should also allow collaborators with edit permission
   CREATE POLICY "trips_update_collaborator" ON trips FOR UPDATE USING (
     EXISTS (
       SELECT 1 FROM trip_collaborators 
       WHERE trip_id = trips.id 
       AND user_id = auth.uid() 
       AND can_edit = true
     )
   );
   ```

3. **Check family sharing logic:**
   - Family members may have a separate permission path
   - Check `family_members` or similar table
   - See `docs/FAMILY.md` for family sharing rules

## Implementation Notes

- Check existing collaboration patterns in `COLLABORATION.md`
- The fix should be in both the API layer (for validation) AND RLS (for security)
- Ensure the title edit UI properly shows errors if permission is denied
- The `family_trip_access` table may be relevant here

## Success Criteria
- [ ] User can edit trip title when they are a collaborator with edit permission
- [ ] User can edit trip title when they are a family member with appropriate permissions
- [ ] Owner can still edit their own trips
- [ ] Users without permission get a clear error message (not silent failure)
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Commit Message
`fix: allow collaborators and family members to edit trip titles`
