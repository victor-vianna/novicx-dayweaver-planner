-- T7 — histórico de alterações: um evento por mudança relevante, com ator;
-- leitura só admin ativo; ninguém altera nem exclui (exceto a cascata de um
-- rascunho excluído).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'B', 'Cliente B', 'b@teste.dev');
-- ADM = admin ativo · ADX = admin bloqueado
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000002', 'adx@teste.dev', now());
update public.profiles set role = 'admin'
 where id in ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002');
update public.profiles set blocked_at = now() where id = 'dddddddd-0000-4000-8000-000000000002';
insert into public.plans (id, name, posts_per_period, period_days) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, 30);
insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'Plano', 3, '2026-10-01', '2026-10-30');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- Eventos do post "Histórico" (lidos como postgres, sem RLS).
create function pg_temp.kinds() returns text language sql as $$
  select coalesce(string_agg(e.kind, ',' order by e.id), '')
    from public.post_events e join public.posts p on p.id = e.post_id
   where p.title like 'Histórico%';
$$;

-- Catálogo e privilégios
select has_table('public', 'post_events', 'post_events existe');
select ok(not has_table_privilege('anon', 'public.post_events', 'select'), 'anon não lê o histórico');
select ok(not has_table_privilege('authenticated', 'public.post_events', 'insert')
       and not has_table_privilege('authenticated', 'public.post_events', 'update')
       and not has_table_privilege('authenticated', 'public.post_events', 'delete')
       and not has_table_privilege('authenticated', 'public.post_events', 'truncate'),
  'authenticated não escreve no histórico');
select ok(not has_function_privilege('authenticated', 'public.log_post_event(uuid, uuid, text, jsonb)', 'execute'),
  'authenticated não chama log_post_event');

-- Admin cria, envia arte, libera, remarca, substitui e reordena.
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time)
  values ('aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'Histórico', '2026-10-05', '10:00');
reset role;
create temp table t7 as select id from public.posts where title = 'Histórico';
grant select on t7 to authenticated;
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is(pg_temp.kinds(), 'created', 'criar gera 1 evento');
select is((select row(actor_id, actor_role::text)::text from public.post_events where kind = 'created' and post_id = (select id from t7)),
  row('dddddddd-0000-4000-8000-000000000001'::uuid, 'admin')::text, 'evento traz o ator e o papel');

insert into public.post_media (post_id, storage_path, position, width, height) values
  ((select id from t7), 'clients/a/posts/h/1.jpg', 0, 1080, 1350),
  ((select id from t7), 'clients/a/posts/h/2.jpg', 1, 1080, 1350);
select is(pg_temp.kinds(), 'created,media_added,media_added', 'cada arte enviada gera 1 evento');

select public.admin_set_post_status((select id from t7), 'ready');
select is(pg_temp.kinds(), 'created,media_added,media_added,status', 'liberar gera 1 evento de status');
select is((select detail->>'from' || '>' || (detail->>'to') from public.post_events where kind = 'status' and post_id = (select id from t7)),
  'draft>ready', 'evento de status guarda de/para');

update public.posts set title = 'Histórico (título)', caption = 'x' where id = (select id from t7);
select is(pg_temp.kinds(), 'created,media_added,media_added,status', 'título e legenda não geram evento');

update public.posts set scheduled_date = '2026-10-06', scheduled_time = '11:30' where id = (select id from t7);
select is(pg_temp.kinds(), 'created,media_added,media_added,status,schedule', 'remarcar gera 1 evento');
select is((select detail::text from public.post_events where kind = 'schedule' and post_id = (select id from t7)),
  '{"to_date": "2026-10-06", "to_time": "11:30", "from_date": "2026-10-05", "from_time": "10:00"}', 'evento de data guarda de/para');

update public.post_media set storage_path = 'clients/a/posts/h/1b.jpg' where storage_path = 'clients/a/posts/h/1.jpg';
select is(pg_temp.kinds(), 'created,media_added,media_added,status,schedule,media_replaced', 'substituir arte gera 1 evento');

select public.reorder_post_media((select id from t7),
  array(select id from public.post_media where post_id = (select id from t7) order by position desc));
select is(pg_temp.kinds(), 'created,media_added,media_added,status,schedule,media_replaced', 'reordenar não gera evento');

select public.admin_set_post_status((select id from t7), 'ready');
select is(pg_temp.kinds(), 'created,media_added,media_added,status,schedule,media_replaced', 'status igual não gera evento');

-- Cliente publica pela RPC dela: evento com o perfil e o papel dela.
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select public.set_post_published((select id from t7), true);
select is((select count(*)::int from public.post_events), 0, 'cliente não lê o histórico (nem o do próprio post)');
reset role;
select is((select row(actor_id, actor_role::text, detail->>'to', detail->>'published_by')::text
             from public.post_events where post_id = (select id from t7) order by id desc limit 1),
  row('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'client', 'published', 'client')::text,
  'publicação pela cliente registra a cliente como ator');

select pg_temp.login('bbbbbbbb-0000-4000-8000-000000000001');
select is((select count(*)::int from public.post_events), 0, 'outra cliente não lê o histórico');
select pg_temp.login('dddddddd-0000-4000-8000-000000000002');
select is((select count(*)::int from public.post_events), 0, 'admin bloqueado não lê o histórico');
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '', true);
select throws_ok($$select count(*) from public.post_events$$, '42501', null, 'anon recebe 42501');

select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((select count(*)::int from public.post_events where post_id = (select id from t7)), 7, 'admin lê todo o histórico do post');

-- Ninguém altera nem exclui pela API.
select throws_ok($$insert into public.post_events (post_id, client_id, kind) values ((select id from t7), 'aaaaaaaa-0000-4000-8000-00000000000c', 'created')$$,
  '42501', null, 'admin não insere evento');
select throws_ok($$update public.post_events set kind = 'created'$$, '42501', null, 'admin não altera evento');
select throws_ok($$delete from public.post_events$$, '42501', null, 'admin não exclui evento');

-- Nem o dono da tabela (service_role/postgres) altera ou exclui.
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$update public.post_events set detail = '{}' where post_id = (select id from t7)$$,
  '42501', null, 'dono não altera evento (trigger)');
select throws_ok($$delete from public.post_events where post_id = (select id from t7)$$,
  '42501', null, 'dono não exclui evento de post existente (trigger)');
select throws_ok($$truncate public.post_events$$, '42501', null, 'truncate é recusado');
select is((select count(*)::int from public.post_events where post_id = (select id from t7)), 7, 'histórico intacto');

-- Arte removida gera evento; rascunho excluído leva o próprio histórico sem erro.
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
delete from public.post_media where storage_path = 'clients/a/posts/h/2.jpg';
select is((select kind from public.post_events where post_id = (select id from t7) order by id desc limit 1),
  'media_removed', 'remover arte gera evento');

insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time)
  values ('aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'Rascunho descartável', '2026-10-09', '10:00');
insert into public.post_media (post_id, storage_path, position, width, height)
  select id, 'clients/a/posts/r/1.jpg', 0, 1080, 1350 from public.posts where title = 'Rascunho descartável';
reset role;
create temp table t7r as select id from public.posts where title = 'Rascunho descartável';
select is((select count(*)::int from public.post_events where post_id = (select id from t7r)), 2,
  'rascunho tem eventos de criação e de arte');
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select lives_ok($$delete from public.posts where title = 'Rascunho descartável'$$, 'excluir rascunho com histórico funciona');
reset role;
select is((select count(*)::int from public.post_events where post_id = (select id from t7r)), 0,
  'histórico do rascunho excluído vai junto (cascata)');

select * from finish();
rollback;
