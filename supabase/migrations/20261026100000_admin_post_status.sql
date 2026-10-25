-- T6 — Status da publicação só por operação autorizada no banco.
-- · posts.published_by_user: quem marcou como publicado (perfil).
-- · admin_set_post_status: status, published_at = now(), responsável e formato
--   (derivado da quantidade de artes) numa transação. Liberar exige arte.
-- · set_post_published passa a gravar o responsável.
-- · Escrita direta de status/campos de publicação deixa de existir (privilégio
--   por coluna); título, legenda, data, horário e formato seguem diretos.
-- · Exclusão de publicação: só rascunho.

alter table public.posts
  add column published_by_user uuid references public.profiles (id) on delete set null;
alter table public.posts
  add constraint posts_published_by_user_only_published
  check (status = 'published' or published_by_user is null);

revoke update on table public.posts from anon, authenticated;
grant update (title, caption, scheduled_date, scheduled_time, format)
  on table public.posts to authenticated;

drop policy posts_admin_delete on public.posts;
create policy posts_admin_delete_draft on public.posts
  for delete to authenticated
  using ((select public.is_admin()) and status = 'draft');

-- Mesma assinatura e regras; só acrescenta o responsável.
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

create function public.admin_set_post_status(p_post_id uuid, p_status public.post_status)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts;
  v_media int;
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode alterar o status' using errcode = '42501';
  end if;
  if p_status is null then
    raise exception 'Status obrigatório' using errcode = '22023';
  end if;

  select * into v_post from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;

  select count(*) into v_media from public.post_media where post_id = p_post_id;
  if p_status <> 'draft' and v_media = 0 then
    raise exception 'Envie ao menos uma arte antes de liberar para a cliente.' using errcode = 'P0001';
  end if;

  update public.posts
     set status = p_status,
         format = case when v_media > 1 then 'carousel' else 'single' end::public.post_format,
         -- Já publicada continua com o registro original; senão, agora e por quem.
         published_at = case when p_status <> 'published' then null
                             when v_post.status = 'published' then v_post.published_at
                             else now() end,
         published_by = case when p_status <> 'published' then null
                             when v_post.status = 'published' then v_post.published_by
                             else 'admin' end::public.publisher,
         published_by_user = case when p_status <> 'published' then null
                                  when v_post.status = 'published' then v_post.published_by_user
                                  else auth.uid() end
   where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;

revoke all on function public.admin_set_post_status(uuid, public.post_status) from anon, public;
grant execute on function public.admin_set_post_status(uuid, public.post_status) to authenticated;
