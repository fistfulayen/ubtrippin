-- Create private bucket for ticket PDF attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760, -- 10MB limit per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can read their own ticket attachments
CREATE POLICY "Owner can read ticket attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: service role uploads (webhook processing)
CREATE POLICY "Service can upload ticket attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments');

-- RLS: owner can delete their own attachments
CREATE POLICY "Owner can delete ticket attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
