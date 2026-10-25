-- T6 — status da publicação só pela RPC admin_set_post_status (ou
-- set_post_published); responsável gravado; excluir só rascunho.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev');
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now());
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';
insert into public.plans (id, name, posts_per_period, period_days) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, 30);
insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, '2026-10-01', '2026-10-30');
-- f1: rascunho com 2 artes · f2: rascunho sem arte · f3: rascunho para excluir
insert into public.posts (id, client_id, client_package_id, title, scheduled_date, scheduled_time, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'Com artes', '2026-10-05', '10:00', 'draft'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'Sem arte', '2026-10-07', '10:00', 'draft'),
  ('aaaaaaaa-0000-4000-8000-0000000000f3', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'Excluir', '2026-10-09', '10:00', 'draft');
insert into public.post_media (post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/a/posts/f1/1.jpg', 0, 1080, 1350),
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/a/posts/f1/2.jpg', 1, 1080, 1350);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Catálogo e privilégios
select has_column('public', 'posts', 'published_by_user', 'posts.published_by_user existe');
select ok(has_function_privilege('authenticated', 'public.admin_set_post_status(uuid, public.post_status)', 'execute'),
  'authenticated executa admin_set_post_status');
select ok(not has_function_privilege('anon', 'public.admin_set_post_status(uuid, public.post_status)', 'execute'),
  'anon não executa admin_set_post_status');
select ok(not has_column_privilege('authenticated', 'public.posts', 'status', 'update'),
  'authenticated não atualiza status direto');
select ok(not has_column_privilege('authenticated', 'public.posts', 'published_at', 'update')
       and not has_column_privilege('authenticated', 'public.posts', 'published_by', 'update')
       and not has_column_privilege('authenticated', 'public.posts', 'published_by_user', 'update'),
  'authenticated não atualiza os campos de publicação direto');
select ok(has_column_privilege('authenticated', 'public.posts', 'title', 'update'),
  'authenticated ainda atualiza o título (RLS decide quem)');

-- Cliente
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select throws_ok($$select public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'ready')$$,
  '42501', null, 'cliente não chama admin_set_post_status');

-- Admin
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select throws_ok($$update public.posts set status = 'ready' where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'$$,
  '42501', null, 'admin não escreve status direto');
select throws_ok($$update public.posts set published_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'$$,
  '42501', null, 'admin não escreve published_at direto');
select throws_ok($$select public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f2', 'ready')$$,
  'P0001', null, 'liberar sem arte é recusado');
select throws_ok($$select public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', null)$$,
  '22023', null, 'status nulo é recusado');
select throws_ok($$select public.admin_set_post_status('99999999-0000-4000-8000-0000000000f1', 'ready')$$,
  'P0002', null, 'post inexistente');

select is((public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'ready')).format::text,
  'carousel', 'liberar grava o formato pela quantidade de artes');
select is((select status::text from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  'ready', 'post liberado');

select is((select row(published_by::text, published_by_user)::text
             from public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'published')),
  row('admin', 'dddddddd-0000-4000-8000-000000000001'::uuid)::text, 'publicar grava admin e o perfil responsável');
select isnt((select published_at from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  null, 'publicar grava published_at');

-- Repetir "publicado" não reescreve o registro original.
update public.posts set title = 'Com artes (editado)' where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
-- now() é fixo na transação: data antiga (como postgres) prova que não é reescrita.
reset role;
update public.posts set published_at = '2026-01-01T00:00:00Z' where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((select (published_at, published_by_user)::text from public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'published')),
  ('2026-01-01T00:00:00Z'::timestamptz, 'dddddddd-0000-4000-8000-000000000001'::uuid)::text,
  'publicar de novo mantém data e responsável');
select is((select title from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  'Com artes (editado)', 'título segue editável direto');

-- Exclusão: só rascunho (a RLS filtra as demais, sem erro).
delete from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
select is((select count(*)::int from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  1, 'admin não exclui publicação já publicada');
delete from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f3';
select is((select count(*)::int from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f3'),
  0, 'admin exclui rascunho');

select is((select row(published_at, published_by, published_by_user)::text
             from public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'ready')),
  row(null::timestamptz, null::public.publisher, null::uuid)::text, 'voltar para pronto limpa a publicação');

-- Cliente marca pela RPC própria: responsável é o perfil dela.
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select is((public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)).published_by_user,
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'cliente publica: published_by_user = cliente');
select is((public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', false)).published_by_user,
  null::uuid, 'cliente desmarca: responsável limpo');
delete from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
select is((select count(*)::int from public.posts where id = 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  1, 'cliente não exclui post');

select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'draft')).status::text,
  'draft', 'admin volta para rascunho');

select set_config('role', 'anon', true);
select throws_ok($$select public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'ready')$$,
  '42501', null, 'anon não chama admin_set_post_status');

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$update public.posts set published_by_user = 'dddddddd-0000-4000-8000-000000000001'
  where id = 'aaaaaaaa-0000-4000-8000-0000000000f2'$$,
  '23514', null, 'responsável só existe em publicação publicada');

select * from finish();
rollback;
