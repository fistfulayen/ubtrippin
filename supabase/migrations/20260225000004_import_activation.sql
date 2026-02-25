-- PRD 007-p1: Activation tracking columns and imports table

-- Add activation tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_forward_at timestamptz,
  ADD COLUMN IF NOT EXISTS second_trip_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_3_sent_at timestamptz;

-- Create imports table for tracking file/bulk import jobs
CREATE TABLE IF NOT EXISTS imports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source        text,
  status        text,
  file_url      text,
  trips_created int         NOT NULL DEFAULT 0,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- Enable RLS on imports
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own imports
CREATE POLICY "users can select own imports"
  ON imports
  FOR SELECT
  USING (user_id = auth.uid());
