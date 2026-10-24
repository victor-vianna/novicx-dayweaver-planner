-- C2 — isolamento entre clientes, rascunhos, notas, planos, RPCs e anon.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Fixtures (como postgres) -------------------------------------------------
-- A = cliente com conta; B = outra cliente com conta; ADM = equipe.
insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'B', 'Cliente B', 'b@teste.dev');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b@teste.dev'),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev');
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';

insert into public.plans (id, name, posts_per_period, period_days, default_weekdays, default_times)
values ('eeeeeeee-0000-4000-8000-000000000001', 'Plano 2', 2, 30, '{1,3}', '{10:00}');

insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'Plano 2', 2, '2026-10-01', '2026-10-30'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'bbbbbbbb-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'Plano 2', 2, '2026-10-01', '2026-10-30');

insert into public.posts (id, client_id, client_package_id, title, scheduled_date, scheduled_time, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'A pronto', '2026-10-05', '10:00', 'ready'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'A rascunho', '2026-10-07', '10:00', 'draft'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'B pronto', '2026-10-05', '10:00', 'ready');

insert into public.post_media (post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/a/posts/f1/1.jpg', 0, 1024, 1280),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'clients/a/posts/f2/1.jpg', 0, 1024, 1280),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'clients/b/posts/f1/1.jpg', 0, 1024, 1280);

insert into public.internal_notes (client_id, body) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'nota sobre A');

-- Simula a sessão de um usuário (o que o PostgREST faz com o JWT).
create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Cliente A -----------------------------------------------------------------
reset role;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');

select results_eq($$select id from public.clients$$,
  $$values ('aaaaaaaa-0000-4000-8000-00000000000c'::uuid)$$, 'A lê só o próprio cadastro');
select results_eq($$select id from public.client_packages$$,
  $$values ('aaaaaaaa-0000-4000-8000-0000000000b0'::uuid)$$, 'A lê só os próprios pacotes');
select results_eq($$select id from public.posts$$,
  $$values ('aaaaaaaa-0000-4000-8000-0000000000f1'::uuid)$$, 'A lê só os próprios posts e nenhum rascunho');
select results_eq($$select storage_path from public.post_media$$,
  $$values ('clients/a/posts/f1/1.jpg')$$, 'A lê só mídia de post próprio não-rascunho');
select is_empty($$select 1 from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f2'$$, 'A não vê o próprio rascunho');
select is_empty($$select 1 from public.posts where client_id = 'bbbbbbbb-0000-4000-8000-00000000000c'$$, 'A não vê posts de B');
select is_empty($$select 1 from public.plans$$, 'A não lê planos');
select is_empty($$select 1 from public.internal_notes$$, 'A não lê notas internas');
select results_eq($$select id from public.profiles$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$, 'A lê só o próprio profile');

-- Escrita direta bloqueada
select throws_ok($$insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time)
  values ('aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'X', '2026-10-09', '10:00')$$,
  '42501', null, 'A não insere post');
select throws_ok($$insert into public.post_media (post_id, storage_path, position, width, height)
  values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'x', 1, 1, 1)$$, '42501', null, 'A não insere mídia');
select throws_ok($$insert into public.internal_notes (client_id, body) values ('aaaaaaaa-0000-4000-8000-00000000000c', 'x')$$,
  '42501', null, 'A não insere nota');
select throws_ok($$insert into public.clients (display_name, business_name, email) values ('x', 'x', 'x@x.dev')$$,
  '42501', null, 'A não insere cliente');

update public.posts set title = 'hack' where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
update public.posts set status = 'ready' where id = 'aaaaaaaa-0000-4000-8000-0000000000f2';
update public.clients set business_name = 'hack';
update public.client_packages set posts_total = 99;
update public.profiles set role = 'admin';
delete from public.posts;
delete from public.post_media;

-- RPC set_post_published
select is((select published_by::text from public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)),
  'client', 'A marca o próprio post como publicado (published_by = client)');
