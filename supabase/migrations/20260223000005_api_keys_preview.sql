-- Add key_preview column to api_keys table
-- Stores a masked preview like "ubt_k1_...a8f3" so we can display it without keeping the plaintext.
alter table public.api_keys
  add column if not exists key_preview text not null default '';
