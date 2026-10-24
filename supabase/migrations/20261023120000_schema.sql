-- C1 — Schema do NOVICX Planner.
-- Tabelas espelham src/types/domain.ts. Datas/horários são locais de
-- America/Sao_Paulo (date/time sem fuso), como no app.

create type public.app_role as enum ('admin', 'client');
create type public.package_status as enum ('active', 'ended', 'cancelled');
create type public.post_format as enum ('single', 'carousel');
create type public.post_status as enum ('draft', 'ready', 'published');
create type public.publisher as enum ('client', 'admin');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clients -------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  display_name text not null check (length(trim(display_name)) > 0),
  business_name text not null check (length(trim(business_name)) > 0),
  profession text not null default '',
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  phone text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_email_key on public.clients (email);

-- plans (catálogo, só admin) -----------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  posts_per_period integer not null check (posts_per_period > 0),
  period_days integer not null check (period_days > 0),
  default_weekdays smallint[] not null default '{}'
    check (default_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  default_times time[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- client_packages -----------------------------------------------------------
create table public.client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  plan_name_snapshot text not null,
  posts_total integer not null check (posts_total > 0),
  start_date date not null,
  end_date date not null,
  status public.package_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- alvo da FK composta de posts (garante post.client_id = pacote.client_id)
  unique (id, client_id)
);
create index client_packages_client_idx on public.client_packages (client_id);
create unique index client_packages_one_active
  on public.client_packages (client_id) where status = 'active';

-- posts ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  client_package_id uuid not null,
  format public.post_format not null default 'single',
  title text not null,
  caption text,
  scheduled_date date not null,
  scheduled_time time not null,
  status public.post_status not null default 'draft',
  published_at timestamptz,
  published_by public.publisher,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_package_id, client_id)
    references public.client_packages (id, client_id) on delete cascade,
  check (extract(second from scheduled_time) = 0),
  check (
    (status = 'published' and published_at is not null and published_by is not null)
    or (status <> 'published' and published_at is null and published_by is null)
  )
);
create index posts_client_date_idx on public.posts (client_id, scheduled_date);
create index posts_package_idx on public.posts (client_package_id);
create index posts_date_idx on public.posts (scheduled_date);

-- post_media ----------------------------------------------------------------
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null unique,
  position integer not null check (position >= 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  -- adiada para permitir reordenar numa única transação
  constraint post_media_post_position_key unique (post_id, position)
    deferrable initially deferred
);

-- internal_notes (só admin) -------------------------------------------------
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index internal_notes_client_idx on public.internal_notes (client_id);

-- updated_at ----------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger client_packages_updated_at before update on public.client_packages
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- Novo usuário (criado no painel) → profile 'client' + vínculo pelo e-mail.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  update public.clients
     set user_id = new.id
   where email = lower(trim(new.email))
     and user_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