select is((select status::text from public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', false)),
  'ready', 'A desmarca o próprio post');
select throws_ok($$select public.set_post_published('bbbbbbbb-0000-4000-8000-0000000000f1', true)$$,
  'P0002', null, 'RPC recusa post de B');
select throws_ok($$select public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f2', true)$$,
  'P0002', null, 'RPC recusa rascunho próprio (invisível para A)');
select throws_ok($$select public.assign_plan('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', '2026-11-02', '[]')$$,
  '42501', null, 'assign_plan recusa cliente');
select throws_ok($$select public.reorder_post_media('aaaaaaaa-0000-4000-8000-0000000000f1', '{}')$$,
  '42501', null, 'reorder_post_media recusa cliente');

-- Conferência das tentativas de escrita (como postgres)
reset role;
select set_config('request.jwt.claims', '', true);
select is((select title from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'), 'A pronto', 'UPDATE direto de A não alterou o post');
select is((select status::text from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f2'), 'draft', 'A não tira o próprio post de rascunho');
select is((select count(*)::int from public.clients where business_name = 'hack'), 0, 'A não altera clientes');
select is((select count(*)::int from public.client_packages where posts_total = 99), 0, 'A não altera pacotes');
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'client', 'A não muda o próprio role');
select is((select count(*)::int from public.posts where client_id in ('aaaaaaaa-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-00000000000c')), 3, 'DELETE direto de A não apagou posts');
select is((select count(*)::int from public.post_media where storage_path like 'clients/_/%'), 3, 'DELETE direto de A não apagou mídia');

-- Cliente B não enxerga A -----------------------------------------------------
reset role;
select pg_temp.login('bbbbbbbb-0000-4000-8000-000000000001');
select is_empty($$select 1 from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$, 'B não lê cadastro de A');
select is_empty($$select 1 from public.post_media where storage_path like 'clients/a/%'$$, 'B não lê mídia de A');
select throws_ok($$select public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)$$,
  'P0002', null, 'B não publica post de A');

-- Usuário sem cliente vinculada ---------------------------------------------
reset role;
insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000001', 'solto@teste.dev');
reset role;
select pg_temp.login('cccccccc-0000-4000-8000-000000000001');
select is_empty($$select 1 from public.posts$$, 'usuário sem vínculo não lê posts');

-- Admin ----------------------------------------------------------------------
reset role;
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((select count(*)::int from public.posts where client_id in ('aaaaaaaa-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-00000000000c')), 3, 'admin lê todos os posts, inclusive rascunhos');
select is((select count(*)::int from public.internal_notes where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c'), 1, 'admin lê notas');
select is((select published_by::text from public.set_post_published('bbbbbbbb-0000-4000-8000-0000000000f1', true)),
  'admin', 'admin publica (published_by = admin)');
select throws_ok($$select public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f2', true)$$,
  'P0001', null, 'nem admin publica rascunho');

update public.client_packages set status = 'ended' where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c';
select is((select posts_total from public.assign_plan('aaaaaaaa-0000-4000-8000-00000000000c',
  'eeeeeeee-0000-4000-8000-000000000001', '2026-11-02',
  '[{"date":"2026-11-02","time":"10:00"},{"date":"2026-11-04","time":"10:00"}]')), 2, 'admin contrata plano');
select is((select count(*)::int from public.posts p join public.client_packages k on k.id = p.client_package_id
  where k.status = 'active' and k.client_id = 'aaaaaaaa-0000-4000-8000-00000000000c' and p.status = 'draft'), 2,
  'assign_plan cria os slots como rascunho');
select throws_ok($$select public.assign_plan('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', '2026-11-02',
  '[{"date":"2026-11-02","time":"10:00"}]')$$, '22023', null, 'assign_plan recusa quantidade errada');

insert into public.post_media (id, post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/a/posts/f1/2.jpg', 1, 1024, 1280);
select results_eq($$select storage_path from public.reorder_post_media('aaaaaaaa-0000-4000-8000-0000000000f1',
    array['aaaaaaaa-0000-4000-8000-0000000000a2'::uuid,
          (select id from public.post_media where storage_path = 'clients/a/posts/f1/1.jpg')])$$,
  $$values ('clients/a/posts/f1/2.jpg'), ('clients/a/posts/f1/1.jpg')$$, 'admin reordena o carrossel');

-- anon -----------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select 1 from public.posts$$, '42501', null, 'anon não lê posts');
select throws_ok($$select public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)$$,
  '42501', null, 'anon não executa RPC');
reset role;

select * from finish();
rollback;
