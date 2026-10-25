-- T1 — conta bloqueada perde leitura em todas as tabelas, no Storage e nas
-- RPCs na hora; outra cliente e o admin ativo não são afetados; a própria
-- conta não consegue se desbloquear; desbloquear devolve o acesso.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Fixtures (como postgres) -------------------------------------------------
insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'B', 'Cliente B', 'b@teste.dev');
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000002', 'adm2@teste.dev', now());
update public.profiles set role = 'admin'
 where id in ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002');

insert into public.plans (id, name, posts_per_period, period_days)
values ('eeeeeeee-0000-4000-8000-000000000001', 'P', 2, 30);
insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'P', 2, '2026-10-01', '2026-10-30'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'bbbbbbbb-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'P', 2, '2026-10-01', '2026-10-30');
insert into public.posts (id, client_id, client_package_id, title, scheduled_date, scheduled_time, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'A pronto', '2026-10-05', '10:00', 'ready'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'B pronto', '2026-10-05', '10:00', 'ready');
insert into public.post_media (post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/1.jpg', 0, 1, 1),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'clients/bbbbbbbb-0000-4000-8000-00000000000c/posts/bbbbbbbb-0000-4000-8000-0000000000f1/1.jpg', 0, 1, 1);
insert into storage.objects (bucket_id, name) values
  ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/1.jpg'),
  ('post-media', 'clients/bbbbbbbb-0000-4000-8000-00000000000c/posts/bbbbbbbb-0000-4000-8000-0000000000f1/1.jpg');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

select has_column('public', 'profiles', 'blocked_at', 'profiles.blocked_at existe');
select col_is_null('public', 'profiles', 'blocked_at', 'blocked_at é opcional (ativa = nulo)');

-- A ativa: linha de base -----------------------------------------------------
reset role;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select is((select count(*)::int from public.posts), 1, 'A ativa lê o próprio post');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media'), 1, 'A ativa lê a própria arte');

-- Bloqueia A e o admin 2 (como postgres = função privilegiada) --------------
reset role;
update public.profiles set blocked_at = now()
 where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002');

-- A bloqueada ------------------------------------------------------------------
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select is(public.current_client_id(), null, 'A bloqueada: current_client_id() nulo');
select is_empty($$select 1 from public.clients$$, 'A bloqueada não lê o próprio cadastro');
select is_empty($$select 1 from public.client_packages$$, 'A bloqueada não lê pacotes');
select is_empty($$select 1 from public.posts$$, 'A bloqueada não lê posts');
select is_empty($$select 1 from public.post_media$$, 'A bloqueada não lê mídias');
select is_empty($$select 1 from storage.objects where bucket_id = 'post-media'$$, 'A bloqueada não lê arquivos');
select throws_ok($$select public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)$$,
  'P0002', null, 'A bloqueada não marca publicação');
select isnt((select blocked_at from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), null,
  'A bloqueada ainda lê o próprio perfil (para mostrar "acesso suspenso")');
-- tentativa de autodesbloqueio: sem política de UPDATE, afeta 0 linhas
update public.profiles set blocked_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000001';
reset role;
select isnt((select blocked_at from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), null,
  'A bloqueada não consegue se desbloquear');

-- B ativa: não afetada -----------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-4000-8000-000000000001');
select is((select count(*)::int from public.posts), 1, 'B ativa continua lendo o próprio post');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media'), 1, 'B ativa continua lendo a própria arte');
select is_empty($$select 1 from public.posts where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$,
  'B não lê posts de A');

-- Admin ativo: não afetado e vê o bloqueio ---------------------------------
reset role;
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select ok(public.is_admin(), 'admin ativo continua admin');
select is((select count(*)::int from public.posts), 2, 'admin ativo lê todos os posts');
select is((select count(*)::int from public.profiles where blocked_at is not null), 2, 'admin ativo vê quem está bloqueado');

-- Admin bloqueado: perde tudo ----------------------------------------------
reset role;
select pg_temp.login('dddddddd-0000-4000-8000-000000000002');
select ok(not public.is_admin(), 'admin bloqueado: is_admin() falso');
select is_empty($$select 1 from public.posts$$, 'admin bloqueado não lê posts');
select is_empty($$select 1 from public.plans$$, 'admin bloqueado não lê planos');
select is_empty($$select 1 from storage.objects where bucket_id = 'post-media'$$, 'admin bloqueado não lê arquivos');
select throws_ok($$insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time)
    values ('bbbbbbbb-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'X', '2026-10-06', '10:00')$$,
  '42501', null, 'admin bloqueado não cria post');
select throws_ok($$select public.assign_plan('bbbbbbbb-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', '2026-11-02', '[]', gen_random_uuid())$$,
  '42501', null, 'admin bloqueado não contrata plano');
select throws_ok($$insert into storage.objects (bucket_id, name)
    values ('post-media', 'clients/bbbbbbbb-0000-4000-8000-00000000000c/posts/bbbbbbbb-0000-4000-8000-0000000000f1/2.jpg')$$,
  '42501', null, 'admin bloqueado não envia arquivo');
select is((select count(*)::int from public.profiles), 1, 'admin bloqueado lê só o próprio perfil');

-- anon ---------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select 1 from public.profiles$$, '42501', null, 'anon não lê perfis');
reset role;

-- Desbloqueio devolve o acesso ---------------------------------------------
update public.profiles set blocked_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select is((select count(*)::int from public.posts), 1, 'A desbloqueada volta a ler o próprio post');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media'), 1, 'A desbloqueada volta a ler a arte');
reset role;

select * from finish();
rollback;
