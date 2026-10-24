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
   senha provisória com **Auto Confirm User**, ou convite). O trigger cria o
   `profile` `client` e vincula à cliente pelo e-mail **quando o e-mail está
   confirmado** (na criação com Auto Confirm, ou quando o convite é aceito).
3. **Admin:** criar o usuário e promover por SQL:
   `update public.profiles set role = 'admin' where id = '<uuid do usuário>';`
4. Pacote, datas, artes e liberação: pela tela da equipe (Clientes → cliente).

Cadastro público fica desligado (`enable_signup = false`).

## Projeto remoto de desenvolvimento (sem Docker)

Projeto: `novicx-planner-dev`, ref **`smhrcfiwpqhumdclzdre`** (`us-east-1`).
Conferir sempre `supabase/.temp/project-ref` antes de operar; os scripts abaixo
recusam rodar em outro ref.

```bash
npx supabase migration list --linked
npx supabase db push --dry-run   # revisar: só migrations novas, nada destrutivo
npx supabase db push
npm run db:test:remote           # pgTAP no remoto; cada arquivo aborta no fim → nada é gravado
npm run db:types:remote          # tipos a partir do remoto
npm run e2e:setup:remote         # contas [E2E] fictícias (idempotente)
npm run test:supabase:remote     # fluxo admin → upload → cliente pelos services
```

Nunca rodar `db reset` remoto nem `seed.sql` no remoto.

`.env.e2e.local` (ignorado pelo Git): `E2E_SUPABASE_URL`,
`E2E_SUPABASE_PUBLISHABLE_KEY` (chave publicável) e `E2E_PASSWORD` (gerada pelo
setup). Contas: `e2e-admin@example.com` (admin), `e2e-a@example.com`,
`e2e-b@example.com`; ids `ee2e0000-…`; plano inativo `[E2E] Plano de teste`. O
teste remove só o post e os arquivos que ele cria.

Auth remoto (aplicado em 2026-10-24 por `config push` a partir de cópia
temporária do `config.toml`, só com estes campos): cadastro público
**desligado**, senha mínima 8, *Site URL* `http://localhost:8080`, redirects
`http://localhost:8080/**` e `http://127.0.0.1:8080/**`. Confirmação de e-mail
e MFA TOTP seguem os padrões do projeto (ligados). **Não** rodar `config push`
direto do `config.toml` do repo: ele leva os valores do dev local.

Ao publicar na Vercel: *Site URL* = URL da Vercel e *Redirect URLs* incluindo
`https://<app>.vercel.app/**` (Authentication → URL Configuration).

App local apontando para o remoto (`.env`): `VITE_DATA_SOURCE=supabase`,
`VITE_SUPABASE_URL=https://smhrcfiwpqhumdclzdre.supabase.co` e a chave
publicável (`sb_publishable_…`, Settings → API Keys).

**SMTP:** o SMTP padrão do Supabase só entrega para membros da equipe do
projeto e tem limite baixo. Para clientes reais, configurar SMTP próprio
(decisão A4 do plano).

## Vercel

Variáveis do projeto: as três `VITE_*` acima (Production e Preview). O build e o
preset são responsabilidade da tarefa X8 (ver `docs/TAREFAS-CODEX.md`).
