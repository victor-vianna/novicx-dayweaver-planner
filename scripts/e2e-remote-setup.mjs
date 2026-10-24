// Creates (idempotently) the fictitious accounts used by `npm run test:supabase:remote`
// on the LINKED dev project: one admin and two clients with an active package.
// Ids start with ee2e…, e-mails with e2e-…@example.com, business names with [E2E].
// The password is random, stored only in .env.e2e.local (gitignored), and
// re-applied on every run. Never touches other rows.
// Usage: npm run e2e:setup:remote
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EXPECTED_REF = "smhrcfiwpqhumdclzdre";
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (ref !== EXPECTED_REF) {
  console.error(`Refusing to run: linked project is ${ref}, expected ${EXPECTED_REF}.`);
  process.exit(1);
}

const ENV_FILE = ".env.e2e.local";
const env = existsSync(ENV_FILE)
  ? Object.fromEntries(
      readFileSync(ENV_FILE, "utf8")
        .split(/\r?\n/)
        .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    )
  : {};
for (const key of ["E2E_SUPABASE_URL", "E2E_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!env[key]) {
    console.error(
      `${ENV_FILE}: missing ${key} (project URL / publishable key, never service_role).`,
    );
    process.exit(1);
  }
}
env.E2E_PASSWORD ??= randomBytes(18).toString("base64url");
writeFileSync(
  ENV_FILE,
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);

const sql = `
do $e2e$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  pwd text := extensions.crypt('${env.E2E_PASSWORD}', extensions.gen_salt('bf'));
begin
  insert into public.clients (id, display_name, business_name, profession, email) values
    ('ee2e0000-0000-4000-8000-0000000000c1', 'E2E A', '[E2E] Cliente A', 'Teste', 'e2e-a@example.com'),
    ('ee2e0000-0000-4000-8000-0000000000c2', 'E2E B', '[E2E] Cliente B', 'Teste', 'e2e-b@example.com')
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
      ('ee2e0000-0000-4000-8000-0000000000a0'::uuid, 'e2e-admin@example.com', '[E2E] Equipe'),
      ('ee2e0000-0000-4000-8000-0000000000a1'::uuid, 'e2e-a@example.com', '[E2E] Cliente A'),
      ('ee2e0000-0000-4000-8000-0000000000a2'::uuid, 'e2e-b@example.com', '[E2E] Cliente B')
    ) as u (id, email, name)
  on conflict (id) do update set encrypted_password = excluded.encrypted_password;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id::text like 'ee2e0000-%'
     and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

  update public.profiles set role = 'admin' where id = 'ee2e0000-0000-4000-8000-0000000000a0';

  insert into public.plans (id, name, posts_per_period, period_days, active)
  values ('ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, 365, false)
  on conflict (id) do nothing;

  insert into public.client_packages (id, client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date, status) values
    ('ee2e0000-0000-4000-8000-0000000000b1', 'ee2e0000-0000-4000-8000-0000000000c1', 'ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, today, today + 364, 'active'),
    ('ee2e0000-0000-4000-8000-0000000000b2', 'ee2e0000-0000-4000-8000-0000000000c2', 'ee2e0000-0000-4000-8000-0000000000d1', '[E2E] Plano de teste', 4, today, today + 364, 'active')
  on conflict (id) do nothing;
end
$e2e$;
select c.email, c.user_id is not null as linked, p.role
  from public.clients c left join public.profiles p on p.id = c.user_id
 where c.id::text like 'ee2e0000-%'
union all
select u.email, true, p.role from auth.users u join public.profiles p on p.id = u.id
 where u.id = 'ee2e0000-0000-4000-8000-0000000000a0';
`;

const tmp = path.join(mkdtempSync(path.join(tmpdir(), "e2e-")), "setup.sql");
writeFileSync(tmp, sql);
let out;
try {
  out = execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", tmp], {
    encoding: "utf8",
    shell: true,
  });
} finally {
  rmSync(path.dirname(tmp), { recursive: true, force: true }); // holds the password
}
console.log(out.slice(out.indexOf("{")));
