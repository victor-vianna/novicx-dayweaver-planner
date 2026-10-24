-- Seed FICTÍCIO para o stack local (npm run db:reset). Nunca usar em remoto.
-- Espelha src/mocks/seed.ts. Datas relativas a "hoje" em São Paulo.
-- Contas locais (senha demo1234): equipe@novicx.com.br (admin),
-- marina@exemplo.com.br, rafael@rmtreinamento.com.br, helena@pradoadvocacia.com.br.
-- Camila fica sem conta (cliente ainda não convidada).
-- Arquivos das artes: npm run db:seed-media (envia src/assets/posts ao Storage local).

do $seed$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.clients (id, display_name, business_name, profession, email, phone) values
    ('c0000000-0000-4000-8000-000000000001', 'Marina', 'Marina Alves', 'Psicóloga', 'marina@exemplo.com.br', '(11) 98734-2210'),
    ('c0000000-0000-4000-8000-000000000002', 'Rafael', 'RM Treinamento', 'Personal trainer', 'rafael@rmtreinamento.com.br', '(11) 99412-8833'),
    ('c0000000-0000-4000-8000-000000000003', 'Helena', 'Prado Advocacia de Família', 'Advogada', 'helena@pradoadvocacia.com.br', '(21) 98120-4477'),
    ('c0000000-0000-4000-8000-000000000004', 'Camila', 'Camila Reis Consultoria', 'Consultora de carreira', 'camila@camilareis.com.br', '(31) 99701-5522');

  -- Usuários de Auth (o trigger cria o profile e vincula pelo e-mail).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name),
         now(), now(), '', '', '', ''
    from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'equipe@novicx.com.br', 'Equipe NOVICX'),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'marina@exemplo.com.br', 'Marina Alves'),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'rafael@rmtreinamento.com.br', 'Rafael Monteiro'),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'helena@pradoadvocacia.com.br', 'Helena Prado')
    ) as u (id, email, name);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id::text like 'a0000000-%';

  update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';

  insert into public.plans (id, name, posts_per_period, period_days, default_weekdays, default_times, active) values
    ('d0000000-0000-4000-8000-000000000001', 'Conteúdo + Design · 8 posts', 8, 30, '{2,4}', '{10:00,19:00}', true),
    ('d0000000-0000-4000-8000-000000000002', 'Conteúdo + Design · 12 posts', 12, 30, '{1,3,5}', '{07:30,18:30}', true),
    ('d0000000-0000-4000-8000-000000000003', 'Design de Posts · 4 posts', 4, 30, '{3}', '{12:00}', true),
    ('d0000000-0000-4000-8000-000000000004', 'Design de Posts · Essencial (antigo)', 6, 30, '{2,5}', '{11:00}', false);

  insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date, status) values
    ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'Design de Posts · Essencial', 4, today - 44, today - 15, 'ended'),
    ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Conteúdo + Design · 8 posts', 8, today - 14, today + 15, 'active'),
    ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'Conteúdo + Design · 12 posts', 12, today - 6, today + 23, 'active'),
    ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'Design de Posts · 4 posts', 4, today - 24, today + 5, 'active');

  insert into public.posts (id, client_id, client_package_id, format, title, caption, scheduled_date, scheduled_time, status, published_at, published_by) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'single', 'Você não precisa dar conta de tudo', 'Existe uma pressão silenciosa para dar conta de tudo: trabalho, casa, relações, corpo, mente.

Mas ninguém dá conta de tudo o tempo todo. E tudo bem. 🤍

