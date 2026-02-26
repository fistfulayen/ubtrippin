-- PRD 017: User feedback board

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('bug', 'feature', 'general')),
  title text NOT NULL,
  body text NOT NULL,
  page_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'planned', 'in_progress', 'shipped', 'declined')),
  votes integer NOT NULL DEFAULT 0,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_read" ON feedback FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_read" ON feedback_votes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "votes_insert" ON feedback_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete" ON feedback_votes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_team boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read" ON feedback_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comments_insert" ON feedback_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_feedback_votes_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback SET votes = votes + 1, updated_at = now() WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback SET votes = votes - 1, updated_at = now() WHERE id = OLD.feedback_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_feedback_votes
  AFTER INSERT OR DELETE ON feedback_votes
  FOR EACH ROW EXECUTE FUNCTION update_feedback_votes_count();

CREATE INDEX idx_feedback_votes ON feedback (votes DESC);
CREATE INDEX idx_feedback_status ON feedback (status);
CREATE INDEX idx_feedback_user ON feedback (user_id);
