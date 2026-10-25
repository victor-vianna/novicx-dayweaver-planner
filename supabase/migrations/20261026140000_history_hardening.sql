-- Revisão pré-produção (R2 interna) — endurece T6/T7. Sem alteração de dados.
-- 1. Pacote não pode ser excluído: a cascata apagaria publicações já liberadas
--    e o histórico delas, contornando "excluir só rascunho".
-- 2. post_events.actor_id deixa de ser FK: excluir um perfil faria um UPDATE
--    (set null) que o append-only recusa. O id fica como registro histórico.
--    A exclusão em cascata também passa a valer quando a cliente deixa de existir.
-- 3. set_post_published(true) em post já publicado não reescreve o registro.
-- 4. Arte não muda de post por UPDATE direto (só caminho, largura e altura);
--    posição muda só pela RPC reorder_post_media.

drop policy client_packages_admin_delete on public.client_packages;
revoke delete on table public.client_packages from anon, authenticated;

alter table public.post_events drop constraint post_events_actor_id_fkey;

create or replace function public.post_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and (not exists (select 1 from public.posts where id = old.post_id)
          or not exists (select 1 from public.clients where id = old.client_id)) then
    return old;  -- cascata da exclusão de um rascunho (ou da cliente, só pelo dono)
  end if;
  raise exception 'O histórico não pode ser alterado' using errcode = '42501';
end;
$$;

create or replace function public.set_post_published(p_post_id uuid, p_published boolean)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts;
  v_admin boolean := public.is_admin();
  v_client uuid := public.current_client_id();
begin
  select * into v_post from public.posts where id = p_post_id for update;

  -- Para a cliente, rascunho é inexistente (não revela que existe).
  if not found or (not v_admin and (v_client is null or v_post.client_id <> v_client
                                    or v_post.status = 'draft')) then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;
  if v_post.status = 'draft' then
    raise exception 'Esta publicação ainda não está disponível' using errcode = 'P0001';
  end if;

  -- Já publicada: mantém o registro original (data e responsável).
  if p_published and v_post.status = 'published' then
    return v_post;
  end if;

  if p_published then
    update public.posts
       set status = 'published',
           published_at = now(),
           published_by = case when v_admin then 'admin' else 'client' end::public.publisher,
           published_by_user = auth.uid()
     where id = p_post_id
    returning * into v_post;
  else
    update public.posts
       set status = 'ready', published_at = null, published_by = null, published_by_user = null
     where id = p_post_id
    returning * into v_post;
  end if;

  return v_post;
end;
$$;

revoke update on table public.post_media from anon, authenticated;
grant update (storage_path, width, height) on table public.post_media to authenticated;