Pedir ajuda não é fraqueza — é maturidade.', today - 40, '12:00', 'published', ((today - 40) + '12:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'single', 'Um momento só seu', null, today - 33, '12:00', 'published', ((today - 33) + '12:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'single', 'Sono também é saúde mental', 'Dormir mal por uma noite acontece. Dormir mal por semanas muda o humor, a paciência e o foco.

🌙 Cuide do seu sono como cuida da sua agenda.', today - 26, '12:00', 'published', ((today - 26) + '12:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'single', 'Escutar é diferente de esperar a sua vez', 'Quantas vezes você ouviu alguém só esperando a sua vez de falar?

Escuta de verdade é presença. É curiosidade. É deixar o outro terminar.

Tente hoje. 👂', today - 19, '12:00', 'published', ((today - 19) + '12:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'Autocuidado também é produtividade', 'Cuidar da sua saúde mental não é um luxo, é uma base para tudo o que você constrói. 💜

Quando você descansa, organiza seus pensamentos e respeita seus limites, sua produtividade deixa de ser cansaço e passa a ser constância.

Qual pequeno cuidado você vai se dar hoje?', today - 12, '10:00', 'published', ((today - 12) + '10:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'carousel', 'Pequenas pausas, grandes resultados', 'Você não precisa de férias para recuperar a energia. Às vezes, precisa de cinco minutos. ⏸️

Arraste para o lado e veja duas pausas simples que cabem em qualquer rotina.

Salve este post para lembrar durante a semana.', today - 8, '19:00', 'published', ((today - 8) + '19:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'Um canto para respirar', null, today - 3, '12:00', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'O poder dos seus limites', 'Dizer não também é uma forma de cuidado — com você e com quem convive com você.

Limites claros evitam ressentimentos silenciosos e deixam as relações mais leves. ✨

Você tem facilidade ou dificuldade em dizer não? Me conta nos comentários.', today + 0, '19:00', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'carousel', 'Rotina que funciona de verdade', 'Rotina boa não é rotina perfeita. É rotina possível. 🗓️

Neste carrossel, dois passos simples para começar sem se cobrar demais.

Compartilhe com alguém que está tentando se organizar.', today + 4, '10:00', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'Ansiedade de domingo à noite?', 'Aquele aperto que aparece no domingo à noite tem nome — e tem manejo.

Antecipar a semana inteira de uma vez faz o corpo reagir como se tudo fosse acontecer agora. 🌙

No próximo post, trago três estratégias práticas. Ative as notificações para não perder.', today + 7, '20:00', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'Terapia online funciona?', null, today + 10, '10:00', 'draft', null, null),
  ('e0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'single', 'Como escolher um profissional', null, today + 13, '19:00', 'draft', null, null),
  ('e0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'single', 'Antes do treino da manhã', 'O treino começa antes do primeiro passo. 👟

Hidratação, 5 minutos de mobilidade e um objetivo claro para o dia.

Bora?', today - 2, '07:30', 'published', ((today - 2) + '07:30'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'single', 'Constância vence intensidade', 'Treinar pesado uma semana e sumir no mês seguinte não leva ninguém longe. 💪

Três treinos por semana, todas as semanas, mudam o seu corpo e a sua cabeça.

Marque quem precisa ler isso hoje.', today + 2, '18:30', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'single', '3 erros no agachamento', null, today + 5, '07:30', 'draft', null, null),
  ('e0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'single', 'Antes de assinar, leia isto', 'Um acordo de família mexe com patrimônio, rotina e, principalmente, com pessoas.

Antes de assinar, preste atenção em quatro pontos: guarda, convivência, pensão e partilha. ⚖️

Dúvidas? Agende uma conversa.', today - 10, '12:00', 'published', ((today - 10) + '12:00'::time) at time zone 'America/Sao_Paulo', 'client'),
  ('e0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'single', 'Atendimento com escuta e sigilo', null, today + 3, '12:00', 'ready', null, null),
  ('e0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'single', 'Guarda compartilhada: mitos e verdades', null, today + 5, '12:00', 'draft', null, null);

  insert into public.post_media (post_id, storage_path, position, width, height) values
  ('e0000000-0000-4000-8000-000000000001', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000001/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000002', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000002/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000003', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000003/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000004', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000004/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000005', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000005/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000006', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000006/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000006', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000006/2.jpg', 1, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000006', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000006/3.jpg', 2, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000007', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000007/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000008', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000008/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000009', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000009/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000009', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000009/2.jpg', 1, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000009', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000009/3.jpg', 2, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000010', 'clients/c0000000-0000-4000-8000-000000000001/posts/e0000000-0000-4000-8000-000000000010/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000013', 'clients/c0000000-0000-4000-8000-000000000002/posts/e0000000-0000-4000-8000-000000000013/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000014', 'clients/c0000000-0000-4000-8000-000000000002/posts/e0000000-0000-4000-8000-000000000014/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000016', 'clients/c0000000-0000-4000-8000-000000000003/posts/e0000000-0000-4000-8000-000000000016/1.jpg', 0, 1024, 1280),
  ('e0000000-0000-4000-8000-000000000017', 'clients/c0000000-0000-4000-8000-000000000003/posts/e0000000-0000-4000-8000-000000000017/1.jpg', 0, 1024, 1280);

  insert into public.internal_notes (client_id, post_id, body, created_by, created_at) values
    ('c0000000-0000-4000-8000-000000000001', null, 'Prefere receber as artes até quinta-feira. Evitar tons muito saturados — paleta terrosa aprovada.', 'a0000000-0000-4000-8000-000000000001', ((today - 20) + '14:12'::time) at time zone 'America/Sao_Paulo'),
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000011', 'Confirmar com a Marina se ela quer citar valores da sessão online (provavelmente não).', 'a0000000-0000-4000-8000-000000000001', ((today - 2) + '10:40'::time) at time zone 'America/Sao_Paulo'),
    ('c0000000-0000-4000-8000-000000000003', null, 'Toda arte passa pela revisão da OAB-friendly: sem promessas de resultado.', 'a0000000-0000-4000-8000-000000000001', ((today - 18) + '09:05'::time) at time zone 'America/Sao_Paulo');
end;
$seed$;
