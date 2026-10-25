-- T4a — ninguém exclui clientes pelo app (admin, cliente, anon); arquivar
-- continua funcionando para o admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev');
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev', now()),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev', now());
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

select policies_are('public', 'clients',
  array['clients_select', 'clients_admin_insert', 'clients_admin_update'],
  'clients não tem política de DELETE');
select ok(not has_table_privilege('authenticated', 'public.clients', 'DELETE'),
  'authenticated sem privilégio de DELETE em clients');
select ok(not has_table_privilege('anon', 'public.clients', 'DELETE'),
  'anon sem privilégio de DELETE em clients');

-- admin
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select throws_ok($$delete from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$,
  '42501', null, 'admin não exclui cliente');
select lives_ok($$update public.clients set archived_at = now() where id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$,
  'admin ainda arquiva cliente');
select isnt((select archived_at from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'), null,
  'arquivamento gravado');

-- cliente vinculada
reset role;
update public.clients set archived_at = null where id = 'aaaaaaaa-0000-4000-8000-00000000000c';
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select throws_ok($$delete from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'$$,
  '42501', null, 'cliente não exclui o próprio cadastro');

-- anon
reset role;
set local role anon;
select throws_ok($$delete from public.clients$$, '42501', null, 'anon não exclui clientes');

reset role;
select is((select count(*)::int from public.clients where id = 'aaaaaaaa-0000-4000-8000-00000000000c'), 1,
  'a cliente continua cadastrada');

select * from finish();
rollback;
