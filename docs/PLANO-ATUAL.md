# Plano Atual — Ciclo 3: Contas, cadastros e consistência

- **Data:** 2026-10-24
- **Líder técnico / executor do backend:** Claude Code · **Revisor das mudanças críticas:** Codex
- **Base:** `claude/ciclo-2` + revisão Codex X4 (`codex/revisao-ciclo-2`, `924c26e`)
- **Branch:** `claude/ciclo-3`
- **Status:** aprovado pelo responsável (2026-10-24) com as decisões D1–D6 recomendadas.
- **Andamento:** execução pela fila `docs/orquestracao/FILA.md` (fonte de verdade do estado; catálogo em `docs/orquestracao/ORQUESTRACAO.md` §3).
- Planos anteriores (ciclo 2 e antes): histórico Git deste arquivo.

## Objetivo

Cumprir os critérios de aceite CA01–CA09 do responsável (contas criadas pelo
admin, bloqueio de acesso, cadastro de clientes e planos, consistência das
publicações, dashboard com dados reais), sem reconstruir o app, preservando o
visual e o modo mock.

## Decisões aprovadas

| #   | Decisão                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Código privilegiado só na **Edge Function `admin-users`** (Supabase). A `service_role` é injetada pelo Supabase; nunca no repo, no frontend ou no host.                                        |
| D2  | Escopo ampliado: telas de clientes, planos e criação de contas entram neste ciclo.                                                                                                             |
| D3  | Primeiro acesso / restabelecimento: admin gera **link de definição de senha** (`generateLink`, sem envio de e-mail) e o encaminha à cliente. Ninguém conhece a senha da cliente.               |
| D4  | Deploy da função e de migrations no projeto **dev** `smhrcfiwpqhumdclzdre`, autorizado etapa a etapa, sempre com dry-run apresentado antes.                                                    |
| D5  | Exclusão de publicação só para **rascunhos**.                                                                                                                                                  |
| D6  | Merge na `main` (A1) depois da Etapa 0 revisada.                                                                                                                                               |
| D7  | **Histórico de alterações** das publicações (critério do responsável que estava fora do plano): `post_events` append-only por trigger, leitura só admin, linha do tempo no editor — tarefa T7. |

## Arquitetura (acréscimos ao ciclo 2)

- `profiles.blocked_at`; `is_admin()` e `current_client_id()` exigem conta não
  bloqueada → RLS e Storage negam na hora. A função também bane no Auth e
  encerra as sessões (refresh token deixa de valer).
- Edge Function `admin-users`: `create_account` (usuário com e-mail confirmado +
  cliente vinculada, com compensação), `set_access`, `reset_access` (link),
  `update_email` (cadastro + Auth juntos). Lógica em módulo TS puro testado com
  vitest; entrada Deno fina. Valida JWT e exige admin não bloqueado.
- Migrations aditivas: sem política de exclusão de clientes; `assign_plan`
  idempotente (`request_id`) e com trava na cliente; RPC `admin_set_post_status`
  (status, `published_at = now()`, `published_by_user`, formato numa transação).
- Frontend: fachada `services/accounts`; estado "acesso suspenso"; telas
  Clientes e Planos com componentes existentes; selo de demonstração só no mock;
  navegação do admin persistida em `sessionStorage`.

## Etapas

| Etapa | Conteúdo                                                                                                                        | CAs        | Status   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 0     | Fechar ciclo 2: revisão Codex I1–I4, M1, M2; selo demo só no mock; teste manual das telas no modo supabase                      | 03, 05, 07 | em curso |
| 1     | `blocked_at` + helpers + pgTAP de bloqueio                                                                                      | 01, 03     | —        |
| 2     | Edge Function `admin-users` + testes; deploy no dev (aprovação)                                                                 | 01, 02     | —        |
| 3     | `services/accounts`, acesso suspenso no auth, E2E do ciclo de vida da conta                                                     | 01, 08     | —        |
| R1    | **Revisão Codex** de 1–3 (SQL, função, auth)                                                                                    | —          | —        |
| 4     | Tela de clientes (CRUD, arquivar/restaurar, acesso, ficha, atalhos); remove exclusão de clientes                                | 02, 07     | —        |
| 5     | Tela de planos; `assign_plan` idempotente; teste "catálogo não altera pacote"                                                   | 06, 08     | —        |
| 6     | `admin_set_post_status`, responsável pela publicação, excluir rascunho, CORS do download                                        | 04, 05     | —        |
| 7     | Métrica "clientes ativos", navegação persistente, auditoria desktop/mobile, testes de tela, suíte completa, build, bundle, docs | 07, 08, 09 | —        |
| R2    | **Revisão Codex** final                                                                                                         | —          | —        |

Cada etapa: objetivo acima; riscos e testes na entrega (`docs/ENTREGA-CLAUDE.md`).

### Riscos principais

- Sem Docker: pgTAP e Edge Function só no dev remoto; cada migration nova passa por dry-run + aprovação.
- Recuperação de senha pela própria cliente depende de SMTP (A4); o link gerado pelo admin não depende.
- Destino de deploy (Vercel, X8) define Site URL e Redirect URLs do Auth.

## Testes

pgTAP no remoto (`db:test:remote`) para toda política/RPC nova, com isolamento ·
vitest para handler da função, services e telas · E2E remoto
(`test:supabase:remote`) com limpeza que falha a suíte · teste manual no
navegador (desktop e 375 px) · nos marcos: `tsc`, lint, vitest, build e bundle
sem `service_role`.

## Travas

**Claude:** `supabase/**`, `scripts/**`, `src/integrations/**`, `src/services/**`,
`src/features/**`, `src/components/common/**`, `package.json`, `.env.example`, `docs/PLANO-ATUAL.md`.
**Codex:** `vite.config.ts`, `vercel.json` (X8), `docs/REVISAO-CODEX.md`, `docs/ENTREGA-CODEX.md`.

## Autorizações pendentes

| #   | Decisão                                               | Recomendação                                 |
| --- | ----------------------------------------------------- | -------------------------------------------- |
| A4  | SMTP próprio para a recuperação de senha das clientes | Decidir antes de liberar para clientes reais |
| A6  | Unificar lockfile em `bun.lock`                       | Adiado                                       |
| —   | Projeto de produção                                   | Decisão futura, separada                     |
