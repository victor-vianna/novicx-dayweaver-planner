-- Revisão pré-produção: pacote não é excluível, perfil com histórico pode ser
-- excluído (o histórico fica), republicar não reescreve o registro e a arte
-- não troca de post por UPDATE direto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev');
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000003', 'adm2@teste.dev', now());
update public.profiles set role = 'admin'
 where id in ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000003');
insert into public.plans (id, name, posts_per_period, period_days) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, 30);
insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, '2026-10-01', '2026-10-30');
insert into public.posts (id, client_id, client_package_id, title, scheduled_date, scheduled_time, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'P1', '2026-10-05', '10:00', 'draft'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'P2', '2026-10-07', '10:00', 'draft');
insert into public.post_media (post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/a/posts/f1/1.jpg', 0, 1080, 1350);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

select ok(not has_table_privilege('authenticated', 'public.client_packages', 'delete'),
  'authenticated não exclui pacote');
select ok(not has_column_privilege('authenticated', 'public.post_media', 'post_id', 'update')
       and not has_column_privilege('authenticated', 'public.post_media', 'position', 'update'),
  'arte não troca de post nem de posição por UPDATE direto');

-- Admin 2 libera e publica (gera histórico com ele como ator).
select pg_temp.login('dddddddd-0000-4000-8000-000000000003');
select public.admin_set_post_status('aaaaaaaa-0000-4000-8000-0000000000f1', 'published');
select throws_ok($$delete from public.client_packages where id = 'aaaaaaaa-0000-4000-8000-0000000000b0'$$,
  '42501', null, 'admin não exclui pacote (cascata apagaria publicações)');
select throws_ok($$update public.post_media set post_id = 'aaaaaaaa-0000-4000-8000-0000000000f2'
  where post_id = 'aaaaaaaa-0000-4000-8000-0000000000f1'$$, '42501', null, 'admin não move arte de post');

-- Republicar pela RPC da cliente não reescreve data nem responsável.
reset role;
update public.posts set published_at = '2026-01-01T00:00:00Z' where id = 'aaaaaaaa-0000-4000-8000-0000000000f1';
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select is((select row(published_at, published_by::text, published_by_user)::text
             from public.set_post_published('aaaaaaaa-0000-4000-8000-0000000000f1', true)),
  row('2026-01-01T00:00:00Z'::timestamptz, 'admin', 'dddddddd-0000-4000-8000-000000000003'::uuid)::text,
  'republicar mantém data e responsável originais');
reset role;
select is((select count(*)::int from public.post_events
            where post_id = 'aaaaaaaa-0000-4000-8000-0000000000f1' and kind = 'status'), 1,
  'republicar não gera evento');

-- Excluir o perfil de quem tem histórico funciona; o histórico fica intacto.
select set_config('request.jwt.claims', '', true);
select lives_ok($$delete from auth.users where id = 'dddddddd-0000-4000-8000-000000000003'$$,
  'excluir usuário com histórico não falha');
select is((select count(*)::int from public.post_events
            where actor_id = 'dddddddd-0000-4000-8000-000000000003'), 1,
  'eventos mantêm o id do ator excluído');
select throws_ok($$update public.post_events set actor_id = null$$, '42501', null,
  'histórico continua sem alteração');

-- Excluir a cliente (só o dono pode) leva o histórico junto, sem erro.
select lives_ok($$delete from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$,
  'excluir cliente com histórico pelo dono não falha');

select * from finish();
rollback;
