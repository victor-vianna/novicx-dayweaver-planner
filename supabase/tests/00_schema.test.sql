-- C1 — estrutura, restrições e trigger de novo usuário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', t, 'tabela ' || t) from unnest(array[
  'profiles', 'clients', 'plans', 'client_packages', 'posts', 'post_media', 'internal_notes'
]) as t;

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r'),
  'RLS ligada em todas as tabelas de public'
);

-- Trigger: usuário criado com e-mail de cliente → profile client + vínculo.
insert into public.clients (id, display_name, business_name, email)
values ('11111111-0000-4000-8000-000000000001', 'Ana', 'Ana Estúdio', 'ana@teste.dev');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values ('22222222-0000-4000-8000-000000000001', 'Ana@Teste.dev', '{"full_name":"Ana"}', now());

select is((select role::text from public.profiles where id = '22222222-0000-4000-8000-000000000001'),
  'client', 'trigger cria profile com role client');
select is((select user_id from public.clients where id = '11111111-0000-4000-8000-000000000001'),
  '22222222-0000-4000-8000-000000000001'::uuid, 'trigger vincula cliente pelo e-mail (sem diferenciar maiúsculas)');

insert into auth.users (id, email) values ('22222222-0000-4000-8000-000000000002', 'sem-cadastro@teste.dev');
select is((select count(*)::int from public.clients where user_id = '22222222-0000-4000-8000-000000000002'),
  0, 'usuário sem cliente correspondente não vincula nada');

-- E-mail não confirmado não vincula; vincula ao confirmar.
insert into public.clients (id, display_name, business_name, email)
values ('11111111-0000-4000-8000-000000000003', 'Caio', 'Caio Ltda', 'caio@teste.dev');
insert into auth.users (id, email) values ('22222222-0000-4000-8000-000000000003', 'caio@teste.dev');
select is((select user_id from public.clients where id = '11111111-0000-4000-8000-000000000003'),
  null, 'e-mail não confirmado não vincula cliente');
update auth.users set email_confirmed_at = now() where id = '22222222-0000-4000-8000-000000000003';
select is((select user_id from public.clients where id = '11111111-0000-4000-8000-000000000003'),
  '22222222-0000-4000-8000-000000000003'::uuid, 'confirmar o e-mail vincula cliente');
select ok(not has_function_privilege('authenticated', 'public.handle_user_email_confirmed()', 'execute'),
  'authenticated não executa handle_user_email_confirmed');

-- Restrições
insert into public.plans (id, name, posts_per_period, period_days)
values ('33333333-0000-4000-8000-000000000001', 'Plano', 4, 30);

select throws_ok(
  $$insert into public.plans (name, posts_per_period, period_days) values ('X', 0, 30)$$,
  '23514', null, 'posts_per_period > 0');

select throws_ok(
  $$insert into public.client_packages (client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date)
    values ('11111111-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'P', 4, '2026-10-10', '2026-10-01')$$,
  '23514', null, 'end_date >= start_date');

insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date)
values ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
        '33333333-0000-4000-8000-000000000001', 'P', 4, '2026-10-01', '2026-10-30');

select throws_ok(
  $$insert into public.client_packages (client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date)
    values ('11111111-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'P', 4, '2026-11-01', '2026-11-30')$$,
  '23505', null, 'só um pacote ativo por cliente');

select throws_ok(
  $$insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time, status)
    values ('11111111-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001', 'T', '2026-10-02', '10:00', 'published')$$,
  '23514', null, 'publicado exige published_at e published_by');

insert into public.clients (id, display_name, business_name, email)
values ('11111111-0000-4000-8000-000000000002', 'Bia', 'Bia', 'bia@teste.dev');
select throws_ok(
  $$insert into public.posts (client_id, client_package_id, title, scheduled_date, scheduled_time)
    values ('11111111-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000001', 'T', '2026-10-02', '10:00')$$,
  '23503', null, 'post não pode apontar para pacote de outra cliente');

select * from finish();
rollback;
