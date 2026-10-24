-- C3 — bucket privado e políticas de storage.objects.
-- Limite de tamanho e tipos são aplicados pela API de Storage a partir da
-- configuração do bucket; aqui conferimos a configuração e as políticas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select is((select public from storage.buckets where id = 'post-media'), false, 'bucket post-media é privado');
select is((select file_size_limit from storage.buckets where id = 'post-media'), 15728640::bigint, 'limite de 15 MB');
select is((select allowed_mime_types from storage.buckets where id = 'post-media'),
  array['image/jpeg', 'image/png', 'image/webp'], 'só JPEG, PNG e WebP');

-- Fixtures
insert into public.clients (id, display_name, business_name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000c', 'A', 'Cliente A', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'B', 'Cliente B', 'b@teste.dev');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.dev'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b@teste.dev'),
  ('dddddddd-0000-4000-8000-000000000001', 'adm@teste.dev');
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';
insert into public.plans (id, name, posts_per_period, period_days)
values ('eeeeeeee-0000-4000-8000-000000000001', 'P', 2, 30);
insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date) values
  ('aaaaaaaa-0000-4000-8000-0000000000b0', 'aaaaaaaa-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'P', 2, '2026-10-01', '2026-10-30'),
  ('bbbbbbbb-0000-4000-8000-0000000000b0', 'bbbbbbbb-0000-4000-8000-00000000000c', 'eeeeeeee-0000-4000-8000-000000000001', 'P', 2, '2026-10-01', '2026-10-30');
insert into public.posts (id, client_id, client_package_id, title, scheduled_date, scheduled_time, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'A pronto', '2026-10-05', '10:00', 'ready'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000b0', 'A rascunho', '2026-10-07', '10:00', 'draft'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'B pronto', '2026-10-05', '10:00', 'ready');

-- caminhos: clients/{client}/posts/{post}/{arquivo}
insert into public.post_media (post_id, storage_path, position, width, height) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/1.jpg', 0, 1, 1),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f2/1.jpg', 0, 1, 1),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'clients/bbbbbbbb-0000-4000-8000-00000000000c/posts/bbbbbbbb-0000-4000-8000-0000000000f1/1.jpg', 0, 1, 1);

insert into storage.objects (bucket_id, name) values
  ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/1.jpg'),
  ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f2/1.jpg'),
  ('post-media', 'clients/bbbbbbbb-0000-4000-8000-00000000000c/posts/bbbbbbbb-0000-4000-8000-0000000000f1/1.jpg'),
  -- órfão: arquivo sem registro em post_media (ex.: upload interrompido)
  ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/orfao.jpg');

-- versões recentes do Storage bloqueiam DELETE direto por SQL sem esta flag
select set_config('storage.allow_delete_query', 'true', true);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Cliente A
reset role;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
select results_eq($$select name from storage.objects where bucket_id = 'post-media'$$,
  $$values ('clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/1.jpg')$$,
  'A lê só a arte do próprio post não-rascunho');
select is_empty($$select 1 from storage.objects where name like 'clients/bbbbbbbb%'$$, 'A não lê objeto de B');
select is_empty($$select 1 from storage.objects where name like '%0000000000f2/%'$$, 'A não lê arte de rascunho');
select is_empty($$select 1 from storage.objects where name like '%orfao.jpg'$$, 'A não lê arquivo órfão');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/novo.jpg')$$,
  '42501', null, 'cliente não grava no bucket');
delete from storage.objects where bucket_id = 'post-media';

-- Admin
reset role;
select pg_temp.login('dddddddd-0000-4000-8000-000000000001');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media'), 4,
  'admin lê todos os objetos (DELETE de A não apagou nada)');
select lives_ok($$insert into storage.objects (bucket_id, name)
  values ('post-media', 'clients/aaaaaaaa-0000-4000-8000-00000000000c/posts/aaaaaaaa-0000-4000-8000-0000000000f1/novo.jpg')$$,
  'admin grava no bucket');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('post-media', 'fora-do-padrao.jpg')$$,
  '42501', null, 'admin não grava fora do padrão de caminho');
select lives_ok($$delete from storage.objects where name like '%orfao.jpg'$$, 'admin apaga objeto');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media'), 4, 'órfão removido, novo mantido');

select * from finish();
rollback;
