# FILA — NOVICX Planner (ciclo 3 → homologação)

Escritor único: Claude (coordenador). Catálogo e regras: `ORQUESTRACAO.md` §3–§5.
Estados: `todo` · `doing` · `review` · `changes` · `approved` · `done` · `blocked`.
Revisão: CXR = Codex revisor (★ = `xhigh`); CL = Claude revisa; AH = aprovação humana.

| ID  | Tarefa                                                                     | Dono   | Depende        | Estado | Rodada | SHA revisado | Travas (arquivos)                                                      | Nota                                                    |
| --- | -------------------------------------------------------------------------- | ------ | -------------- | ------ | ------ | ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| O0  | FILA, `codex-job.mjs`, `.orq/`, worktrees, job-fumaça                      | CL     | —              | done   | 4      | e64c8a5      | `docs/orquestracao/**`, `scripts/orq/**`, `.gitignore`                 | aprovada na r4 (revisoes/O0-r4.json)                    |
| O1  | `db:test:remote --pending` (migrations pendentes no lote revertido)        | CL     | O0             | review | 1      | —            | `scripts/db-test-remote.mjs`, `scripts/lib/**`                         | CXR ★ xhigh em andamento (sha 0113c6c)                  |
| E0  | Commit I1–I3, M1, M2 + I4 (`reorder_post_media`) em migration nova + pgTAP | CL     | O1             | doing  | —      | —            | `supabase/**`, `scripts/**`, `src/services/supabase/flow.it.ts`        | CXR ★ → AH push · pronto em b21531c; depende de O1 done |
| E0b | Selo de demonstração só no mock                                            | CL     | O0             | doing  | —      | —            | componente do selo + teste                                             | CXR · pronto em 814c641; aguarda vaga                   |
| X1  | `maxWorkers` no `vitest.config.ts`                                         | CX     | O0             | todo   | —      | —            | `vitest.config.ts`                                                     | CL revisa                                               |
| X2  | A11y do menu mobile                                                        | CX     | O0             | todo   | —      | —            | `src/components/layout/**`                                             | CL revisa                                               |
| X3  | 404/erro em pt-BR                                                          | CX     | O0             | todo   | —      | —            | `src/routes/__root.tsx` (só 404/erro)                                  | CL revisa                                               |
| X8  | Build Vercel (preset nitro), `vercel.json`                                 | CX     | O0             | todo   | —      | —            | `vite.config.ts`, `vercel.json`                                        | CL revisa                                               |
| X10 | Bundle sem `service_role`/`sb_secret_`                                     | CX     | X8             | todo   | —      | —            | script de varredura (pedido fora de faixa → CL aplica)                 | CL revisa                                               |
| H0  | Teste manual das telas no modo supabase, desktop e 375 px                  | CX     | E0             | todo   | —      | —            | só leitura + `.orq/evidence/H0/`                                       | —                                                       |
| M0  | Merge `claude/ciclo-3` → `main` (D6)                                       | CL     | E0, E0b, X1–X3 | todo   | —      | —            | —                                                                      | **AH**                                                  |
| T1  | `profiles.blocked_at`; helpers exigem conta não bloqueada                  | CL     | E0             | doing  | —      | —            | `supabase/**`                                                          | CXR ★ · pronto em f323494; aguarda vaga                 |
| T2  | Edge Function `admin-users` (create/set_access/reset_access/update_email)  | CL     | T1             | doing  | —      | —            | `supabase/functions/**`, `src/lib/admin-users/**`                      | CXR ★ → AH deploy · implementação pronta                |
| T3  | `services/accounts`, acesso suspenso, E2E do ciclo de vida                 | CL     | T2             | todo   | —      | —            | `src/services/**`, `src/features/auth/**`, `flow.it.ts`                | CXR ★ (R1, multi_agent)                                 |
| T4a | Remover política de exclusão de clientes                                   | CL     | T3             | todo   | —      | —            | `supabase/**`                                                          | CXR → AH push                                           |
| T4b | Tela de Clientes (CRUD, arquivar, acesso, ficha, atalhos)                  | CL-sub | T3             | todo   | —      | —            | `src/features/admin/clients/**`                                        | CXR                                                     |
| T5  | `assign_plan` idempotente; tela de Planos                                  | CL     | T3             | todo   | —      | —            | `supabase/**`, `src/features/admin/plans/**`, `src/services/packages*` | CXR ★ → AH push                                         |
| X9  | Testes a11y/responsividade (entrega, clientes, planos)                     | CX     | T4b, T5        | todo   | —      | —            | `*.test.tsx` novos                                                     | CL revisa                                               |
| T6  | `admin_set_post_status`; excluir só rascunho; CORS do download             | CL     | T5             | todo   | —      | —            | `supabase/**`, `src/services/**`                                       | CXR ★ → AH push                                         |
| T7  | Histórico de alterações (`post_events` append-only) + linha do tempo (D7)  | CL     | T6             | todo   | —      | —            | `supabase/**`, `src/features/admin/delivery/**`                        | CXR ★ → AH push                                         |
| T8  | Métrica "clientes ativos", navegação persistente, testes de tela           | CL     | T7             | todo   | —      | —            | `src/features/admin/**`                                                | CXR                                                     |
| F1  | Jornada E2E completa no dev                                                | CL     | T8             | todo   | —      | —            | `src/services/supabase/*.it.ts`, `scripts/**`                          | CXR ★                                                   |
| H1  | Homologação visual desktop e 375 px (supabase)                             | CX     | T8             | todo   | —      | —            | só leitura + `.orq/evidence/H1/`                                       | —                                                       |
| R2  | Revisão final integrada (multi_agent)                                      | CXR    | F1, H1, X8–X10 | todo   | —      | —            | —                                                                      | ★                                                       |
| M1  | Merge na `main` + checklist de produção                                    | CL     | R2             | todo   | —      | —            | —                                                                      | **AH**                                                  |

## Pausas (aguardando você)

0. ~~O0 bloqueada no limite de 3 rodadas~~ — **resolvida:** o responsável autorizou a rodada 4 da O0 em 2026-10-24 ("autorizo a rodada 4 da O0"). Vale só para esta rodada.

1. **Informativo — revisor Codex não roda vitest.** No sandbox `workspace-write`
   do Codex no Windows, o vitest falha ao carregar a config (`spawn EPERM`).
   tsc, lint e git funcionam. Alternativas: (a) manter assim: o revisor confere
   as evidências do coordenador em `.orq/evidence/<ID>/` (**recomendado**, sem
   afrouxar a sandbox); (b) você ajustar a configuração do Codex para permitir
   subprocessos nesse modo (mudança global, só você pode fazer). Sigo com (a).

## Melhorias adiadas

- `db-test-remote.mjs`: as linhas de TAP no relatório de falha terminam com `\` (escape do JSON da `db query`). Cosmético.

## Autorizações permanentes

_Nenhuma._ D4 (PLANO-ATUAL): push de migrations e deploy de função no dev são
autorizados **etapa a etapa**, com dry-run apresentado antes. Para reduzir
pausas, ver o texto sugerido em `ORQUESTRACAO.md` §5.
