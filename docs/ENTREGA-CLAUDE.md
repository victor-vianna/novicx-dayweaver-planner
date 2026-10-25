# Entrega Claude — Ciclo 2 (C0–C7)

- **Data:** 2026-10-24 · **Branch:** `claude/ciclo-2`
- **Ambiente:** sem Docker. Banco de integração = projeto remoto **dev**
  `smhrcfiwpqhumdclzdre` (autorizado pelo responsável; só migrations não destrutivas).

## Commits

| Commit    | Conteúdo                                                                  |
| --------- | ------------------------------------------------------------------------- |
| `c35af91` | C0 — fundação (cliente Supabase, `VITE_DATA_SOURCE`)                      |
| `2a0a0b9` | C4/C5 — auth real e services Supabase                                     |
| `0cf39e4` | C6 — entrega administrativa                                               |
| `6462dad` | C1–C3 — schema, RLS, Storage, seed, pgTAP                                 |
| `b991484` | teste ponta a ponta dos services; ajustes de operação                     |
| `8f331aa` | migrations aplicadas no remoto; runner pgTAP sem Docker; 2 endurecimentos |
| `e450f38` | fluxo E2E contra o remoto                                                 |

## O que mudou nesta etapa

1. **Migrations no remoto:** 5 aplicadas (`supabase migration list --linked` confere).
   Antes do push: schema `public` vazio, sem bucket e sem triggers em `auth.users`; dry-run revisado.
2. **`npm run db:test:remote`** (`scripts/db-test-remote.mjs`): roda cada `supabase/tests/*.test.sql`
   via `db query --linked`, troca o `finish(); rollback;` final por um bloco que **sempre lança
   exceção**, então o lote aborta e nada fica gravado (nem a extensão pgtap). A contagem vem dos
   contadores do pgTAP 1.3 (`__tcache__`). Probe com `ok(false)` confirmou a detecção de falha.
3. **Endurecimentos (migrations novas):**
   - `20261024120000_revoke_trigger_fns` — advisor 0029: `authenticated` tinha EXECUTE em
     `handle_new_user`/`set_updated_at` (grant padrão do Supabase).
   - `20261024120100_link_on_confirmed_email` — vínculo conta→cliente só com e-mail confirmado
     (no insert ou na confirmação). Evita que uma conta não confirmada ocupe o vínculo de uma cliente.
4. **Auth remoto:** o projeto veio com **cadastro público ligado**. Desligado via `config push`
   de cópia temporária do `config.toml` (diff só com: `enable_signup`, senha mínima 8,
   site URL/redirects locais). Confirmação de e-mail e MFA ficaram nos padrões do projeto.
5. **E2E remoto:** `npm run e2e:setup:remote` (contas `[E2E]` fictícias, senha aleatória em
   `.env.e2e.local`) e `npm run test:supabase:remote`.

## Verificações

```
db:test:remote         00_schema 19/19 · 01_rls 42/42 · 02_storage 13/13
test:supabase:remote   7/7 (login, upload carrossel, substituição, rascunho invisível,
                       URL assinada 200 image/jpeg, RPC publicar, cliente B e anon sem acesso)
resíduo após testes    posts 0 · post_media 0 · storage.objects 0 · auth.users 3 (contas E2E)
vitest (unit)          66/66 (--maxWorkers=2)
tsc / eslint           0 erros (8 warnings preexistentes)
build                  ok (mock e supabase); bundle sem service_role/sb_secret/JWT
advisors               segurança: só 0029 nas RPCs/helpers (intencional, validam is_admin/dona);
                       performance: só INFO (FKs sem índice, índice não usado)
```

## Limitações

- `db:test` local (Docker) não foi executado nesta etapa; a validação do SQL foi no remoto.
- O teste "vínculo só com e-mail confirmado" não foi visto falhar antes da migration (a 1ª
  execução quebrou por colisão de fixture, corrigida depois).
- Telas no modo supabase ainda **não testadas manualmente** (calendário real, entrega admin).
- Build ainda no preset Cloudflare (X8 do Codex para Vercel).
- Recuperação de senha para clientes reais depende de SMTP próprio (A4).
- Região do projeto é `us-east-1` (plano previa `sa-east-1`); só latência.

## O que o Codex deve revisar (X4)

- `supabase/migrations/*` (5) — principalmente RLS, RPCs `security definer` e as duas novas.
- `scripts/db-test-remote.mjs` — garantia de não gravar nada no remoto.
- `scripts/e2e-remote-setup.mjs` e `src/services/supabase/flow.it.ts` — escopo da limpeza
  (só o que o teste cria) e checagens de ref/URL/chave publicável.

---

# Ciclo 3 — entregas do Claude (detalhe em `docs/orquestracao/tarefas/<ID>.md`)

| ID  | Commit(s)           | Estado                              | Verificações                                                                                |
| --- | ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| T4a | 1f6040c             | aprovada; push 2026-10-25 (AH)      | pgTAP 04 9/9                                                                                |
| T5  | 5ffad91, a148692    | aprovada (r2); push 2026-10-25 (AH) | pgTAP 05 18/18; npm 213/213                                                                 |
| —   | cde03c0             | tipos regerados pós-push            | migrations 9/9; pgTAP 136/136 sem pendentes; E2E remoto 9/9; advisors inalterados; tsc      |
| T4b | 26c6119 (subagente) | em revisão CXR r1                   | npm 231/231; tsc; lint 0 erros; build                                                       |
| T6  | 596f52d             | aguardando revisão CXR ★            | pgTAP `--pending` 19·48·13·30·9·18·27 (sem a migration: 01 e 06 falham); npm 218/218; build |

Limitações abertas: E2E da T6 (CORS do download, recusa de exclusão/escrita direta)
só roda depois do push; `updatePost` com texto + status são 2 chamadas (o status é
atômico); remover a última arte de post liberado segue possível.

O Codex deve revisar na T6: privilégio por coluna em `posts` (nenhum caminho do app
escreve `status` direto), `admin_set_post_status` (republicar mantém registro), a
política de exclusão restrita e a limpeza do E2E (volta para rascunho antes de excluir).
