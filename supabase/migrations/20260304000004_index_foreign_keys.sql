-- PRD-033 P3A: Add missing indexes for foreign keys.

CREATE INDEX IF NOT EXISTS idx_trip_items_source_email ON public.trip_items(source_email_id);
CREATE INDEX IF NOT EXISTS idx_trip_pdfs_trip ON public.trip_pdfs(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_pdfs_user ON public.trip_pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_trip ON public.notifications(trip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback ON public.feedback_comments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_user ON public.feedback_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_families_created_by ON public.families(created_by);
CREATE INDEX IF NOT EXISTS idx_family_members_invited_by ON public.family_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_trip_collaborators_invited_by ON public.trip_collaborators(invited_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_examples_source_email ON public.extraction_examples(source_email_id);
CREATE INDEX IF NOT EXISTS idx_extraction_examples_user ON public.extraction_examples(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_entries_recommended_by ON public.guide_entries(recommended_by_user_id);
CREATE INDEX IF NOT EXISTS idx_imports_user ON public.imports(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_status_refresh_logs_item ON public.trip_item_status_refresh_logs(item_id);
