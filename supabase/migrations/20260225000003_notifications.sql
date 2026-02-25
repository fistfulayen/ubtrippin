-- Notifications table for in-app + agent notification polling
-- Fires on: invite_accepted, entry_added (by collaborator), collaborator_joined

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'invite_accepted' | 'entry_added' | 'collaborator_added'
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}', -- { trip_title, actor_name, entry_summary, role, ... }
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_owner_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_owner_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Indexes
CREATE INDEX notifications_user_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX notifications_user_created ON notifications (user_id, created_at DESC);
