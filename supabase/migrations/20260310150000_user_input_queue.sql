-- PRD-044 Phase 2: Untrusted Input Quarantine Table
-- All user-submitted content goes here before AI processing

CREATE TABLE IF NOT EXISTS user_input_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL CHECK (input_type IN ('feedback', 'event_suggestion', 'email_forward')),
  raw_text TEXT,
  image_urls TEXT[] DEFAULT '{}',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'promoted', 'rejected', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  ai_result JSONB,
  rejection_reason TEXT,
  -- For rate limiting: hash of content to detect duplicates
  content_hash TEXT
);

-- Index for processing pipeline (find pending items)
CREATE INDEX idx_user_input_queue_status ON user_input_queue(status) WHERE status = 'pending';

-- Index for rate limiting (recent submissions by user)
CREATE INDEX idx_user_input_queue_user_recent ON user_input_queue(user_id, created_at DESC);

-- Index for duplicate detection
CREATE INDEX idx_user_input_queue_hash ON user_input_queue(content_hash) WHERE content_hash IS NOT NULL;

-- RLS: users can insert their own rows, read their own rows
ALTER TABLE user_input_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_input_queue_insert ON user_input_queue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_input_queue_select ON user_input_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only service role can UPDATE (processing pipeline)
-- No user UPDATE/DELETE policy — quarantined items are immutable from user's perspective

-- Add resolved_at to feedback for image lifecycle tracking
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Trigger: set resolved_at when feedback status changes to shipped or declined
CREATE OR REPLACE FUNCTION set_feedback_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('shipped', 'declined') AND OLD.status NOT IN ('shipped', 'declined') THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_resolved_at_trigger ON feedback;
CREATE TRIGGER feedback_resolved_at_trigger
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_feedback_resolved_at();
