-- T5 — assign_plan idempotente por request_id; o catálogo mudar depois não
-- altera o pacote contratado (nome, quantidade e slots ficam como estavam).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'B', 'Cliente B', 'b@teste.dev');
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now());
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';
insert into public.plans (id, name, posts_per_period, period_days) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Essencial', 2, 30),
  ('eeeeeeee-0000-4000-8000-000000000002', 'Outro', 2, 30);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.assign(p_client uuid, p_plan uuid, p_start date, p_request uuid)
returns public.client_packages language sql as $$
  select public.assign_plan(p_client, p_plan, p_start,
    '[{"date":"2026-11-02","time":"10:00"},{"date":"2026-11-04","time":"14:00"}]', p_request);
$$;

select has_column('public', 'client_packages', 'request_id', 'client_packages.request_id existe');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'assign_plan' and p.pronargs = 4),
  'a versão de 4 argumentos (sem request_id) não existe mais');

select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((pg_temp.assign('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001',
  '2026-11-01', '11111111-0000-4000-8000-000000000001')).posts_total, 2, 'admin contrata');
select is((pg_temp.assign('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001',
  '2026-11-01', '11111111-0000-4000-8000-000000000001')).id,
  (select id from public.client_packages where request_id = '11111111-0000-4000-8000-000000000001'),
  'repetir o mesmo request_id devolve o mesmo pacote');
select is((select count(*)::int from public.client_packages where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c'),
  1, 'dupla submissão gera 1 pacote');
select is((select count(*)::int from public.posts where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c'),
  2, 'dupla submissão não duplica os slots');
select is((select status::text from public.client_packages where request_id = '11111111-0000-4000-8000-000000000001'),
  'active', 'o pacote repetido continua ativo (não foi encerrado pela repetição)');

select throws_ok($$select pg_temp.assign('bbbbbbbb-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001',
  '2026-11-01', '11111111-0000-4000-8000-000000000001')$$, '22023', null, 'request_id reutilizado para outra cliente é recusado');
select throws_ok($$select pg_temp.assign('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000002',
  '2026-11-01', '11111111-0000-4000-8000-000000000001')$$, '22023', null, 'request_id reutilizado para outro plano é recusado');
select throws_ok($$select pg_temp.assign('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001',
  '2026-11-01', null)$$, '22023', null, 'request_id nulo é recusado');

-- Catálogo muda depois da contratação (como admin, pela política do catálogo).
update public.plans set name = 'Essencial Plus', posts_per_period = 8, period_days = 60
 where id = 'eeeeeeee-0000-4000-8000-000000000001';
select is((select plan_name_snapshot from public.client_packages where request_id = '11111111-0000-4000-8000-000000000001'),
  'Essencial', 'renomear o plano não altera o pacote');
select is((select posts_total from public.client_packages where request_id = '11111111-0000-4000-8000-000000000001'),
  2, 'mudar a quantidade do plano não altera o pacote');
select is((select count(*)::int from public.posts where client_id = 'aaaaaaaa-0000-4000-8000-00000000000c'),
  2, 'mudar o plano não cria nem remove slots');

reset role;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select throws_ok($$select pg_temp.assign('aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001',
  '2026-12-01', gen_random_uuid())$$, '42501', null, 'cliente não contrata plano');

select * from finish();
rollback;
