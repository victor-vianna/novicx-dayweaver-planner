-- T1 — Bloqueio de conta. profiles.blocked_at preenchido = conta suspensa.
-- is_admin() e current_client_id() passam a exigir conta não bloqueada; como
-- toda política de RLS e de Storage e todas as RPCs dependem deles, a conta
-- perde o acesso a dados e arquivos na hora (a Edge Function admin-users, T2,
-- também bane no Auth para encerrar as sessões).
-- Ninguém altera blocked_at pelo app: profiles não tem política de UPDATE;
-- só a função privilegiada (service_role) ou SQL do responsável.

alter table public.profiles add column blocked_at timestamptz;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin' and blocked_at is null
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.clients c
    join public.profiles p on p.id = c.user_id
   where c.user_id = auth.uid()
     and c.archived_at is null
     and p.blocked_at is null
   limit 1;
$$;
