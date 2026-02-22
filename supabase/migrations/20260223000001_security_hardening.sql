-- Security Hardening Migration
-- Fixes RLS policy gaps found during pre-pentest audit

-- ── extraction_examples: tighten update policy ────────────────────────────────
-- Previous policy allowed users to update their own rows but had no WITH CHECK
-- clause, meaning a user could escalate an example to is_global = true and make
-- it visible to every other user in the system.
--
-- Fix: drop the permissive update policy and replace with one that explicitly
-- prevents users from modifying the is_global flag.

drop policy if exists "Users update own examples" on extraction_examples;

-- SECURITY: Updated policy prevents users from setting is_global = true.
-- Only the service role (or a Supabase admin) can promote examples to global.
create policy "Users update own examples" on extraction_examples
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and is_global = false);

-- ── calendar_token: add explicit RLS policy ───────────────────────────────────
-- The calendar_token column was added to profiles but the existing profile
-- policies use blanket SELECT/UPDATE.  Ensure the token is only readable
-- by the owning user (the existing "Users can view own profile" policy covers
-- this since it filters on auth.uid() = id, which already scopes the column).
-- No change needed for calendar_token – documenting here for audit clarity.

-- ── source_emails: no authenticated-user INSERT policy ───────────────────────
-- source_emails are only ever inserted by the webhook handler via the service
-- role (bypasses RLS by design).  Authenticated users must NOT be able to
-- insert rows directly.  The existing schema has no INSERT policy for
-- authenticated users, which is correct.  Documenting here for clarity.

-- ── trip_items: foreign key gap on trip_id ────────────────────────────────────
-- trip_items.trip_id references trips(id) ON DELETE SET NULL.
-- The user_id on trip_items is enforced by RLS; the trip ownership is verified
-- in application code.  No schema change needed.

-- ── share_token: confirm no policy needed ─────────────────────────────────────
-- The share page queries trips via service role + share_token + share_enabled.
-- RLS is intentionally bypassed for the public share view.  The service role
-- is used exclusively server-side (never exposed to the browser).
