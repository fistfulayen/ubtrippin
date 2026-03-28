-- PRD-043: Velvet Rope — invite-only sign-up system
--
-- Configurable values (change here + in src/lib/invites/constants.ts):
--   INVITE_EXPIRY_DAYS     = 7   (expires_at default)
--   INVITE_WEEKLY_LIMIT    = 3   (weekly_invites_remaining function)
--   REFERRAL_TREE_DEPTH    = 3   (get_referral_tree function)

-- Add is_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Invites table
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  email_used  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  -- INVITE_EXPIRY_DAYS = 7 — also defined in src/lib/invites/constants.ts
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  used_at     TIMESTAMPTZ,
  invitee_id  UUID REFERENCES profiles(id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS invites_code_idx       ON invites(code);
CREATE INDEX IF NOT EXISTS invites_inviter_id_idx ON invites(inviter_id);

-- RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Users can see their own sent invites
CREATE POLICY "invites_select" ON invites
  FOR SELECT USING (inviter_id = auth.uid());

-- Users can create invites (rate limit enforced in app layer)
CREATE POLICY "invites_insert" ON invites
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- Updates are done via service role only (registration endpoint marks invite used)

-- ─── weekly_invites_remaining ───────────────────────────────────────────────
-- Returns how many more invites this user may create this week.
-- Admins get 999 (effectively unlimited).
-- Counts only USED invites in the current ISO week (resets Monday UTC).
-- Expired-but-unused invites do NOT count against the limit.
CREATE OR REPLACE FUNCTION weekly_invites_remaining(user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT is_admin FROM profiles WHERE id = user_id) = true THEN 999
    -- INVITE_WEEKLY_LIMIT = 3 — also defined in src/lib/invites/constants.ts
    ELSE GREATEST(0, 3 - (
      SELECT COUNT(*)::int FROM invites
      WHERE inviter_id = user_id
        AND used_at IS NOT NULL
        AND used_at > date_trunc('week', now())
    ))
  END;
$$;

-- ─── get_referral_tree ──────────────────────────────────────────────────────
-- Returns the invitee tree rooted at user_id, up to 3 levels deep.
CREATE OR REPLACE FUNCTION get_referral_tree(user_id UUID)
RETURNS TABLE(invitee_id UUID, invitee_name TEXT, joined_at TIMESTAMPTZ, depth INT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT i.invitee_id, p.full_name AS invitee_name, i.used_at AS joined_at, 1 AS depth
    FROM invites i
    JOIN profiles p ON p.id = i.invitee_id
    WHERE i.inviter_id = user_id AND i.invitee_id IS NOT NULL
    UNION ALL
    SELECT i.invitee_id, p.full_name, i.used_at, t.depth + 1
    FROM invites i
    JOIN profiles p ON p.id = i.invitee_id
    JOIN tree t ON t.invitee_id = i.inviter_id
    -- REFERRAL_TREE_DEPTH = 3 — also defined in src/lib/invites/constants.ts
    WHERE t.depth < 3
  )
  SELECT * FROM tree;
$$;
