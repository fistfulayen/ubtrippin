-- PRD 015 Phase 2 — Guide attribution fields on guide entries

ALTER TABLE public.guide_entries
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_name text;

CREATE INDEX IF NOT EXISTS idx_guide_entries_author_id ON public.guide_entries(author_id);

UPDATE public.guide_entries
SET author_id = user_id
WHERE author_id IS NULL;

UPDATE public.guide_entries ge
SET author_name = COALESCE(p.full_name, p.email)
FROM public.profiles p
WHERE ge.author_name IS NULL
  AND ge.author_id = p.id;
