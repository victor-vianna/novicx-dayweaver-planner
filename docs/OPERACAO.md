# Operação — NOVICX Planner com Supabase

## Variáveis de ambiente (frontend)

| Variável | Valores | Onde |
| --- | --- | --- |
| `VITE_DATA_SOURCE` | `mock` (padrão, demo) · `supabase` | `.env` local / Vercel |
| `VITE_SUPABASE_URL` | URL da API do projeto (`https://<ref>.supabase.co` ou `http://127.0.0.1:54321`) | idem |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave **publicável** (`sb_publishable_…` ou anon) | idem |

Nunca configurar `service_role` / `sb_secret_…` no frontend, na Vercel como
`VITE_*` ou no repositório. Todo acesso passa por RLS.

## Stack local

```bash
npm run db:start        # sobe Postgres, Auth, Storage, Studio, Mailpit (Docker)
npm run db:reset        # aplica migrations + supabase/seed.sql (dados fictícios)
npm run db:seed-media   # envia as artes fictícias ao Storage local
npm run db:test         # pgTAP: schema, RLS, Storage
npm run test:supabase   # fluxo ponta a ponta pelos services (admin → upload → cliente)
npm run db:status       # URL e chave publicável para o .env
```

O Studio pode falhar no healthcheck em máquinas lentas; ele não é necessário:
`npx supabase start -x studio`.

`.env` local para usar o backend: `VITE_DATA_SOURCE=supabase` + URL/chave do
`db:status`. Contas locais (senha `demo1234`): `equipe@novicx.com.br` (admin),
`marina@exemplo.com.br`, `rafael@rmtreinamento.com.br`, `helena@pradoadvocacia.com.br`.
E-mails de recuperação de senha locais aparecem no Mailpit (`http://127.0.0.1:54324`).

## Cadastro de clientes e acessos (sem tela no MVP)

1. **Cliente:** inserir em `clients` (Studio → Table editor, ou SQL) com o e-mail
   em minúsculas. Planos: tabela `plans`.
2. **Acesso:** Studio → Authentication → *Add user* (e-mail igual ao da cliente,
   senha provisória ou convite). O trigger cria o `profile` `client` e vincula à
   cliente pelo e-mail.
3. **Admin:** criar o usuário e promover por SQL:
   `update public.profiles set role = 'admin' where id = '<uuid do usuário>';`
4. Pacote, datas, artes e liberação: pela tela da equipe (Clientes → cliente).

Cadastro público fica desligado (`enable_signup = false`).

## Projeto remoto de desenvolvimento

Pré-requisito: projeto existente, identidade confirmada (`supabase projects list`).

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push --dry-run   # revisar: só migrations novas, nada destrutivo
npx supabase db push
```

Nunca rodar `db reset` remoto nem `seed.sql` no remoto. Depois do push:

- Authentication → URL Configuration: *Site URL* = URL da Vercel e *Redirect URLs*
  inclui `https://<app>.vercel.app/**` (recuperação de senha).
- Authentication → Sign In / Providers: provedor **Email ligado**, *Allow new
  users to sign up* **desligado** (equivale ao `config.toml`: `[auth.email]
  enable_signup = true` liga o provedor; `[auth] enable_signup = false` bloqueia
  o cadastro público). Desligar o provedor bloqueia o login.
- Conferir que o bucket `post-media` foi criado privado (a migration cria).

**SMTP:** o SMTP padrão do Supabase só entrega para membros da equipe do
projeto e tem limite baixo. Para clientes reais, configurar SMTP próprio
(decisão A4 do plano).

## Vercel

Variáveis do projeto: as três `VITE_*` acima (Production e Preview). O build e o
preset são responsabilidade da tarefa X8 (ver `docs/TAREFAS-CODEX.md`).
