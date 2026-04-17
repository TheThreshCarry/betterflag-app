-- Public buckets for dashboard profile avatars and organization logos (Supabase Storage).
-- Writes go through Next.js API routes using the service role; reads use public URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'org-logos',
    'org-logos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do nothing;
