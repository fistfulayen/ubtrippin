-- PRD 024: Feedback images + storage policies

alter table public.feedback
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-images',
  'feedback-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users can upload images into their own folder: {auth.uid()}/...
drop policy if exists "feedback_images_insert_own" on storage.objects;
create policy "feedback_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'feedback-images'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Users can update/delete only images in their own folder
drop policy if exists "feedback_images_update_own" on storage.objects;
create policy "feedback_images_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'feedback-images'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'feedback-images'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "feedback_images_delete_own" on storage.objects;
create policy "feedback_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'feedback-images'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );
