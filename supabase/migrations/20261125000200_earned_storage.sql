-- Earned: private evidence storage.
--
-- Photos live in a private bucket under <owner uuid>/<attempt uuid>.jpg. The server uploads and
-- deletes with the service role after re-encoding (metadata stripped). Signed-in owners may read only
-- their own folder; there is no client insert, update, or delete policy, and nothing is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('earned-evidence', 'earned-evidence', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "earned evidence: owner reads own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'earned-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select earned.is_allowed_owner())
  );
