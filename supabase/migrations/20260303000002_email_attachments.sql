-- Create private bucket for all email attachments (PDFs, ICS, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,
  10485760, -- 10MB limit per file
  ARRAY['application/pdf', 'text/calendar', 'application/ics']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can read their own email attachments
CREATE POLICY "Owner can read email attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: service role uploads (webhook processing)
CREATE POLICY "Service can upload email attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

-- RLS: owner can delete their own attachments
CREATE POLICY "Owner can delete email attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
