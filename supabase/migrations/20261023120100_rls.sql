-- C2 — RLS e isolamento entre clientes.
-- Regras: admin tudo · cliente lê só o próprio cadastro, pacotes, posts
-- não-rascunho e mídia desses posts · cliente nunca lê planos, notas internas,
-- rascunhos ou dados de outra cliente · anon nada.
-- Cliente não tem escrita direta: muda publicação só pela RPC set_post_published.

-- Helpers ------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.clients
   where user_id = auth.uid() and archived_at is null
   limit 1;
$$;

-- Grants -------------------------------------------------------------------
-- anon não acessa nada; authenticated passa pelas políticas abaixo.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;
-- TRUNCATE ignora RLS: ninguém do app precisa dele.
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_client_id() to authenticated;

-- RLS ----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.plans enable row level security;
alter table public.client_packages enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.internal_notes enable row level security;

-- profiles: cada um lê o próprio; admin lê todos. Ninguém altera pelo app
-- (role só muda por SQL).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- clients
create policy clients_select on public.clients
  for select to authenticated
  using ((select public.is_admin()) or id = (select public.current_client_id()));
create policy clients_admin_insert on public.clients
  for insert to authenticated with check ((select public.is_admin()));
create policy clients_admin_update on public.clients
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy clients_admin_delete on public.clients
  for delete to authenticated using ((select public.is_admin()));

-- plans: só admin
create policy plans_admin_all on public.plans
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- client_packages
create policy client_packages_select on public.client_packages
  for select to authenticated
  using ((select public.is_admin()) or client_id = (select public.current_client_id()));
create policy client_packages_admin_insert on public.client_packages
  for insert to authenticated with check ((select public.is_admin()));
create policy client_packages_admin_update on public.client_packages
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy client_packages_admin_delete on public.client_packages
  for delete to authenticated using ((select public.is_admin()));

-- posts: cliente nunca vê rascunho
create policy posts_select on public.posts
  for select to authenticated
  using (
    (select public.is_admin())
    or (client_id = (select public.current_client_id()) and status <> 'draft')
  );
create policy posts_admin_insert on public.posts
  for insert to authenticated with check ((select public.is_admin()));
create policy posts_admin_update on public.posts
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy posts_admin_delete on public.posts
  for delete to authenticated using ((select public.is_admin()));

-- post_media: segue a visibilidade do post
create policy post_media_select on public.post_media
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.posts p
       where p.id = post_media.post_id
         and p.client_id = (select public.current_client_id())
         and p.status <> 'draft'
    )
  );
create policy post_media_admin_insert on public.post_media
  for insert to authenticated with check ((select public.is_admin()));
create policy post_media_admin_update on public.post_media
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy post_media_admin_delete on public.post_media
  for delete to authenticated using ((select public.is_admin()));

-- internal_notes: só admin
create policy internal_notes_admin_all on public.internal_notes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- RPC: marcar/desmarcar como publicado (cliente dona ou admin) -------------
create function public.set_post_published(p_post_id uuid, p_published boolean)
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
           published_by = case when v_admin then 'admin' else 'client' end::public.publisher
     where id = p_post_id
    returning * into v_post;
  else
    update public.posts
       set status = 'ready', published_at = null, published_by = null
     where id = p_post_id
    returning * into v_post;
  end if;

  return v_post;
end;
$$;

-- RPC: contratar plano (admin). Cria o pacote e os slots-rascunho numa
-- transação. Os slots vêm do app (distributeSlots, algoritmo único) e são
-- validados aqui: quantidade = posts_per_period e datas dentro do pacote.
create function public.assign_plan(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_slots jsonb
)
returns public.client_packages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_pkg public.client_packages;
  v_end date;
  v_slot jsonb;
  v_i integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode contratar planos' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Plano não encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Cliente não encontrada' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) <> v_plan.posts_per_period then
    raise exception 'Quantidade de horários diferente do plano' using errcode = '22023';
  end if;

  v_end := p_start_date + (greatest(1, v_plan.period_days) - 1);

  update public.client_packages
     set status = 'ended'
   where client_id = p_client_id and status = 'active';

  insert into public.client_packages
    (client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date, status)
  values
    (p_client_id, v_plan.id, v_plan.name, v_plan.posts_per_period, p_start_date, v_end, 'active')
  returning * into v_pkg;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_i := v_i + 1;
    if (v_slot ->> 'date')::date not between p_start_date and v_end then
      raise exception 'Horário fora do período do pacote' using errcode = '22023';
    end if;
    insert into public.posts
      (client_id, client_package_id, format, title, scheduled_date, scheduled_time, status)
    values
      (p_client_id, v_pkg.id, 'single', 'Publicação ' || v_i,
       (v_slot ->> 'date')::date, (v_slot ->> 'time')::time, 'draft');
  end loop;

  return v_pkg;
end;
$$;

-- RPC: reordenar carrossel (admin). p_media_ids na nova ordem.
create function public.reorder_post_media(p_post_id uuid, p_media_ids uuid[])
returns setof public.post_media
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode reordenar mídias' using errcode = '42501';
  end if;
  if (select count(*) from public.post_media where post_id = p_post_id)
     <> coalesce(array_length(p_media_ids, 1), 0)
     or exists (
       select 1 from unnest(p_media_ids) as m(id)
        where not exists (
          select 1 from public.post_media pm where pm.id = m.id and pm.post_id = p_post_id
        )
     ) then
    raise exception 'Lista de mídias não confere com a publicação' using errcode = '22023';
  end if;

  update public.post_media pm
     set position = o.ord - 1
    from unnest(p_media_ids) with ordinality as o(id, ord)
   where pm.id = o.id;

  return query
    select * from public.post_media where post_id = p_post_id order by position;
end;
$$;

revoke all on function public.set_post_published(uuid, boolean) from anon, public;
revoke all on function public.assign_plan(uuid, uuid, date, jsonb) from anon, public;
revoke all on function public.reorder_post_media(uuid, uuid[]) from anon, public;
grant execute on function public.set_post_published(uuid, boolean) to authenticated;
grant execute on function public.assign_plan(uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.reorder_post_media(uuid, uuid[]) to authenticated;
