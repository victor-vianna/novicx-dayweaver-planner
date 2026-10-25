-- T7 — Histórico de alterações das publicações (D7).
-- · post_events: só acrescenta. Gravado por triggers (security definer) em
--   posts e post_media: criação, status (inclui publicar/desmarcar), data ou
--   horário, arte enviada/substituída/removida. Ator = auth.uid() e o papel dele.
-- · Leitura só para admin ativo; ninguém insere, altera ou exclui pela API.
--   Alteração é recusada sempre; exclusão só acontece em cascata quando um
--   rascunho é excluído (o post deixa de existir).

create table public.post_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in
    ('created', 'status', 'schedule', 'media_added', 'media_replaced', 'media_removed')),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.app_role,
  created_at timestamptz not null default now()
);
create index post_events_post_idx on public.post_events (post_id, created_at);
create index post_events_client_idx on public.post_events (client_id);
create index post_events_actor_idx on public.post_events (actor_id);

alter table public.post_events enable row level security;
revoke all on table public.post_events from anon, authenticated, public;
grant select on table public.post_events to authenticated;
create policy post_events_admin_select on public.post_events
  for select to authenticated using ((select public.is_admin()));

-- Grava um evento com o ator da sessão (nulo em operações do sistema).
create function public.log_post_event(p_post_id uuid, p_client_id uuid, p_kind text, p_detail jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.post_events (post_id, client_id, kind, detail, actor_id, actor_role)
  select p_post_id, p_client_id, p_kind, p_detail, p.id, p.role
    from (select auth.uid() as uid) s
    left join public.profiles p on p.id = s.uid;
$$;

create function public.post_events_on_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_post_event(new.id, new.client_id, 'created',
      jsonb_build_object('status', new.status, 'date', new.scheduled_date, 'time', to_char(new.scheduled_time, 'HH24:MI')));
    return null;
  end if;
  if new.status is distinct from old.status then
    perform public.log_post_event(new.id, new.client_id, 'status',
      jsonb_build_object('from', old.status, 'to', new.status, 'published_by', new.published_by));
  end if;
  if (new.scheduled_date, new.scheduled_time) is distinct from (old.scheduled_date, old.scheduled_time) then
    perform public.log_post_event(new.id, new.client_id, 'schedule',
      jsonb_build_object('from_date', old.scheduled_date, 'from_time', to_char(old.scheduled_time, 'HH24:MI'),
                         'to_date', new.scheduled_date, 'to_time', to_char(new.scheduled_time, 'HH24:MI')));
  end if;
  return null;
end;
$$;

create trigger post_events_posts
  after insert or update of status, scheduled_date, scheduled_time on public.posts
  for each row execute function public.post_events_on_posts();

create function public.post_events_on_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  if tg_op = 'DELETE' then
    -- Em cascata (rascunho excluído) o post já não existe: nada a registrar.
    select client_id into v_client from public.posts where id = old.post_id;
    if found then
      perform public.log_post_event(old.post_id, v_client, 'media_removed',
        jsonb_build_object('position', old.position));
    end if;
    return null;
  end if;
  select client_id into v_client from public.posts where id = new.post_id;
  if tg_op = 'INSERT' then
    perform public.log_post_event(new.post_id, v_client, 'media_added',
      jsonb_build_object('position', new.position));
  elsif new.storage_path is distinct from old.storage_path then
    perform public.log_post_event(new.post_id, v_client, 'media_replaced',
      jsonb_build_object('position', new.position));
  end if;
  return null;
end;
$$;

create trigger post_events_media
  after insert or delete or update of storage_path on public.post_media
  for each row execute function public.post_events_on_media();

-- Append-only também para quem tem privilégio de tabela (service_role, dono).
create function public.post_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.posts where id = old.post_id) then
    return old;  -- cascata da exclusão de um rascunho
  end if;
  raise exception 'O histórico não pode ser alterado' using errcode = '42501';
end;
$$;

create trigger post_events_append_only
  before update or delete on public.post_events
  for each row execute function public.post_events_append_only();

create trigger post_events_no_truncate
  before truncate on public.post_events
  for each statement execute function public.post_events_append_only();

revoke all on function public.log_post_event(uuid, uuid, text, jsonb) from anon, authenticated, public;
revoke all on function public.post_events_on_posts() from anon, authenticated, public;
revoke all on function public.post_events_on_media() from anon, authenticated, public;
revoke all on function public.post_events_append_only() from anon, authenticated, public;
