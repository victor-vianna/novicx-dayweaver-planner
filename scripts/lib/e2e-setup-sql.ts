// SQL for `npm run e2e:setup:remote`. Every write is keyed by the exact
// fixture ids below — never by a prefix — so rows of other tests are untouched.
import { assertSafePassword, E2E_USER_IDS } from "./e2e-env.ts";

const [ADMIN, CLIENT_A, CLIENT_B] = E2E_USER_IDS;

export function buildSetupSql(password: string): string {
  assertSafePassword(password);
  const ids = E2E_USER_IDS.map((id) => `'${id}'`).join(", ");
  return `
do $e2e$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  pwd text := extensions.crypt('${password}', extensions.gen_salt('bf'));
  v_ids uuid[] := array[${ids}]::uuid[];
begin
  insert into public.clients (id, display_name, business_name, profession, email) values
    ('ee2e0000-0000-4000-8000-0000000000c1', 'E2E A', '[E2E] Cliente A', 'Teste', 'e2e-a@example.com'),
    ('ee2e0000-0000-4000-8000-0000000000c2', 'E2E B', '[E2E] Cliente B', 'Teste', 'e2e-b@example.com'),
    -- No Auth user: the lifecycle E2E creates it through the admin-users function.
    ('ee2e0000-0000-4000-8000-0000000000c3', 'E2E Ciclo', '[E2E] Ciclo de vida', 'Teste', 'e2e-life@example.com')
  on conflict (id) do nothing;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         pwd, now(), '{"provider":"email","providers":["email"]}',
         jsonb_build_object('full_name', u.name), now(), now(), '', '', '', ''
    from (values
      ('${ADMIN}'::uuid, 'e2e-admin@example.com', '[E2E] Equipe'),
      ('${CLIENT_A}'::uuid, 'e2e-a@example.com', '[E2E] Cliente A'),
      ('${CLIENT_B}'::uuid, 'e2e-b@example.com', '[E2E] Cliente B')
    ) as u (id, email, name)
  on conflict (id) do update set encrypted_password = excluded.encrypted_password;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id = any(v_ids)
     and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

  update public.profiles set role = 'admin' where id = '${ADMIN}';

  insert into public.plans (id, name, posts_per_period, period_days, active)
  values ('ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, 365, false)
  on conflict (id) do nothing;

  insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date, status) values
    ('ee2e0000-0000-4000-8000-0000000000b1', 'ee2e0000-0000-4000-8000-0000000000c1', 'ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, today, today + 364, 'active'),
    ('ee2e0000-0000-4000-8000-0000000000b2', 'ee2e0000-0000-4000-8000-0000000000c2', 'ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, today, today + 364, 'active'),
    -- F1: the full journey delivers a carousel to the lifecycle client.
    ('ee2e0000-0000-4000-8000-0000000000b3', 'ee2e0000-0000-4000-8000-0000000000c3', 'ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, today, today + 364, 'active')
  on conflict (id) do nothing;
end
$e2e$;
select c.email, c.user_id is not null as linked, p.role
  from public.clients c left join public.profiles p on p.id = c.user_id
 where c.id in ('ee2e0000-0000-4000-8000-0000000000c1', 'ee2e0000-0000-4000-8000-0000000000c2',
                'ee2e0000-0000-4000-8000-0000000000c3')
union all
select u.email, true, p.role from auth.users u join public.profiles p on p.id = u.id
 where u.id = '${ADMIN}';
`;
}
