-- C3 — Storage privado das artes.
-- Caminho: clients/{client_id}/posts/{post_id}/{uuid}.{ext}
-- Cliente só lê objetos registrados em post_media de post próprio e não-rascunho
-- (arquivo órfão ou de rascunho fica invisível). Só admin grava e apaga.
-- Acesso pelo app sempre via URL assinada (bucket não é público).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy post_media_objects_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'post-media' and (select public.is_admin()));

create policy post_media_objects_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (select public.is_admin())
    and name like 'clients/%/posts/%/%'
  );

create policy post_media_objects_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'post-media' and (select public.is_admin()))
  with check (bucket_id = 'post-media' and (select public.is_admin()));

create policy post_media_objects_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-media' and (select public.is_admin()));

create policy post_media_objects_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1
        from public.post_media m
        join public.posts p on p.id = m.post_id
       where m.storage_path = storage.objects.name
         and p.client_id = (select public.current_client_id())
         and p.status <> 'draft'
    )
  );
